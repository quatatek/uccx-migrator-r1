import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import crypto from "crypto";
import connectPgSimple from "connect-pg-simple";
import { storage } from "./storage";
import { User, SafeUser, ProjectMember } from "@shared/schema";

const PgSession = connectPgSimple(session);

export type ProjectPermission = 'view' | 'manageConnections' | 'import' | 'update' | 'migrate' | 'admin';

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: "admin" | "user";
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
      projectId?: string;
      projectPermissions?: ProjectMember;
      authUserId?: string;
      authRole?: "admin" | "user";
    }
  }
}

const SALT_ROUNDS = 10;

const tokenStore = new Map<string, { userId: string; role: "admin" | "user"; expiresAt: number }>();

export function generateAuthToken(userId: string, role: "admin" | "user"): string {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  tokenStore.set(token, { userId, role, expiresAt });
  return token;
}

export function validateAuthToken(token: string): { userId: string; role: "admin" | "user" } | null {
  const data = tokenStore.get(token);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    tokenStore.delete(token);
    return null;
  }
  return { userId: data.userId, role: data.role };
}

export function removeAuthToken(token: string): void {
  tokenStore.delete(token);
}

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (now > data.expiresAt) {
      tokenStore.delete(token);
    }
  }
}, 60 * 60 * 1000);

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function toSafeUser(user: User): SafeUser {
  const { password, ...safeUser } = user;
  return safeUser;
}

function getAuthFromRequest(req: Request): { userId: string; role: "admin" | "user" } | null {
  if (req.session?.userId) {
    return { userId: req.session.userId, role: req.session.role || "user" };
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const tokenData = validateAuthToken(token);
    if (tokenData) {
      return tokenData;
    }
  }

  return null;
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || "uccx-migration-secret-key-change-in-production";
  
  const useSecureCookies = process.env.COOKIE_SECURE === "true";
  
  if (process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
  }
  
  console.log(`Session config: NODE_ENV=${process.env.NODE_ENV}, secureCookies=${useSecureCookies}, trustProxy=${process.env.TRUST_PROXY || 'false'}`);
  
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: useSecureCookies,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  app.use((req: Request, _res: Response, next: NextFunction) => {
    const auth = getAuthFromRequest(req);
    if (auth) {
      req.authUserId = auth.userId;
      req.authRole = auth.role;
    }
    next();
  });
}

export function getRequestUserId(req: Request): string | undefined {
  return req.session?.userId || req.authUserId;
}

export function getRequestRole(req: Request): "admin" | "user" | undefined {
  return req.session?.role || req.authRole;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getRequestUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = getRequestUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const role = getRequestRole(req);
  if (role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

export async function loadUser(req: Request, res: Response, next: NextFunction) {
  const userId = getRequestUserId(req);
  if (userId) {
    try {
      const user = await storage.getUserById(userId);
      if (user) {
        req.user = toSafeUser(user);
      } else if (req.session?.userId) {
        req.session.destroy(() => {});
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  }
  next();
}

export async function seedDefaultAdmin() {
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  
  try {
    const existingAdmin = await storage.getUserByUsername(adminUsername);
    if (!existingAdmin) {
      const hashedPassword = await hashPassword(adminPassword);
      await storage.createUser({
        username: adminUsername,
        password: hashedPassword,
        email: process.env.ADMIN_EMAIL || null,
        role: "admin",
        isActive: true,
      });
      console.log(`Default admin user '${adminUsername}' created successfully`);
    } else {
      console.log(`Admin user '${adminUsername}' already exists`);
    }
  } catch (error) {
    console.error("Error seeding default admin:", error);
  }
}

export function requireProjectAccess(requiredPermission?: ProjectPermission, paramName: string = 'projectId') {
  return async function(req: Request, res: Response, next: NextFunction) {
    const userId = getRequestUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const projectId = req.params[paramName] || req.params.projectId || (req.query.projectId as string) || req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({ message: "Project ID is required" });
    }

    try {
      const permissions = await storage.getUserProjectPermissions(userId, projectId);
      
      if (!permissions) {
        return res.status(403).json({ message: "Access denied to this project" });
      }

      if (requiredPermission) {
        const hasPermission = checkPermission(permissions, requiredPermission);
        if (!hasPermission) {
          return res.status(403).json({ message: `Permission '${requiredPermission}' required` });
        }
      }

      req.projectId = projectId;
      req.projectPermissions = permissions;
      next();
    } catch (error) {
      console.error("Error checking project permissions:", error);
      res.status(500).json({ message: "Failed to check project permissions" });
    }
  };
}

function checkPermission(permissions: ProjectMember, required: ProjectPermission): boolean {
  if (permissions.isAdmin) return true;
  
  switch (required) {
    case 'view':
      return permissions.canView;
    case 'manageConnections':
      return permissions.canManageConnections;
    case 'import':
      return permissions.canImport;
    case 'update':
      return permissions.canUpdate;
    case 'migrate':
      return permissions.canMigrate;
    case 'admin':
      return permissions.isAdmin;
    default:
      return false;
  }
}

export function hasProjectPermission(req: Request, permission: ProjectPermission): boolean {
  if (!req.projectPermissions) return false;
  return checkPermission(req.projectPermissions, permission);
}

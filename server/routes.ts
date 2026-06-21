import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer, { type FileFilterCallback } from "multer";

/**
 * Sanitize a text value that may have been stored as a PostgreSQL array literal.
 * e.g. {"SK_FES_HR"} → SK_FES_HR
 */
function sanitizePgText(value: string | null | undefined): string {
  if (!value) return value as string;
  const trimmed = value.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed.slice(1, -1).replace(/^"(.*)"$/, '$1');
  }
  return value;
}

// Extend Request interface for multer file uploads
interface RequestWithFile extends Request {
  file?: Express.Multer.File;
}
import { z } from "zod";
import { storage } from "./storage";
import { xmlParserService } from "./services/xmlParser";
import { skillsParserService } from "./services/skillsParser";
import { ResourceGroupsParser } from "./services/resourceGroupsParser";
import { csqsParserService } from "./services/csqsParser";
import { ResourcesParserService } from "./services/resourcesParser";
import { TeamsParserService } from "./services/teamsParser";
import { ApplicationsParserService } from "./services/applicationsParser";
import { TriggersParserService } from "./services/triggersParser";
import { migrationQueue } from "./services/migrationQueue";
import { UccxApiService } from "./services/uccxApi";
import { 
  insertConfigurationSchema, 
  insertUccxConnectionSchema,
  insertMigrationJobSchema,
  insertSkillSchema,
  insertResourceGroupSchema,
  insertCSQSchema,
  insertResourceSchema,
  insertTeamSchema,
  loginSchema,
  createUserSchema,
} from "@shared/schema";
import fs from "fs";
import path from "path";
import { xmlConverter } from "./utils/xmlConverter";
import { requireAuth, requireAdmin, requireProjectAccess, hasProjectPermission, hashPassword, comparePassword, toSafeUser, ProjectPermission, getRequestUserId, getRequestRole, generateAuthToken, removeAuthToken } from "./auth";

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype === 'text/xml' || file.mimetype === 'application/xml' || path.extname(file.originalname).toLowerCase() === '.xml') {
      cb(null, true);
    } else {
      cb(new Error('Only XML files are allowed'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // ============== Global Authentication Middleware ==============
  // Protect all /api/* routes except /api/auth/*
  app.use("/api", (req, res, next) => {
    // Skip auth check for auth endpoints
    if (req.path.startsWith("/auth")) {
      return next();
    }
    // Skip auth check for public branding (so login page can show custom branding)
    if (req.path === "/settings/branding" && req.method === "GET") {
      return next();
    }
    // Skip auth check for user management (has its own requireAdmin)
    if (req.path.startsWith("/users")) {
      return next();
    }
    // Apply requireAuth to all other API routes
    return requireAuth(req, res, next);
  });

  // ============== Authentication Routes ==============
  
  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      if (!user.isActive) {
        return res.status(401).json({ message: "Account is disabled" });
      }
      
      const isValidPassword = await comparePassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Update last login
      await storage.updateLastLogin(user.id);
      
      const token = generateAuthToken(user.id, user.role);
      
      req.session.userId = user.id;
      req.session.role = user.role;
      
      req.session.save((err) => {
        if (err) {
          console.error("Session save warning (token auth available):", err);
        }
        res.json({ user: toSafeUser(user), token, message: "Login successful" });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid login data", errors: error.errors });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  
  // Logout
  app.post("/api/auth/logout", (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      removeAuthToken(authHeader.substring(7));
    }
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logout successful" });
    });
  });
  
  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    const userId = getRequestUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const user = await storage.getUserById(userId);
      if (!user) {
        if (req.session?.userId) req.session.destroy(() => {});
        return res.status(401).json({ message: "User not found" });
      }
      res.json({ user: toSafeUser(user) });
    } catch (error) {
      console.error("Error fetching current user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  // ============== User Management Routes (Admin Only) ==============
  
  // Get all users
  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users.map(toSafeUser));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  // Create user
  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const userData = createUserSchema.parse(req.body);
      
      // Check if username exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash password
      const hashedPassword = await hashPassword(userData.password);
      
      const newUser = await storage.createUser({
        username: userData.username,
        password: hashedPassword,
        email: userData.email || null,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        role: userData.role || "user",
        isActive: userData.isActive !== false,
      });
      
      res.status(201).json(toSafeUser(newUser));
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });
  
  // Update user
  app.put("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // If password is being updated, hash it
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }
      
      const updated = await storage.updateUser(id, updateData);
      res.json(toSafeUser(updated));
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  
  // Delete user
  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Prevent deleting yourself
      if (id === getRequestUserId(req)) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // ============== Project Management Routes ==============
  
  // Get all projects for current user (owned + member)
  app.get("/api/projects", async (req, res) => {
    try {
      const userId = getRequestUserId(req)!;
      const projects = await storage.getProjectsForUser(userId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Get projects with stats for the projects list page
  app.get("/api/projects/with-stats", async (req, res) => {
    try {
      const userId = getRequestUserId(req)!;
      const projectsWithStats = await storage.getProjectsWithStats(userId);
      res.json(projectsWithStats);
    } catch (error) {
      console.error("Error fetching projects with stats:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Get single project
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const userId = getRequestUserId(req)!;
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if user has access to this project
      const permissions = await storage.getUserProjectPermissions(userId, project.id);
      if (!permissions) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Get user's permissions for a project
  app.get("/api/projects/:id/permissions", async (req, res) => {
    try {
      const userId = getRequestUserId(req)!;
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const permissions = await storage.getUserProjectPermissions(userId, project.id);
      if (!permissions) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json({
        projectId: project.id,
        isOwner: project.ownerId === userId,
        canView: permissions.canView,
        canManageConnections: permissions.canManageConnections,
        canImport: permissions.canImport,
        canUpdate: permissions.canUpdate,
        canMigrate: permissions.canMigrate,
        isAdmin: permissions.isAdmin,
      });
    } catch (error) {
      console.error("Error fetching project permissions:", error);
      res.status(500).json({ message: "Failed to fetch project permissions" });
    }
  });

  // Create project
  app.post("/api/projects", async (req, res) => {
    try {
      const userId = getRequestUserId(req)!;
      const { name, description } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Project name is required" });
      }

      const project = await storage.createProject({
        name: name.trim(),
        description: description?.trim() || null,
        ownerId: userId,
        isActive: true,
      });

      await storage.createAuditLog({
        level: 'info',
        category: 'project',
        source: 'create_project',
        message: `Created project: ${project.name}`,
        metadata: { projectId: project.id, projectName: project.name },
        userId,
        projectId: project.id,
      });

      res.status(201).json(project);
    } catch (error) {
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // Update project
  app.put("/api/projects/:id", async (req, res) => {
    try {
      const userId = getRequestUserId(req)!;
      const project = await storage.getProject(req.params.id);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if user has admin permission on this project
      const permissions = await storage.getUserProjectPermissions(userId, project.id);
      if (!permissions || !permissions.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { name, description, isActive, logLevel } = req.body;
      const updated = await storage.updateProject(project.id, {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
        ...(logLevel !== undefined && { logLevel }),
      });

      await storage.createAuditLog({
        level: 'info',
        category: 'project',
        source: 'update_project',
        message: `Updated project: ${updated.name}`,
        metadata: { projectId: updated.id, changes: req.body },
        userId,
        projectId: updated.id,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // Delete project
  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const userId = getRequestUserId(req)!;
      const project = await storage.getProject(req.params.id);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Only project owner can delete it
      if (project.ownerId !== userId) {
        return res.status(403).json({ message: "Only the project owner can delete this project" });
      }

      // Block deletion if the project still has configuration data or server connections.
      // Each item must be manually removed before the project can be deleted.
      const counts = await storage.getProjectBlockingCounts(project.id);
      const blocking = Object.entries(counts)
        .filter(([, n]) => n > 0)
        .map(([label, n]) => `${n} ${label}`);

      if (blocking.length > 0) {
        return res.status(409).json({
          message: `Cannot delete this project — it still contains ${blocking.join(', ')}. Please manually remove all configuration items and server connections before deleting the project.`,
        });
      }

      // Safe to delete — remove audit logs and members first, then the project
      await storage.deleteProjectAuditLogs(project.id);
      await storage.deleteProjectMembers(project.id);

      const deleted = await storage.deleteProject(project.id);
      if (!deleted) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // ============== Project Members Routes ==============
  
  // Get project members
  app.get("/api/projects/:projectId/members", async (req, res) => {
    try {
      const userId = getRequestUserId(req)!;
      const { projectId } = req.params;

      // Check if user has access to this project
      const permissions = await storage.getUserProjectPermissions(userId, projectId);
      if (!permissions) {
        return res.status(403).json({ message: "Access denied" });
      }

      const members = await storage.getProjectMembers(projectId);
      
      // Fetch user details for each member
      const membersWithDetails = await Promise.all(
        members.map(async (member) => {
          const user = await storage.getUserById(member.userId);
          return {
            ...member,
            user: user ? toSafeUser(user) : null,
          };
        })
      );

      // Also include the owner
      const project = await storage.getProject(projectId);
      if (project) {
        const owner = await storage.getUserById(project.ownerId);
        if (owner) {
          membersWithDetails.unshift({
            id: 'owner',
            projectId,
            userId: project.ownerId,
            canView: true,
            canManageConnections: true,
            canImport: true,
            canUpdate: true,
            canMigrate: true,
            isAdmin: true,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            user: toSafeUser(owner),
            isOwner: true,
          } as any);
        }
      }

      res.json(membersWithDetails);
    } catch (error) {
      console.error("Error fetching project members:", error);
      res.status(500).json({ message: "Failed to fetch project members" });
    }
  });

  // Add project member
  app.post("/api/projects/:projectId/members", async (req, res) => {
    try {
      const userId = getRequestUserId(req)!;
      const { projectId } = req.params;

      // Check if user has admin permission on this project
      const permissions = await storage.getUserProjectPermissions(userId, projectId);
      if (!permissions || !permissions.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { username, canView, canManageConnections, canImport, canUpdate, canMigrate, isAdmin } = req.body;

      if (!username || typeof username !== 'string') {
        return res.status(400).json({ message: "Username is required" });
      }

      // Find user by username
      const targetUser = await storage.getUserByUsername(username.trim());
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if this user is already a member
      const existingMember = await storage.getProjectMemberByUserAndProject(targetUser.id, projectId);
      if (existingMember) {
        return res.status(400).json({ message: "User is already a member of this project" });
      }

      // Check if user is the owner
      const project = await storage.getProject(projectId);
      if (project && project.ownerId === targetUser.id) {
        return res.status(400).json({ message: "Cannot add project owner as a member" });
      }

      const member = await storage.createProjectMember({
        projectId,
        userId: targetUser.id,
        canView: canView ?? true,
        canManageConnections: canManageConnections ?? false,
        canImport: canImport ?? false,
        canUpdate: canUpdate ?? false,
        canMigrate: canMigrate ?? false,
        isAdmin: isAdmin ?? false,
      });

      await storage.createAuditLog({
        level: 'info',
        category: 'project',
        source: 'add_project_member',
        message: `Added user ${targetUser.username} to project`,
        metadata: { projectId, memberId: member.id, targetUserId: targetUser.id },
        userId,
        projectId,
      });

      res.status(201).json({
        ...member,
        user: toSafeUser(targetUser),
      });
    } catch (error) {
      console.error("Error adding project member:", error);
      res.status(500).json({ message: "Failed to add project member" });
    }
  });

  // Update project member permissions (supports both PUT and PATCH)
  const updateMemberHandler = async (req: any, res: any) => {
    try {
      const userId = getRequestUserId(req)!;
      const { projectId, memberId } = req.params;

      // Check if user has admin permission on this project
      const permissions = await storage.getUserProjectPermissions(userId, projectId);
      if (!permissions || !permissions.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const member = await storage.getProjectMember(memberId);
      if (!member || member.projectId !== projectId) {
        return res.status(404).json({ message: "Member not found" });
      }

      const { canView, canManageConnections, canImport, canUpdate, canMigrate, isAdmin } = req.body;

      const updated = await storage.updateProjectMember(memberId, {
        ...(canView !== undefined && { canView }),
        ...(canManageConnections !== undefined && { canManageConnections }),
        ...(canImport !== undefined && { canImport }),
        ...(canUpdate !== undefined && { canUpdate }),
        ...(canMigrate !== undefined && { canMigrate }),
        ...(isAdmin !== undefined && { isAdmin }),
      });

      await storage.createAuditLog({
        level: 'info',
        category: 'project',
        source: 'update_project_member',
        message: `Updated member permissions`,
        metadata: { projectId, memberId, changes: req.body },
        userId,
        projectId,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating project member:", error);
      res.status(500).json({ message: "Failed to update project member" });
    }
  };
  
  app.put("/api/projects/:projectId/members/:memberId", updateMemberHandler);
  app.patch("/api/projects/:projectId/members/:memberId", updateMemberHandler);

  // Remove project member
  app.delete("/api/projects/:projectId/members/:memberId", async (req, res) => {
    try {
      const userId = getRequestUserId(req)!;
      const { projectId, memberId } = req.params;

      // Check if user has admin permission on this project
      const permissions = await storage.getUserProjectPermissions(userId, projectId);
      if (!permissions || !permissions.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const member = await storage.getProjectMember(memberId);
      if (!member || member.projectId !== projectId) {
        return res.status(404).json({ message: "Member not found" });
      }

      const deleted = await storage.deleteProjectMember(memberId);
      if (!deleted) {
        return res.status(404).json({ message: "Member not found" });
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'project',
        source: 'remove_project_member',
        message: `Removed member from project`,
        metadata: { projectId, memberId },
        userId,
        projectId,
      });

      res.json({ message: "Member removed successfully" });
    } catch (error) {
      console.error("Error removing project member:", error);
      res.status(500).json({ message: "Failed to remove project member" });
    }
  });

  // Dashboard statistics
  app.get("/api/statistics", async (req, res) => {
    try {
      const stats = await storage.getStatistics();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // Get project-specific statistics for dashboard
  app.get("/api/projects/:projectId/statistics", requireProjectAccess('view'), async (req, res) => {
    try {
      const projectId = req.projectId!;
      const stats = await storage.getProjectStatistics(projectId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching project statistics:", error);
      res.status(500).json({ message: "Failed to fetch project statistics" });
    }
  });

  // Configuration statistics
  app.get("/api/configurations/stats", requireProjectAccess('view'), async (req, res) => {
    try {
      const projectId = req.projectId!;
      const skills = await storage.getSkills({ projectId });
      const resourceGroups = await storage.getResourceGroups({ projectId });
      const csqsList = await storage.getCSQs({ projectId });
      const resourcesList = await storage.getResources({ projectId });
      const teamsList = await storage.getTeams({ projectId });
      const applicationsList = await storage.getApplications({ projectId });
      const triggersList = await storage.getTriggers({ projectId });
      const configurations = await storage.getConfigurations({ projectId, limit: 1000, offset: 0 });
      
      const agentsCount = configurations.filter(c => c.type === 'agents').length;
      const devicesCount = configurations.filter(c => c.type === 'devices').length;
      
      const stats = {
        skills: skills.length,
        resource_groups: resourceGroups.length,
        resources: resourcesList.length,
        teams: teamsList.length,
        agents: agentsCount,
        csqs: csqsList.length,
        applications: applicationsList.length,
        triggers: triggersList.length,
        devices: devicesCount,
        total: skills.length + resourceGroups.length + csqsList.length + resourcesList.length + teamsList.length + applicationsList.length + triggersList.length + agentsCount + devicesCount
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching configuration stats:", error);
      res.status(500).json({ message: "Failed to fetch configuration statistics" });
    }
  });

  // Configuration management
  app.get("/api/configurations", async (req, res) => {
    try {
      const { type, status, search, limit = 20, offset = 0 } = req.query;
      
      const filters = {
        type: type as string,
        status: status as string,
        search: search as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      const configurations = await storage.getConfigurations(filters);
      res.json(configurations);
    } catch (error) {
      console.error("Error fetching configurations:", error);
      res.status(500).json({ message: "Failed to fetch configurations" });
    }
  });

  app.get("/api/configurations/:id", async (req, res) => {
    try {
      const configuration = await storage.getConfiguration(req.params.id);
      if (!configuration) {
        return res.status(404).json({ message: "Configuration not found" });
      }
      res.json(configuration);
    } catch (error) {
      console.error("Error fetching configuration:", error);
      res.status(500).json({ message: "Failed to fetch configuration" });
    }
  });

  app.delete("/api/configurations/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteConfiguration(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Configuration not found" });
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Configuration deleted: ${req.params.id}`,
        source: 'API',
      });

      res.json({ message: "Configuration deleted successfully" });
    } catch (error) {
      console.error("Error deleting configuration:", error);
      res.status(500).json({ message: "Failed to delete configuration" });
    }
  });

  // ── Project Snapshots ─────────────────────────────────────────────────────

  // List snapshots
  app.get("/api/snapshots", requireProjectAccess('view'), async (req: any, res) => {
    try {
      const snapshots = await storage.listProjectSnapshots(req.projectId);
      // Omit heavy snapshotData from the list view
      res.json(snapshots.map(({ snapshotData, ...s }) => s));
    } catch (error) {
      console.error("Error listing snapshots:", error);
      res.status(500).json({ message: "Failed to list snapshots" });
    }
  });

  // Create snapshot manually
  app.post("/api/snapshots", requireProjectAccess('import'), async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      const name = req.body.name || `Manual snapshot — ${new Date().toLocaleString()}`;
      const snapshot = await storage.createProjectSnapshot(req.projectId, name, 'manual', userId);
      await storage.createAuditLog({
        level: 'info',
        category: 'import',
        message: `Project snapshot created: ${name}`,
        source: 'Snapshot',
        projectId: req.projectId,
      });
      const { snapshotData, ...safe } = snapshot;
      res.json(safe);
    } catch (error) {
      console.error("Error creating snapshot:", error);
      res.status(500).json({ message: "Failed to create snapshot" });
    }
  });

  // Delete snapshot
  app.delete("/api/snapshots/:id", requireProjectAccess('import'), async (req: any, res) => {
    try {
      const deleted = await storage.deleteProjectSnapshot(req.params.id, req.projectId);
      if (!deleted) return res.status(404).json({ message: "Snapshot not found" });
      res.json({ message: "Snapshot deleted" });
    } catch (error) {
      console.error("Error deleting snapshot:", error);
      res.status(500).json({ message: "Failed to delete snapshot" });
    }
  });

  // Restore snapshot
  app.post("/api/snapshots/:id/restore", requireProjectAccess('import'), async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      const snapshot = await storage.getProjectSnapshot(req.params.id, req.projectId);
      if (!snapshot) return res.status(404).json({ message: "Snapshot not found" });

      await storage.restoreProjectSnapshot(req.params.id, req.projectId);

      await storage.createAuditLog({
        level: 'warning',
        category: 'import',
        message: `Project restored from snapshot: ${snapshot.name}`,
        source: 'Snapshot',
        projectId: req.projectId,
        userId: userId || undefined,
      });

      res.json({ message: `Project successfully restored from snapshot: ${snapshot.name}` });
    } catch (error) {
      console.error("Error restoring snapshot:", error);
      res.status(500).json({ message: "Failed to restore snapshot" });
    }
  });

  // Multiple file upload and import
  app.post("/api/configurations/import-multiple", requireProjectAccess('import'), upload.array('xmlFiles', 20), async (req: any, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No XML files provided" });
      }

      const userId = getRequestUserId(req);
      const projectId = req.projectId;
      if (!projectId) {
        return res.status(400).json({ message: "Project ID is required for import" });
      }
      const { name, description, type, autoProcess = 'true', createBackup = 'false' } = req.body;
      const results = [];

      // Create a project snapshot before processing if requested
      if (createBackup === 'true') {
        const userId = getRequestUserId(req);
        const fileNames = (req.files as Express.Multer.File[]).map(f => f.originalname).join(', ');
        const snapshotName = `Pre-import snapshot — ${new Date().toLocaleString()} (${fileNames})`;
        await storage.createProjectSnapshot(projectId, snapshotName, 'pre-import', userId);
        await storage.createAuditLog({
          level: 'info',
          category: 'import',
          message: `Project snapshot created before import of: ${fileNames}`,
          source: 'Import',
          projectId,
        });
      }

      for (const file of req.files) {
        try {
          // Read and parse XML file
          const xmlContent = fs.readFileSync(file.path, 'utf8');
          
          let parsedData = null;
          let status: 'pending' | 'ready' | 'failed' = 'pending';

          if (autoProcess === 'true') {
            try {
              // First try to detect if this is a skills configuration
              const isSkillsConfig = xmlContent.includes('<skill>') || xmlContent.includes('<skills>') || 
                                   xmlContent.includes('skillName') || xmlContent.includes('skillId');
              
              if (isSkillsConfig) {
                // Parse as skills configuration
                const skillsData = await skillsParserService.parseSkillsXml(xmlContent);
                if (skillsData.length > 0) {
                  // Convert to database format and import skills directly
                  const skillsForDb = skillsParserService.prepareSkillsForDatabase(skillsData);
                  for (const skillData of skillsForDb) {
                    await storage.createSkill({ ...skillData, userId, projectId });
                  }
                  
                  await storage.createAuditLog({
                    level: 'info',
                    category: 'import',
                    message: `Skills imported: ${skillsData.length} skills from ${file.originalname}`,
                    source: 'SkillsParser',
                    projectId,
                  });
                  
                  // Skip regular configuration processing for skills
                  continue;
                }
              }

              // Check if this is a resource groups configuration
              const isResourceGroupsConfig = ResourceGroupsParser.detectResourceGroupsXml(xmlContent);
              
              if (isResourceGroupsConfig) {
                // Parse as resource groups configuration
                const resourceGroupsData = await ResourceGroupsParser.parseXml(xmlContent);
                if (resourceGroupsData.length > 0) {
                  // Import resource groups directly
                  for (const resourceGroupData of resourceGroupsData) {
                    await storage.createResourceGroup({ ...resourceGroupData, userId, projectId });
                  }
                  
                  await storage.createAuditLog({
                    level: 'info',
                    category: 'import',
                    message: `Resource groups imported: ${resourceGroupsData.length} resource groups from ${file.originalname}`,
                    source: 'ResourceGroupsParser',
                    projectId,
                  });
                  
                  // Skip regular configuration processing for resource groups
                  continue;
                }
              }

              // Check if this is a CSQs configuration
              const isCSQsConfig = xmlContent.includes('<csq>') || xmlContent.includes('<csqs>') || 
                                  xmlContent.includes('contact_service_queues');
              
              if (isCSQsConfig) {
                try {
                  console.log(`Attempting to parse CSQs from file: ${file.originalname}`);
                  // Parse as CSQs configuration
                  const csqsData = await csqsParserService.parseCSQsXml(xmlContent);
                  console.log(`Parsed CSQs data:`, csqsData);
                  
                  if (csqsData.length > 0) {
                    // Import CSQs and their skill/resource group mappings
                    for (const parsedCSQ of csqsData) {
                      console.log(`Creating CSQ:`, parsedCSQ.csq);
                      const createdCSQ = await storage.createCSQ({ ...parsedCSQ.csq, userId, projectId });
                      
                      // Create skill mappings (for SKILL_GROUP type CSQs)
                      for (const skill of parsedCSQ.skills) {
                        skill.csqId = createdCSQ.id; // Use the database ID, not the UCCX ID
                        console.log(`Creating CSQ skill mapping:`, skill);
                        await storage.createCSQSkill(skill);
                      }
                      
                      // Create resource group mappings (for RESOURCE_GROUP type CSQs)
                      if (parsedCSQ.resourceGroups) {
                        for (const resourceGroup of parsedCSQ.resourceGroups) {
                          resourceGroup.csqId = createdCSQ.id; // Use the database ID, not the UCCX ID
                          console.log(`Creating CSQ resource group mapping:`, resourceGroup);
                          await storage.createCSQResourceGroup(resourceGroup);
                        }
                      }
                    }
                    
                    await storage.createAuditLog({
                      level: 'info',
                      category: 'import',
                      message: `CSQs imported: ${csqsData.length} CSQs from ${file.originalname}`,
                      source: 'CSQsParser',
                      projectId,
                    });
                    
                    // Skip regular configuration processing for CSQs
                    results.push({
                      file: file.originalname,
                      status: 'success',
                      message: `Imported ${csqsData.length} CSQs with skill mappings`,
                      data: csqsData.map(d => d.csq)
                    });
                    continue;
                  } else {
                    console.log(`No CSQs found in file: ${file.originalname}`);
                  }
                } catch (csqError) {
                  console.error(`Error parsing CSQs from ${file.originalname}:`, csqError);
                  await storage.createAuditLog({
                    level: 'error',
                    category: 'import',
                    message: `CSQ parsing failed for ${file.originalname}: ${csqError instanceof Error ? csqError.message : 'Unknown error'}`,
                    source: 'CSQsParser',
                    projectId,
                  });
                }
              }

              // Check if this is a Resources configuration
              const isResourcesConfig = xmlContent.includes('<resource>') || xmlContent.includes('<resources>') || 
                                        xmlContent.includes('userId') || xmlContent.includes('userID');
              
              if (isResourcesConfig) {
                try {
                  console.log(`Attempting to parse Resources from file: ${file.originalname}`);
                  const parser = new ResourcesParserService();
                  const resourcesData = await parser.parseResourcesXml(xmlContent);
                  console.log(`Parsed Resources data:`, resourcesData);
                  
                  if (resourcesData.length > 0) {
                    // Import Resources and their skill mappings
                    for (const parsedResource of resourcesData) {
                      console.log(`Creating Resource:`, parsedResource.resource);
                      const createdResource = await storage.createResource({ ...parsedResource.resource, ownerId: userId, projectId });
                      
                      // Create skill mappings for this resource
                      for (const skill of parsedResource.skills) {
                        skill.resourceId = createdResource.id; // Use the database ID
                        console.log(`Creating Resource skill mapping:`, skill);
                        await storage.createResourceSkill(skill);
                      }
                    }
                    
                    await storage.createAuditLog({
                      level: 'info',
                      category: 'import',
                      message: `Resources imported: ${resourcesData.length} resources from ${file.originalname}`,
                      source: 'ResourcesParser',
                      projectId,
                    });
                    
                    // Skip regular configuration processing for Resources
                    results.push({
                      file: file.originalname,
                      status: 'success',
                      message: `Imported ${resourcesData.length} Resources with skill mappings`,
                      data: resourcesData.map((d: any) => d.resource)
                    });
                    continue;
                  } else {
                    console.log(`No Resources found in file: ${file.originalname}`);
                  }
                } catch (resourceError) {
                  console.error(`Error parsing Resources from ${file.originalname}:`, resourceError);
                  await storage.createAuditLog({
                    level: 'error',
                    category: 'import',
                    message: `Resources parsing failed for ${file.originalname}: ${resourceError instanceof Error ? resourceError.message : 'Unknown error'}`,
                    source: 'ResourcesParser',
                    projectId,
                  });
                }
              }

              // Check if this is a Teams configuration
              const isTeamsConfig = xmlContent.includes('<team>') || xmlContent.includes('<teams>') || 
                                   xmlContent.includes('teamName');
              
              if (isTeamsConfig) {
                try {
                  console.log(`Attempting to parse Teams from file: ${file.originalname}`);
                  const parser = new TeamsParserService();
                  const teamsData = await parser.parseTeamsXml(xmlContent);
                  console.log(`Parsed Teams data:`, teamsData);
                  
                  if (teamsData.length > 0) {
                    // Import Teams and their resource mappings
                    for (const parsedTeam of teamsData) {
                      console.log(`Creating Team:`, parsedTeam.team);
                      const createdTeam = await storage.createTeam({ ...parsedTeam.team, userId, projectId });
                      
                      // Create resource mappings for this team
                      for (const resource of parsedTeam.teamResources) {
                        resource.teamId = createdTeam.id; // Use the database ID
                        console.log(`Creating Team resource mapping:`, resource);
                        await storage.createTeamResource(resource);
                      }
                    }
                    
                    await storage.createAuditLog({
                      level: 'info',
                      category: 'import',
                      message: `Teams imported: ${teamsData.length} teams from ${file.originalname}`,
                      source: 'TeamsParser',
                      projectId,
                    });
                    
                    // Skip regular configuration processing for Teams
                    results.push({
                      file: file.originalname,
                      status: 'success',
                      message: `Imported ${teamsData.length} Teams with resource mappings`,
                      data: teamsData.map((d: any) => d.team)
                    });
                    continue;
                  } else {
                    console.log(`No Teams found in file: ${file.originalname}`);
                  }
                } catch (teamError) {
                  console.error(`Error parsing Teams from ${file.originalname}:`, teamError);
                  await storage.createAuditLog({
                    level: 'error',
                    category: 'import',
                    message: `Teams parsing failed for ${file.originalname}: ${teamError instanceof Error ? teamError.message : 'Unknown error'}`,
                    source: 'TeamsParser',
                    projectId,
                  });
                }
              }

              // Check if this is an Applications configuration
              const isApplicationsConfig = xmlContent.includes('<application>') || xmlContent.includes('<applications>') || 
                                          xmlContent.includes('applicationName');
              
              if (isApplicationsConfig) {
                try {
                  console.log(`Attempting to parse Applications from file: ${file.originalname}`);
                  const parser = new ApplicationsParserService();
                  const applicationsData = await parser.parseApplicationsXml(xmlContent);
                  console.log(`Parsed Applications data:`, applicationsData);
                  
                  if (applicationsData.length > 0) {
                    // Import Applications directly
                    for (const appData of applicationsData) {
                      console.log(`Creating Application:`, appData.application);
                      await storage.createApplication({ ...appData.application, userId, projectId });
                    }
                    
                    await storage.createAuditLog({
                      level: 'info',
                      category: 'import',
                      message: `Applications imported: ${applicationsData.length} applications from ${file.originalname}`,
                      source: 'ApplicationsParser',
                      projectId,
                    });
                    
                    // Skip regular configuration processing for Applications
                    results.push({
                      file: file.originalname,
                      status: 'success',
                      message: `Imported ${applicationsData.length} Applications`,
                      data: applicationsData
                    });
                    continue;
                  } else {
                    console.log(`No Applications found in file: ${file.originalname}`);
                  }
                } catch (appError) {
                  console.error(`Error parsing Applications from ${file.originalname}:`, appError);
                  await storage.createAuditLog({
                    level: 'error',
                    category: 'import',
                    message: `Applications parsing failed for ${file.originalname}: ${appError instanceof Error ? appError.message : 'Unknown error'}`,
                    source: 'ApplicationsParser',
                    projectId,
                  });
                }
              }

              // Check if this is a Triggers configuration
              const isTriggersConfig = xmlContent.includes('<trigger>') || xmlContent.includes('<triggers>') || 
                                      xmlContent.includes('directoryNumber') || xmlContent.includes('ctiPort');
              
              if (isTriggersConfig) {
                try {
                  console.log(`Attempting to parse Triggers from file: ${file.originalname}`);
                  const parser = new TriggersParserService();
                  const triggersData = await parser.parseTriggersXml(xmlContent);
                  console.log(`Parsed Triggers data:`, triggersData);
                  
                  if (triggersData.length > 0) {
                    // Import Triggers directly
                    for (const triggerData of triggersData) {
                      console.log(`Creating Trigger:`, triggerData.trigger);
                      await storage.createTrigger({ ...triggerData.trigger, userId, projectId });
                    }
                    
                    await storage.createAuditLog({
                      level: 'info',
                      category: 'import',
                      message: `Triggers imported: ${triggersData.length} triggers from ${file.originalname}`,
                      source: 'TriggersParser',
                      projectId,
                    });
                    
                    // Skip regular configuration processing for Triggers
                    results.push({
                      file: file.originalname,
                      status: 'success',
                      message: `Imported ${triggersData.length} Triggers`,
                      data: triggersData
                    });
                    continue;
                  } else {
                    console.log(`No Triggers found in file: ${file.originalname}`);
                  }
                } catch (triggerError) {
                  console.error(`Error parsing Triggers from ${file.originalname}:`, triggerError);
                  await storage.createAuditLog({
                    level: 'error',
                    category: 'import',
                    message: `Triggers parsing failed for ${file.originalname}: ${triggerError instanceof Error ? triggerError.message : 'Unknown error'}`,
                    source: 'TriggersParser',
                    projectId,
                  });
                }
              }
              
              // Regular UCCX configuration parsing
              parsedData = await xmlParserService.parseUccxConfiguration(xmlContent);
              
              // Validate parsed configuration
              const validation = xmlParserService.validateConfiguration(parsedData);
              if (!validation.isValid) {
                await storage.createAuditLog({
                  level: 'warning',
                  category: 'import',
                  message: `Configuration validation warnings for ${file.originalname}: ${validation.errors.join(', ')}`,
                  source: 'XMLParser',
                  projectId,
                });
              }

              status = 'ready';
            } catch (parseError) {
              await storage.createAuditLog({
                level: 'error',
                category: 'import',
                message: `XML parsing failed for ${file.originalname}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
                source: 'XMLParser',
                projectId,
              });
              
              status = 'failed';
            }
          }

          // Auto-detect configuration type if not provided
          const detectedType = parsedData ? xmlParserService.detectConfigurationType(parsedData) : 'full_system';
          
          // Create configuration record
          const configData = {
            name: name || file.originalname,
            description: description || `Imported from ${file.originalname}`,
            type: type || detectedType,
            status,
            xmlData: { content: xmlContent },
            parsedData,
            filePath: file.path,
            userId,
            projectId,
          };

          const configuration = await storage.createConfiguration(configData);
          results.push({
            file: file.originalname,
            status: status === 'failed' ? 'error' : 'success',
            message: status === 'failed' ? `Failed to parse XML in ${file.originalname}` : `Configuration imported: ${configuration.name}`,
            configurationId: configuration.id,
          });

          await storage.createAuditLog({
            level: status === 'failed' ? 'error' : 'info',
            category: 'import',
            message: status === 'failed' ? `XML parse failed for ${file.originalname}` : `Configuration imported: ${configuration.name}`,
            source: 'API',
            metadata: { configurationId: configuration.id },
            projectId,
          });
        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          // Log the error instead of pushing to results since we can't mix types
          await storage.createAuditLog({
            level: 'error',
            category: 'import',
            message: `File processing failed for ${file.originalname}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            source: 'API',
            projectId,
          });
        } finally {
          // Clean up uploaded file
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }

      const failedResults = results.filter((r: any) => r.status === 'error');
      const successfulResults = results.filter((r: any) => r.status === 'success');
      res.json({ 
        message: failedResults.length > 0 
          ? `Processed ${results.length} files: ${successfulResults.length} succeeded, ${failedResults.length} failed`
          : `Successfully processed ${results.length} files`,
        results,
        successful: successfulResults.length,
        failed: failedResults.length,
        errors: failedResults.map((r: any) => r.message),
      });
    } catch (error) {
      console.error("Error importing configurations:", error);
      
      // Clean up any uploaded files
      if (req.files) {
        req.files.forEach((file: any) => {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      
      res.status(500).json({ message: "Failed to import configurations" });
    }
  });

  // Single file upload and import (keeping for backward compatibility)
  app.post("/api/configurations/import", requireProjectAccess('import'), upload.single('xmlFile'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No XML file provided" });
      }

      const userId = getRequestUserId(req);
      const projectId = req.projectId;
      if (!projectId) {
        return res.status(400).json({ message: "Project ID is required for import" });
      }
      const { name, description, type, autoProcess = 'true' } = req.body;

      // Read and parse XML file
      const xmlContent = fs.readFileSync(req.file.path, 'utf8');
      
      let parsedData = null;
      let status: 'pending' | 'ready' | 'failed' = 'pending';

      if (autoProcess === 'true') {
        try {
          parsedData = await xmlParserService.parseUccxConfiguration(xmlContent);
          
          // Validate parsed configuration
          const validation = xmlParserService.validateConfiguration(parsedData);
          if (!validation.isValid) {
            await storage.createAuditLog({
              level: 'warning',
              category: 'import',
              message: `Configuration validation warnings: ${validation.errors.join(', ')}`,
              source: 'XMLParser',
              projectId,
            });
          }

          status = 'ready';
        } catch (parseError) {
          await storage.createAuditLog({
            level: 'error',
            category: 'import',
            message: `XML parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
            source: 'XMLParser',
            projectId,
          });
          
          status = 'failed';
        }
      }

      // Auto-detect configuration type if not provided
      const detectedType = parsedData ? xmlParserService.detectConfigurationType(parsedData) : 'full_system';
      
      // Create configuration record
      const configData = {
        name: name || req.file.originalname,
        description: description || `Imported from ${req.file.originalname}`,
        type: type || detectedType,
        status,
        xmlData: { content: xmlContent },
        parsedData,
        filePath: req.file.path,
        userId,
        projectId,
      };

      const configuration = await storage.createConfiguration(configData);

      await storage.createAuditLog({
        level: 'info',
        category: 'import',
        message: `Configuration imported: ${configuration.name}`,
        source: 'API',
        metadata: { configurationId: configuration.id },
        projectId,
      });

      res.json(configuration);
    } catch (error) {
      console.error("Error importing configuration:", error);
      res.status(500).json({ message: "Failed to import configuration" });
    } finally {
      // Clean up uploaded file
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
  });

  // Reset database - clear current user's configuration data only
  app.post("/api/configurations/reset", requireProjectAccess('update'), async (req, res) => {
    try {
      const userId = getRequestUserId(req);
      const projectId = req.projectId!;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Delete project's configuration data in the correct order to respect foreign keys
      // Note: deleteProjectCSQs, deleteProjectResources, deleteProjectTeams handle their child tables
      await storage.deleteProjectTriggers(projectId);
      await storage.deleteProjectApplications(projectId);
      await storage.deleteProjectTeams(projectId);
      await storage.deleteProjectResources(projectId);
      await storage.deleteProjectCSQs(projectId);
      await storage.deleteProjectResourceGroups(projectId);
      await storage.deleteProjectSkills(projectId);
      await storage.deleteProjectConfigurations(projectId);
      await storage.deleteProjectMigrationJobs(projectId);

      const user = await storage.getUserById(userId);
      const project = await storage.getProject(projectId);
      await storage.createAuditLog({
        level: 'warning',
        category: 'system',
        message: `Database reset: Configuration data deleted for project ${project?.name || projectId} by user ${user?.username || userId}`,
        userId: userId,
        projectId: projectId,
        source: 'API',
      });

      res.json({ message: "Database reset successful", deleted: true });
    } catch (error) {
      console.error("Error resetting database:", error);
      await storage.createAuditLog({
        level: 'error',
        category: 'system',
        message: `Database reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'API',
      });
      res.status(500).json({ 
        message: "Failed to reset database",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Admin-only: Reset ALL database data (all users)
  app.post("/api/configurations/reset-all", requireAdmin, async (req, res) => {
    try {
      // Delete all configuration data in the correct order to respect foreign keys
      await storage.deleteAllTriggers();
      await storage.deleteAllApplications();
      await storage.deleteAllTeamResources();
      await storage.deleteAllResourceSkills();
      await storage.deleteAllTeams();
      await storage.deleteAllResources();
      await storage.deleteAllCSQs();
      await storage.deleteAllResourceGroups();
      await storage.deleteAllSkills();
      await storage.deleteAllConfigurations();

      const reqUserId = getRequestUserId(req);
      const user = reqUserId ? await storage.getUserById(reqUserId) : null;
      await storage.createAuditLog({
        level: 'warning',
        category: 'system',
        message: `ADMIN database reset: ALL configuration data deleted by ${user?.username || 'admin'}`,
        userId: reqUserId,
        source: 'API',
      });

      res.json({ message: "All database configuration data reset successful", deleted: true });
    } catch (error) {
      console.error("Error resetting all database:", error);
      await storage.createAuditLog({
        level: 'error',
        category: 'system',
        message: `Admin database reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'API',
      });
      res.status(500).json({ 
        message: "Failed to reset all database",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // API-based import from source UCCX system
  app.post("/api/configurations/import-from-api", async (req, res) => {
    try {
      const userId = getRequestUserId(req);
      const { sourceConnectionId, configTypes, createBackup } = req.body;
      
      if (!sourceConnectionId) {
        return res.status(400).json({ message: "Source connection ID is required" });
      }

      const connection = await storage.getUccxConnection(sourceConnectionId);
      if (!connection) {
        return res.status(404).json({ message: "UCCX connection not found" });
      }

      if (!connection.isSource) {
        return res.status(400).json({ message: "Selected connection is not configured as a source system" });
      }

      const uccxApiService = new UccxApiService(connection);
      const projectId = connection.projectId;

      // Create project snapshot before API import if requested
      if (createBackup && projectId) {
        const typeList = (configTypes && configTypes.length > 0 ? configTypes : ['all']).join(', ');
        const snapshotName = `Pre-import snapshot — ${new Date().toLocaleString()} (API: ${connection.name}, types: ${typeList})`;
        await storage.createProjectSnapshot(projectId, snapshotName, 'pre-import', userId);
        await storage.createAuditLog({
          level: 'info',
          category: 'import',
          message: `Project snapshot created before API import from: ${connection.name}`,
          source: 'Import',
          projectId,
        });
      }

      // Determine which config types to import (all or selective)
      const typesToImport = configTypes && configTypes.length > 0 ? configTypes : 
        ['skills', 'resourceGroups', 'csqs', 'resources', 'teams', 'applications', 'triggers'];
      
      const results: any = {
        skills: { imported: 0, updated: 0, failed: 0 },
        resourceGroups: { imported: 0, updated: 0, failed: 0 },
        csqs: { imported: 0, updated: 0, failed: 0 },
        resources: { imported: 0, updated: 0, failed: 0 },
        teams: { imported: 0, updated: 0, failed: 0 },
        applications: { imported: 0, updated: 0, failed: 0 },
        triggers: { imported: 0, updated: 0, failed: 0 },
      };

      // Import Skills
      if (typesToImport.includes('skills')) {
        try {
          // Fetch raw XML from UCCX API
          const skillsXml = await uccxApiService.fetchSkillsXml();
          
          // Parse XML using the same parser as file import
          const skillsData = await skillsParserService.parseSkillsXml(skillsXml);
          
          // Convert to database format and import
          const skillsForDb = skillsParserService.prepareSkillsForDatabase(skillsData, sourceConnectionId);
          for (const skillData of skillsForDb) {
            try {
              const existingSkill = await storage.getSkillBySkillId(skillData.skillId, sourceConnectionId);
              if (existingSkill) {
                await storage.updateSkill(existingSkill.id, skillData);
                results.skills.updated++;
              } else {
                await storage.createSkill({ ...skillData, userId, projectId });
                results.skills.imported++;
              }
            } catch (error) {
              console.error(`Error importing skill ${skillData.skillId}:`, error);
              results.skills.failed++;
            }
          }
        } catch (error) {
          console.error('Error fetching/parsing skills:', error);
        }
      }

      // Import Resource Groups
      if (typesToImport.includes('resourceGroups')) {
        try {
          // Fetch raw XML from UCCX API
          const rgXml = await uccxApiService.fetchResourceGroupsXml();
          
          // Parse XML using the same parser as file import
          const rgData = await ResourceGroupsParser.parseXml(rgXml);
          
          // Import to database
          for (const rg of rgData) {
            try {
              // Add sourceConnectionId
              rg.sourceConnectionId = sourceConnectionId;
              
              const existing = await storage.getResourceGroupByResourceGroupId(rg.resourceGroupId, sourceConnectionId);
              if (existing) {
                await storage.updateResourceGroup(existing.id, rg);
                results.resourceGroups.updated++;
              } else {
                await storage.createResourceGroup({ ...rg, userId, projectId });
                results.resourceGroups.imported++;
              }
            } catch (error) {
              console.error(`Error importing resource group ${rg.resourceGroupId}:`, error);
              results.resourceGroups.failed++;
            }
          }
        } catch (error) {
          console.error('Error fetching/parsing resource groups:', error);
        }
      }

      // Import CSQs
      if (typesToImport.includes('csqs')) {
        try {
          // Fetch raw XML from UCCX API
          const csqsXml = await uccxApiService.fetchCSQsXml();
          
          // Parse XML using the same parser as file import
          const csqsData = await csqsParserService.parseCSQsXml(csqsXml);
          
          // Import CSQs and their skill/resource group mappings
          for (const parsedCSQ of csqsData) {
            try {
              // Add sourceConnectionId to CSQ
              parsedCSQ.csq.sourceConnectionId = sourceConnectionId;
              
              const existing = await storage.getCSQByCSQId(parsedCSQ.csq.csqId, sourceConnectionId);
              let createdCSQ;
              if (existing) {
                await storage.updateCSQ(existing.id, parsedCSQ.csq);
                createdCSQ = existing;
                results.csqs.updated++;
              } else {
                createdCSQ = await storage.createCSQ({ ...parsedCSQ.csq, userId, projectId });
                results.csqs.imported++;
              }
              
              // Create skill mappings (for SKILL_GROUP type CSQs)
              for (const skill of parsedCSQ.skills) {
                skill.csqId = createdCSQ.id; // Use the database ID
                await storage.createCSQSkill(skill);
              }
              
              // Create resource group mappings (for RESOURCE_GROUP type CSQs)
              if (parsedCSQ.resourceGroups) {
                for (const resourceGroup of parsedCSQ.resourceGroups) {
                  resourceGroup.csqId = createdCSQ.id; // Use the database ID
                  await storage.createCSQResourceGroup(resourceGroup);
                }
              }
            } catch (error) {
              console.error(`Error importing CSQ ${parsedCSQ.csq.csqId}:`, error);
              results.csqs.failed++;
            }
          }
        } catch (error) {
          console.error('Error fetching/parsing CSQs:', error);
        }
      }

      // Import Resources
      if (typesToImport.includes('resources')) {
        try {
          // Fetch raw XML from UCCX API
          const resourcesXml = await uccxApiService.fetchResourcesXml();
          
          // Parse XML using the same parser as file import
          const resourcesParserService = new ResourcesParserService();
          const resourcesData = await resourcesParserService.parseResourcesXml(resourcesXml);
          
          // Import resources and their skill mappings
          for (const parsedResource of resourcesData) {
            try {
              // Add sourceConnectionId
              parsedResource.resource.sourceConnectionId = sourceConnectionId;
              
              const existing = await storage.getResourceByUserID(parsedResource.resource.userID, sourceConnectionId);
              let createdResource;
              if (existing) {
                await storage.updateResource(existing.id, parsedResource.resource);
                createdResource = existing;
                results.resources.updated++;
              } else {
                createdResource = await storage.createResource({ ...parsedResource.resource, ownerId: userId, projectId });
                results.resources.imported++;
              }
              
              // Create skill mappings
              for (const skill of parsedResource.skills) {
                skill.resourceId = createdResource.id; // Use the database ID
                await storage.createResourceSkill(skill);
              }
            } catch (error) {
              console.error(`Error importing resource ${parsedResource.resource.userID}:`, error);
              results.resources.failed++;
            }
          }
        } catch (error) {
          console.error('Error fetching/parsing resources:', error);
        }
      }

      // Import Teams
      if (typesToImport.includes('teams')) {
        try {
          // Fetch raw XML from UCCX API
          const teamsXml = await uccxApiService.fetchTeamsXml();
          
          // Parse XML using the same parser as file import
          const teamsParserService = new TeamsParserService();
          const teamsData = await teamsParserService.parseTeamsXml(teamsXml);
          
          // Import teams and their resource mappings
          for (const parsedTeam of teamsData) {
            try {
              // Add sourceConnectionId
              parsedTeam.team.sourceConnectionId = sourceConnectionId;
              
              const existing = await storage.getTeamByTeamId(parsedTeam.team.teamId, sourceConnectionId);
              let createdTeam;
              if (existing) {
                await storage.updateTeam(existing.id, parsedTeam.team);
                createdTeam = existing;
                results.teams.updated++;
              } else {
                createdTeam = await storage.createTeam({ ...parsedTeam.team, userId, projectId });
                results.teams.imported++;
              }
              
              // Create team resource mappings
              for (const teamResource of parsedTeam.teamResources) {
                teamResource.teamId = createdTeam.id; // Use the database ID
                await storage.createTeamResource(teamResource);
              }
            } catch (error) {
              console.error(`Error importing team ${parsedTeam.team.teamId}:`, error);
              results.teams.failed++;
            }
          }
        } catch (error) {
          console.error('Error fetching/parsing teams:', error);
        }
      }

      // Import Applications
      if (typesToImport.includes('applications')) {
        try {
          // Fetch raw XML from UCCX API
          const appsXml = await uccxApiService.fetchApplicationsXml();
          
          // Parse XML using the same parser as file import
          const appsParserService = new ApplicationsParserService();
          const appsData = await appsParserService.parseApplicationsXml(appsXml);
          
          // Import applications
          for (const parsedApp of appsData) {
            try {
              // Add sourceConnectionId
              parsedApp.application.sourceConnectionId = sourceConnectionId;
              
              const existing = await storage.getApplicationByName(parsedApp.application.applicationName, sourceConnectionId);
              if (existing) {
                await storage.updateApplication(existing.id, parsedApp.application);
                results.applications.updated++;
              } else {
                await storage.createApplication({ ...parsedApp.application, userId, projectId });
                results.applications.imported++;
              }
            } catch (error) {
              console.error(`Error importing application ${parsedApp.application.applicationName}:`, error);
              results.applications.failed++;
            }
          }
        } catch (error) {
          console.error('Error fetching/parsing applications:', error);
        }
      }

      // Import Triggers
      if (typesToImport.includes('triggers')) {
        try {
          // Fetch raw XML from UCCX API
          const triggersXml = await uccxApiService.fetchTriggersXml();
          
          // Parse XML using the same parser as file import
          const triggersParserService = new TriggersParserService();
          const triggersData = await triggersParserService.parseTriggersXml(triggersXml);
          
          // Import triggers
          for (const parsedTrigger of triggersData) {
            try {
              // Add sourceConnectionId
              parsedTrigger.trigger.sourceConnectionId = sourceConnectionId;
              
              const existing = await storage.getTriggerByDirectoryNumber(parsedTrigger.trigger.directoryNumber, sourceConnectionId);
              if (existing) {
                await storage.updateTrigger(existing.id, parsedTrigger.trigger);
                results.triggers.updated++;
              } else {
                await storage.createTrigger({ ...parsedTrigger.trigger, userId, projectId });
                results.triggers.imported++;
              }
            } catch (error) {
              console.error(`Error importing trigger ${parsedTrigger.trigger.directoryNumber}:`, error);
              results.triggers.failed++;
            }
          }
        } catch (error) {
          console.error('Error fetching/parsing triggers:', error);
        }
      }

      // Create audit log
      await storage.createAuditLog({
        level: 'info',
        category: 'import',
        message: `API-based import completed from ${connection.name}`,
        source: 'API',
        metadata: { results, sourceConnectionId },
      });

      res.json({
        message: "API import completed",
        results,
        sourceConnection: connection.name,
      });
    } catch (error) {
      console.error("Error in API-based import:", error);
      await storage.createAuditLog({
        level: 'error',
        category: 'import',
        message: `API-based import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'API',
      });
      res.status(500).json({ 
        message: "Failed to import from API",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // UCCX connection management
  app.get("/api/connections", async (req, res) => {
    try {
      const { projectId } = req.query;
      
      if (!projectId) {
        return res.status(400).json({ message: "Project ID is required" });
      }

      const connections = await storage.getUccxConnections({ projectId: projectId as string });
      // Remove passwords from response
      const safeConnections = connections.map(conn => ({
        ...conn,
        password: '***',
      }));
      res.json(safeConnections);
    } catch (error) {
      console.error("Error fetching connections:", error);
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  // Get target systems only (non-source connections)
  app.get("/api/uccx-connections/target", requireProjectAccess('manageConnections'), async (req, res) => {
    try {
      const connections = await storage.getUccxConnections({ isSource: false, projectId: req.projectId! });
      // Remove passwords from response
      const safeConnections = connections.map(conn => ({
        ...conn,
        password: '***',
      }));
      res.json(safeConnections);
    } catch (error) {
      console.error("Error fetching target connections:", error);
      res.status(500).json({ message: "Failed to fetch target connections" });
    }
  });

  // Get source systems only
  app.get("/api/uccx-connections/source", requireProjectAccess('manageConnections'), async (req, res) => {
    try {
      const connections = await storage.getUccxConnections({ isSource: true, projectId: req.projectId! });
      // Remove passwords from response
      const safeConnections = connections.map(conn => ({
        ...conn,
        password: '***',
      }));
      res.json(safeConnections);
    } catch (error) {
      console.error("Error fetching source connections:", error);
      res.status(500).json({ message: "Failed to fetch source connections" });
    }
  });

  // Create UCCX connection (target system)
  app.post("/api/uccx-connections", requireProjectAccess('manageConnections'), async (req, res) => {
    try {
      const connectionData = insertUccxConnectionSchema.parse({ ...req.body, projectId: req.projectId });
      const connection = await storage.createUccxConnection(connectionData);

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `UCCX connection created: ${connection.name}`,
        source: 'API',
      });

      // Remove password from response
      const safeConnection = { ...connection, password: '***' };
      res.json(safeConnection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid connection data", errors: error.errors });
      }
      console.error("Error creating connection:", error);
      res.status(500).json({ message: "Failed to create connection" });
    }
  });

  // Update UCCX connection
  app.put("/api/uccx-connections/:id", requireProjectAccess('manageConnections'), async (req, res) => {
    try {
      const { id } = req.params;
      const connectionData = insertUccxConnectionSchema.partial().parse(req.body);
      
      const existingConnection = await storage.getUccxConnection(id);
      if (!existingConnection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      if (existingConnection.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this connection" });
      }

      const connection = await storage.updateUccxConnection(id, connectionData);

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `UCCX connection updated: ${connection.name}`,
        source: 'API',
        projectId: req.projectId,
      });

      // Remove password from response
      const safeConnection = { ...connection, password: '***' };
      res.json(safeConnection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid connection data", errors: error.errors });
      }
      console.error("Error updating connection:", error);
      res.status(500).json({ message: "Failed to update connection" });
    }
  });

  // Delete UCCX connection
  app.delete("/api/uccx-connections/:id", requireProjectAccess('manageConnections'), async (req, res) => {
    try {
      const { id } = req.params;
      
      const connection = await storage.getUccxConnection(id);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      if (connection.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this connection" });
      }

      await storage.deleteUccxConnection(id);

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `UCCX connection deleted: ${connection.name}`,
        source: 'API',
        projectId: req.projectId,
      });

      res.json({ message: "Connection deleted successfully" });
    } catch (error) {
      console.error("Error deleting connection:", error);
      res.status(500).json({ message: "Failed to delete connection" });
    }
  });

  // Test UCCX connection
  app.post("/api/uccx-connections/:id/test", requireProjectAccess('manageConnections'), async (req, res) => {
    try {
      const connection = await storage.getUccxConnection(req.params.id);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      if (connection.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this connection" });
      }

      const uccxApi = new UccxApiService({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        useHttps: connection.useHttps ?? true,
      });

      const start = Date.now();
      const result = await uccxApi.testConnection();
      const responseTime = Date.now() - start;

      const testResult = {
        success: result.success,
        message: result.message,
        serverInfo: result.success ? `${connection.host}:${connection.port}` : undefined,
        responseTime,
      };

      await storage.createAuditLog({
        level: testResult.success ? 'info' : 'warning',
        category: 'api',
        message: `Connection test ${testResult.success ? 'successful' : 'failed'}: ${connection.name} — ${result.message}`,
        source: 'API',
      });

      if (!testResult.success) {
        return res.status(502).json({ message: result.message });
      }

      res.json(testResult);
    } catch (error) {
      console.error("Error testing connection:", error);
      res.status(500).json({ message: "Connection test failed" });
    }
  });

  app.post("/api/connections", async (req, res) => {
    try {
      const connectionData = insertUccxConnectionSchema.parse(req.body);
      const connection = await storage.createUccxConnection(connectionData);

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `UCCX connection created: ${connection.name}`,
        source: 'API',
      });

      // Remove password from response
      const safeConnection = { ...connection, password: '***' };
      res.json(safeConnection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid connection data", errors: error.errors });
      }
      console.error("Error creating connection:", error);
      res.status(500).json({ message: "Failed to create connection" });
    }
  });

  app.post("/api/connections/:id/test", async (req, res) => {
    try {
      const connection = await storage.getUccxConnection(req.params.id);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      const uccxApi = new UccxApiService({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        useHttps: true,
      });

      const testResult = await uccxApi.testConnection();
      
      await storage.createAuditLog({
        level: testResult.success ? 'info' : 'warning',
        category: 'api',
        message: `Connection test ${testResult.success ? 'successful' : 'failed'}: ${connection.name}`,
        source: 'API',
      });

      res.json(testResult);
    } catch (error) {
      console.error("Error testing connection:", error);
      res.status(500).json({ message: "Failed to test connection" });
    }
  });

  // Migration job management
  app.get("/api/migrations", requireProjectAccess('migrate'), async (req, res) => {
    try {
      const { status, configurationId, limit = 20, offset = 0 } = req.query;

      const filters = {
        projectId: req.projectId!,
        status: status as string,
        configurationId: configurationId as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      const migrations = await storage.getMigrationJobs(filters);
      res.json(migrations);
    } catch (error) {
      console.error("Error fetching migrations:", error);
      res.status(500).json({ message: "Failed to fetch migrations" });
    }
  });

  app.get("/api/migrations/active", async (req, res) => {
    try {
      // Query DB for active + recently-finished jobs (grace period of 60s)
      const dbJobs = await storage.getActiveMigrationJobs(60000);

      // Overlay real-time in-memory progress for currently running jobs
      const inMemoryMap = new Map(
        migrationQueue.getAllActiveJobs().map((j) => [j.id, j])
      );

      const merged = dbJobs.map((job) => {
        const live = inMemoryMap.get(job.id);
        if (live) {
          return {
            ...job,
            status: live.status,
            progress: live.progress,
            message: live.message,
            // live.error takes priority; fall back to DB errorMessage
            error: live.error ?? job.errorMessage ?? undefined,
            startedAt: live.startedAt ?? job.startedAt,
            completedAt: live.completedAt ?? job.completedAt,
          };
        }
        // DB-only job: expose errorMessage as error for the frontend
        return { ...job, error: job.errorMessage ?? undefined };
      });

      res.json(merged);
    } catch (error) {
      console.error("Error fetching active migrations:", error);
      res.status(500).json({ message: "Failed to fetch active migrations" });
    }
  });

  app.post("/api/migrations", requireProjectAccess('migrate'), async (req, res) => {
    try {
      console.log('Received migration job request body:', JSON.stringify(req.body, null, 2));
      
      // Handle migration tab format (configurationItems) vs skills page format (settings.type)
      let jobData = req.body;
      
      if (req.body.configurationItems) {
        // Migration tab format — configurationItems is now an array of selected types
        const raw = req.body.configurationItems;
        const selectedTypes: string[] = Array.isArray(raw) ? raw : [raw];
        console.log(`Migration tab request for: ${selectedTypes.join(', ')}`);

        if (selectedTypes.length === 0) {
          return res.status(400).json({ message: "Select at least one configuration type to migrate." });
        }

        const has = (t: string) => selectedTypes.includes(t);
        const tid = req.body.targetConnectionId;

        let skills: any[] = [];
        let resourceGroups: any[] = [];
        let csqs: any[] = [];
        let resources: any[] = [];
        let teams: any[] = [];
        let applications: any[] = [];
        let triggers: any[] = [];

        // Fetch items based on selected types
        if (has('skills')) {
          skills = (await storage.getSkills()).map((s: any) => ({ ...s, targetConnectionId: tid }));
        }
        if (has('resource_groups')) {
          resourceGroups = (await storage.getResourceGroups()).map((rg: any) => ({ ...rg, targetConnectionId: tid }));
        }
        if (has('csqs')) {
          csqs = (await storage.getCSQs()).map((csq: any) => ({ ...csq, targetConnectionId: tid }));
        }
        if (has('resources')) {
          resources = (await storage.getResources()).map((r: any) => ({ ...r, targetConnectionId: tid }));
        }
        if (has('teams')) {
          teams = (await storage.getTeams()).map((t: any) => ({ ...t, targetConnectionId: tid }));
        }
        if (has('applications')) {
          applications = (await storage.getApplications()).map((a: any) => ({ ...a, targetConnectionId: tid }));
        }
        if (has('triggers')) {
          triggers = await storage.getTriggers();
          console.log('Fetched triggers from database:', triggers.length, 'triggers found');
          if (triggers.length === 0) console.log('WARNING: No triggers found in database!');
          triggers = triggers.map((tr: any) => ({ ...tr, targetConnectionId: tid }));
        }

        // Validate: if a type was exclusively selected and it has no data, reject early
        const only = selectedTypes.length === 1;
        if (only && has('skills')          && skills.length === 0)          return res.status(400).json({ message: "No skills found in database. Please import skills first." });
        if (only && has('resource_groups') && resourceGroups.length === 0)  return res.status(400).json({ message: "No resource groups found in database. Please import resource groups first." });
        if (only && has('csqs')            && csqs.length === 0)            return res.status(400).json({ message: "No CSQs found in database. Please import CSQs first." });
        if (only && has('resources')       && resources.length === 0)       return res.status(400).json({ message: "No resources found in database. Please import resources first." });
        if (only && has('teams')           && teams.length === 0)           return res.status(400).json({ message: "No teams found in database. Please import teams first." });
        if (only && has('applications')    && applications.length === 0)    return res.status(400).json({ message: "No applications found in database. Please import applications first." });
        if (only && has('triggers')        && triggers.length === 0)        return res.status(400).json({ message: "No triggers found in database. Please import triggers first." });

        // Transform to migration queue format — always use 'configuration' type so the
        // queue processor runs all selected types in dependency order
        jobData = {
          configurationId: null,
          targetConnectionId: tid,
          projectId: req.projectId,
          userId: req.authUserId,
          status: 'pending' as const,
          progress: 0,
          settings: {
            type: 'configuration',
            skills:          skills.length > 0          ? skills          : undefined,
            resourceGroups:  resourceGroups.length > 0  ? resourceGroups  : undefined,
            csqs:            csqs.length > 0            ? csqs            : undefined,
            resources:       resources.length > 0       ? resources       : undefined,
            teams:           teams.length > 0           ? teams           : undefined,
            applications:    applications.length > 0    ? applications    : undefined,
            triggers:        triggers.length > 0        ? triggers        : undefined,
            options: {
              dryRun:            req.body.settings?.migrationType === 'dry_run',
              createBackup:      req.body.settings?.createBackup || false,
              overrideExisting:  req.body.settings?.migrationType === 'full',
            },
          },
        };
      }
      
      console.log('Job data before parsing:', JSON.stringify(jobData, null, 2));
      console.log('Job data settings:', JSON.stringify(jobData.settings, null, 2));
      console.log('Job data settings.type:', jobData.settings?.type);
      console.log('Job data settings.triggers exists:', !!jobData.settings?.triggers, 'length:', jobData.settings?.triggers?.length);
      
      const parsedJobData = insertMigrationJobSchema.parse(jobData);
      console.log('Parsed migration job data:', JSON.stringify(parsedJobData, null, 2));
      console.log('Parsed settings:', JSON.stringify(parsedJobData.settings, null, 2));
      
      const migrationJob = await migrationQueue.createMigrationJob(parsedJobData);
      res.json(migrationJob);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid migration job data", errors: error.errors });
      }
      console.error("Error creating migration job:", error);
      res.status(500).json({ message: "Failed to create migration job" });
    }
  });

  app.post("/api/migrations/:id/cancel", requireProjectAccess('migrate'), async (req, res) => {
    try {
      const cancelled = await migrationQueue.cancelMigrationJob(req.params.id);
      if (!cancelled) {
        return res.status(404).json({ message: "Migration job not found or cannot be cancelled" });
      }
      res.json({ message: "Migration job cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling migration job:", error);
      res.status(500).json({ message: "Failed to cancel migration job" });
    }
  });

  app.get("/api/migrations/:id/status", requireProjectAccess('migrate'), async (req, res) => {
    try {
      const jobStatus = migrationQueue.getJobStatus(req.params.id);
      if (!jobStatus) {
        return res.status(404).json({ message: "Migration job not found" });
      }
      res.json(jobStatus);
    } catch (error) {
      console.error("Error fetching migration status:", error);
      res.status(500).json({ message: "Failed to fetch migration status" });
    }
  });

  // Skills management
  app.get("/api/skills", requireProjectAccess('view'), async (req, res) => {
    try {
      const { sourceConnectionId, search, isActive, limit = 100, offset = 0 } = req.query;
      
      const filters = {
        projectId: req.projectId!,
        sourceConnectionId: sourceConnectionId as string,
        search: search as string,
        isActive: isActive ? isActive === 'true' : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      const skills = await storage.getSkills(filters);
      res.json(skills.map(s => ({ ...s, skillName: sanitizePgText(s.skillName) })));
    } catch (error) {
      console.error("Error fetching skills:", error);
      res.status(500).json({ message: "Failed to fetch skills" });
    }
  });

  app.get("/api/skills/:id", requireProjectAccess('view'), async (req, res) => {
    try {
      const skill = await storage.getSkill(req.params.id);
      if (!skill) {
        return res.status(404).json({ message: "Skill not found" });
      }
      if (skill.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this skill" });
      }
      res.json({ ...skill, skillName: sanitizePgText(skill.skillName) });
    } catch (error) {
      console.error("Error fetching skill:", error);
      res.status(500).json({ message: "Failed to fetch skill" });
    }
  });

  app.get("/api/skills/:id/xml", requireProjectAccess('view'), async (req, res) => {
    try {
      const skill = await storage.getSkill(req.params.id);
      if (!skill) {
        return res.status(404).json({ message: "Skill not found" });
      }
      if (skill.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this skill" });
      }

      const originalData = (skill.metadata as any)?.originalData || (skill.metadata as any)?.rawXml;
      if (!originalData) {
        // Build a basic XML representation from the skill data
        const apiUrl = (skill.metadata as any)?.apiUrl;
        const xmlString = `<?xml version="1.0" encoding="UTF-8"?>\n<skill>\n  <skillId>${skill.skillId}</skillId>\n  <skillName>${skill.skillName}</skillName>${apiUrl ? `\n  <self>${apiUrl}</self>` : ''}\n</skill>`;
        return res.type('application/xml').send(xmlString);
      }

      const xmlString = xmlConverter.convertToXml(originalData, 'skill');
      res.type('application/xml').send(xmlString);
    } catch (error) {
      console.error("Error fetching skill XML:", error);
      res.status(500).json({ message: "Failed to fetch skill XML" });
    }
  });

  app.put("/api/skills/:id", requireProjectAccess('update'), async (req, res) => {
    try {
      const { skillName, description, isActive } = req.body;
      
      const existingSkill = await storage.getSkill(req.params.id);
      if (!existingSkill) {
        return res.status(404).json({ message: "Skill not found" });
      }

      if (existingSkill.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this skill" });
      }

      const updateData: any = {};
      if (skillName !== undefined) updateData.skillName = skillName;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updatedSkill = await storage.updateSkill(req.params.id, updateData);

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Skill updated: ${updatedSkill.skillName} (ID: ${req.params.id})`,
        source: 'API',
        projectId: req.projectId,
      });

      res.json(updatedSkill);
    } catch (error) {
      console.error("Error updating skill:", error);
      res.status(500).json({ message: "Failed to update skill" });
    }
  });

  app.delete("/api/skills/:id", requireProjectAccess('update'), async (req, res) => {
    try {
      const existingSkill = await storage.getSkill(req.params.id);
      if (!existingSkill) {
        return res.status(404).json({ message: "Skill not found" });
      }
      
      if (existingSkill.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this skill" });
      }
      
      const deleted = await storage.deleteSkill(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Skill not found" });
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Skill deleted: ${req.params.id}`,
        source: 'API',
        projectId: req.projectId,
      });

      res.json({ message: "Skill deleted successfully" });
    } catch (error) {
      console.error("Error deleting skill:", error);
      res.status(500).json({ message: "Failed to delete skill" });
    }
  });

  // Get target skill ID mapping
  app.get("/api/skills/mapping/:originalSkillId/:targetConnectionId", async (req, res) => {
    try {
      const { originalSkillId, targetConnectionId } = req.params;
      const targetSkillId = await storage.getTargetSkillId(originalSkillId, targetConnectionId);
      
      if (!targetSkillId) {
        return res.status(404).json({ message: "Target skill mapping not found" });
      }
      
      res.json({ originalSkillId, targetSkillId, targetConnectionId });
    } catch (error) {
      console.error("Error fetching skill mapping:", error);
      res.status(500).json({ message: "Failed to fetch skill mapping" });
    }
  });

  // Get skills by target connection
  app.get("/api/skills/target/:targetConnectionId", async (req, res) => {
    try {
      const skills = await storage.getSkillsByTargetConnection(req.params.targetConnectionId);
      res.json(skills);
    } catch (error) {
      console.error("Error fetching target skills:", error);
      res.status(500).json({ message: "Failed to fetch target skills" });
    }
  });

  // Resource Groups
  app.get("/api/resource-groups", requireProjectAccess('view'), async (req, res) => {
    try {
      const { sourceConnectionId, search, isActive, limit, offset } = req.query;

      const filters = {
        projectId: req.projectId!,
        sourceConnectionId: sourceConnectionId as string,
        search: search as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      };

      const resourceGroups = await storage.getResourceGroups(filters);
      res.json(resourceGroups);
    } catch (error) {
      console.error("Error fetching resource groups:", error);
      res.status(500).json({ message: "Failed to fetch resource groups" });
    }
  });

  app.get("/api/resource-groups/:id", requireProjectAccess('view'), async (req, res) => {
    try {
      const resourceGroup = await storage.getResourceGroup(req.params.id);
      if (!resourceGroup) {
        return res.status(404).json({ message: "Resource group not found" });
      }
      if (resourceGroup.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this resource group" });
      }
      res.json(resourceGroup);
    } catch (error) {
      console.error("Error fetching resource group:", error);
      res.status(500).json({ message: "Failed to fetch resource group" });
    }
  });

  app.put("/api/resource-groups/:id", requireProjectAccess('update'), async (req, res) => {
    try {
      const { name, description, isActive } = req.body;
      
      const existingResourceGroup = await storage.getResourceGroup(req.params.id);
      if (!existingResourceGroup) {
        return res.status(404).json({ message: "Resource group not found" });
      }

      if (existingResourceGroup.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this resource group" });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updatedResourceGroup = await storage.updateResourceGroup(req.params.id, updateData);

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Resource group updated: ${updatedResourceGroup.name}`,
        source: 'API',
        projectId: req.projectId,
      });

      res.json(updatedResourceGroup);
    } catch (error) {
      console.error("Error updating resource group:", error);
      res.status(500).json({ message: "Failed to update resource group" });
    }
  });

  app.delete("/api/resource-groups/:id", requireProjectAccess('update'), async (req, res) => {
    try {
      const existingResourceGroup = await storage.getResourceGroup(req.params.id);
      if (!existingResourceGroup) {
        return res.status(404).json({ message: "Resource group not found" });
      }
      
      if (existingResourceGroup.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this resource group" });
      }

      const deleted = await storage.deleteResourceGroup(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Resource group not found" });
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Resource group deleted: ${req.params.id}`,
        source: 'API',
        projectId: req.projectId,
      });

      res.json({ message: "Resource group deleted successfully" });
    } catch (error) {
      console.error("Error deleting resource group:", error);
      res.status(500).json({ message: "Failed to delete resource group" });
    }
  });

  // Get target resource group ID mapping
  app.get("/api/resource-groups/mapping/:originalResourceGroupId/:targetConnectionId", async (req, res) => {
    try {
      const { originalResourceGroupId, targetConnectionId } = req.params;
      const targetResourceGroupId = await storage.getTargetResourceGroupId(originalResourceGroupId, targetConnectionId);
      
      if (!targetResourceGroupId) {
        return res.status(404).json({ message: "Target resource group mapping not found" });
      }
      
      res.json({ originalResourceGroupId, targetResourceGroupId, targetConnectionId });
    } catch (error) {
      console.error("Error fetching resource group mapping:", error);
      res.status(500).json({ message: "Failed to fetch resource group mapping" });
    }
  });

  // Get resource groups by target connection
  app.get("/api/resource-groups/target/:targetConnectionId", async (req, res) => {
    try {
      const resourceGroups = await storage.getResourceGroupsByTargetConnection(req.params.targetConnectionId);
      res.json(resourceGroups);
    } catch (error) {
      console.error("Error fetching target resource groups:", error);
      res.status(500).json({ message: "Failed to fetch target resource groups" });
    }
  });

  // Skills XML file import
  app.post("/api/skills/import", upload.single('skillsFile'), async (req: RequestWithFile, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No skills XML file provided" });
      }

      const { sourceConnectionId } = req.body;
      const projectId = req.body.projectId || (req.headers['x-project-id'] as string) || undefined;
      
      // Read and parse XML file
      const xmlContent = fs.readFileSync(req.file.path, 'utf8');
      
      const skillsData = await skillsParserService.parseSkillsXml(xmlContent);
      
      // Validate parsed skills
      const validation = skillsParserService.validateSkills(skillsData);
      if (!validation.isValid) {
        await storage.createAuditLog({
          level: 'warning',
          category: 'import',
          message: `Skills validation warnings for ${req.file.originalname}: ${validation.errors.join(', ')}`,
          source: 'SkillsParser',
        });
      }

      // Prepare skills for database insertion
      const skillsForDb = skillsParserService.prepareSkillsForDatabase(skillsData, sourceConnectionId)
        .map(s => ({ ...s, ...(projectId ? { projectId } : {}) }));
      
      // Import skills to database
      const importedSkills = [];
      let updatedCount = 0;
      
      for (const skillData of skillsForDb) {
        try {
          // Check if skill already exists
          const existingSkill = await storage.getSkillBySkillId(skillData.skillId, sourceConnectionId);
          
          if (existingSkill) {
            // Update existing skill
            const updated = await storage.updateSkill(existingSkill.id, {
              skillName: skillData.skillName,
              description: skillData.description,
              metadata: skillData.metadata,
              isActive: true,
              ...(projectId ? { projectId } : {}),
            });
            importedSkills.push(updated);
            updatedCount++;
          } else {
            // Create new skill
            const created = await storage.createSkill(skillData);
            importedSkills.push(created);
          }
        } catch (skillError) {
          console.error(`Error importing skill ${skillData.skillId}:`, skillError);
          await storage.createAuditLog({
            level: 'error',
            category: 'import',
            message: `Failed to import skill ${skillData.skillId}: ${skillError instanceof Error ? skillError.message : 'Unknown error'}`,
            source: 'SkillsImporter',
          });
        }
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'import',
        message: `Skills import completed: ${importedSkills.length - updatedCount} new, ${updatedCount} updated from ${req.file.originalname}`,
        source: 'SkillsImporter',
      });

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        message: "Skills imported successfully",
        imported: importedSkills.length - updatedCount,
        updated: updatedCount,
        total: importedSkills.length,
        skills: importedSkills,
        validation: validation,
      });
    } catch (error) {
      console.error("Error importing skills:", error);
      
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }

      await storage.createAuditLog({
        level: 'error',
        category: 'import',
        message: `Skills import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'SkillsImporter',
      });

      res.status(500).json({ 
        message: "Failed to import skills",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Skills API import from UCCX connection
  app.post("/api/skills/import-from-api", async (req, res) => {
    try {
      const { sourceConnectionId } = req.body;
      
      if (!sourceConnectionId) {
        return res.status(400).json({ message: "Source connection ID is required" });
      }

      const connection = await storage.getUccxConnection(sourceConnectionId);
      if (!connection) {
        return res.status(404).json({ message: "UCCX connection not found" });
      }

      const uccxApiService = new UccxApiService(connection);
      const projectId = connection.projectId;
      
      // Fetch skills from UCCX API  
      const skillsData = await uccxApiService.fetchSkills();
      
      // Import skills to database
      const importedSkills = [];
      let updatedCount = 0;
      
      for (const skillData of skillsData) {
        try {
          const skillForDb = {
            skillId: skillData.skillId,
            skillName: skillData.skillName,
            description: skillData.description || null,
            sourceConnectionId: sourceConnectionId,
            projectId,
            isActive: true,
            metadata: {
              originalData: skillData,
              importSource: 'uccx_api',
            },
          };

          // Check if skill already exists
          const existingSkill = await storage.getSkillBySkillId(skillData.skillId, sourceConnectionId);
          
          if (existingSkill) {
            // Update existing skill
            const updated = await storage.updateSkill(existingSkill.id, skillForDb);
            importedSkills.push(updated);
            updatedCount++;
          } else {
            // Create new skill
            const created = await storage.createSkill(skillForDb);
            importedSkills.push(created);
          }
        } catch (skillError) {
          console.error(`Error importing skill ${skillData.skillId} from API:`, skillError);
          await storage.createAuditLog({
            level: 'error',
            category: 'import',
            message: `Failed to import skill ${skillData.skillId} from API: ${skillError instanceof Error ? skillError.message : 'Unknown error'}`,
            source: 'SkillsApiImporter',
          });
        }
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'api',
        message: `Skills API import completed: ${importedSkills.length - updatedCount} new, ${updatedCount} updated from ${connection.name}`,
        source: 'SkillsApiImporter',
      });

      res.json({
        message: "Skills imported successfully from API",
        imported: importedSkills.length - updatedCount,
        updated: updatedCount,
        total: importedSkills.length,
        skills: importedSkills,
        source: connection.name,
      });
    } catch (error) {
      console.error("Error importing skills from API:", error);
      
      await storage.createAuditLog({
        level: 'error',
        category: 'api',
        message: `Skills API import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'SkillsApiImporter',
      });

      res.status(500).json({ 
        message: "Failed to import skills from API",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Resource Groups management
  app.get("/api/resource-groups", async (req, res) => {
    try {
      const { projectId, sourceConnectionId, search, isActive, limit = 50, offset = 0 } = req.query;
      
      if (!projectId) {
        return res.status(400).json({ message: "Project ID is required" });
      }

      const filters = {
        projectId: projectId as string,
        sourceConnectionId: sourceConnectionId as string,
        search: search as string,
        isActive: isActive ? isActive === 'true' : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      const resourceGroups = await storage.getResourceGroups(filters);
      res.json(resourceGroups);
    } catch (error) {
      console.error("Error fetching resource groups:", error);
      res.status(500).json({ message: "Failed to fetch resource groups" });
    }
  });

  app.get("/api/resource-groups/:id", async (req, res) => {
    try {
      const resourceGroup = await storage.getResourceGroup(req.params.id);
      if (!resourceGroup) {
        return res.status(404).json({ message: "Resource group not found" });
      }
      res.json(resourceGroup);
    } catch (error) {
      console.error("Error fetching resource group:", error);
      res.status(500).json({ message: "Failed to fetch resource group" });
    }
  });

  app.post("/api/resource-groups", async (req, res) => {
    try {
      const validatedData = insertResourceGroupSchema.parse(req.body);
      const resourceGroup = await storage.createResourceGroup(validatedData);

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Resource group created: ${resourceGroup.name}`,
        source: 'API',
      });

      res.status(201).json(resourceGroup);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating resource group:", error);
      res.status(500).json({ message: "Failed to create resource group" });
    }
  });

  app.put("/api/resource-groups/:id", async (req, res) => {
    try {
      const { name, description, isActive, projectId } = req.body;
      
      const existingResourceGroup = await storage.getResourceGroup(req.params.id);
      if (!existingResourceGroup) {
        return res.status(404).json({ message: "Resource group not found" });
      }

      if (projectId && existingResourceGroup.projectId !== projectId) {
        return res.status(403).json({ message: "Access denied to this resource group" });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;

      const resourceGroup = await storage.updateResourceGroup(req.params.id, updateData);

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Resource group updated: ${resourceGroup.name}`,
        source: 'API',
        projectId,
      });

      res.json(resourceGroup);
    } catch (error) {
      console.error("Error updating resource group:", error);
      res.status(500).json({ message: "Failed to update resource group" });
    }
  });

  app.delete("/api/resource-groups/:id", async (req, res) => {
    try {
      const { projectId } = req.query;
      
      const existingResourceGroup = await storage.getResourceGroup(req.params.id);
      if (!existingResourceGroup) {
        return res.status(404).json({ message: "Resource group not found" });
      }
      
      if (projectId && existingResourceGroup.projectId !== projectId) {
        return res.status(403).json({ message: "Access denied to this resource group" });
      }

      const deleted = await storage.deleteResourceGroup(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Resource group not found" });
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Resource group deleted: ${req.params.id}`,
        source: 'API',
        projectId: projectId as string,
      });

      res.json({ message: "Resource group deleted successfully" });
    } catch (error) {
      console.error("Error deleting resource group:", error);
      res.status(500).json({ message: "Failed to delete resource group" });
    }
  });

  // CSQ endpoints
  app.get("/api/csqs", requireProjectAccess('view'), async (req, res) => {
    try {
      const { sourceConnectionId, search, enabled, isActive, limit = 50, offset = 0 } = req.query;

      const filters = {
        projectId: req.projectId!,
        sourceConnectionId: sourceConnectionId as string,
        search: search as string,
        enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      const csqs = await storage.getCSQs(filters);
      res.json(csqs);
    } catch (error) {
      console.error("Error fetching CSQs:", error);
      res.status(500).json({ message: "Failed to fetch CSQs" });
    }
  });

  app.post("/api/csqs", requireProjectAccess('update'), async (req, res) => {
    try {
      const csqData = insertCSQSchema.parse({ ...req.body, projectId: req.projectId });
      const csq = await storage.createCSQ(csqData);

      await storage.createAuditLog({
        level: 'info',
        category: 'import',
        message: `CSQ created: ${csq.name}`,
        source: 'API',
        projectId: req.projectId,
      });

      res.json(csq);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid CSQ data", errors: error.errors });
      }
      console.error("Error creating CSQ:", error);
      res.status(500).json({ message: "Failed to create CSQ" });
    }
  });

  app.put("/api/csqs/:id", requireProjectAccess('update'), async (req, res) => {
    try {
      const { id } = req.params;
      const { name } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({ message: "CSQ name is required" });
      }

      const existingCSQ = await storage.getCSQ(id);
      if (!existingCSQ) {
        return res.status(404).json({ message: "CSQ not found" });
      }

      if (existingCSQ.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this CSQ" });
      }

      const updatedCSQ = await storage.updateCSQ(id, { name: name.trim() });

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `CSQ updated: ${updatedCSQ.name}`,
        source: 'API',
        projectId: req.projectId,
      });

      res.json(updatedCSQ);
    } catch (error) {
      console.error("Error updating CSQ:", error);
      res.status(500).json({ message: "Failed to update CSQ" });
    }
  });

  app.delete("/api/csqs/:id", requireProjectAccess('update'), async (req, res) => {
    try {
      const { id } = req.params;

      const csq = await storage.getCSQ(id);
      if (!csq) {
        return res.status(404).json({ message: "CSQ not found" });
      }

      if (csq.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this CSQ" });
      }

      const deleted = await storage.deleteCSQ(id);

      if (deleted) {
        await storage.createAuditLog({
          level: 'info',
          category: 'system',
          message: `CSQ deleted: ${csq.name}`,
          source: 'API',
          projectId: req.projectId,
        });

        res.json({ success: true });
      } else {
        res.status(500).json({ message: "Failed to delete CSQ" });
      }
    } catch (error) {
      console.error("Error deleting CSQ:", error);
      res.status(500).json({ message: "Failed to delete CSQ" });
    }
  });

  // Get target CSQ ID mapping
  app.get("/api/csqs/mapping/:originalCSQId/:targetConnectionId", async (req, res) => {
    try {
      const { originalCSQId, targetConnectionId } = req.params;
      const targetCSQId = await storage.getTargetCSQId(originalCSQId, targetConnectionId);
      
      if (!targetCSQId) {
        return res.status(404).json({ message: "Target CSQ mapping not found" });
      }
      
      res.json({ originalCSQId, targetCSQId, targetConnectionId });
    } catch (error) {
      console.error("Error fetching CSQ mapping:", error);
      res.status(500).json({ message: "Failed to fetch CSQ mapping" });
    }
  });

  // Get CSQs by target connection
  app.get("/api/csqs/target/:targetConnectionId", async (req, res) => {
    try {
      const csqs = await storage.getCSQsByTargetConnection(req.params.targetConnectionId);
      res.json(csqs);
    } catch (error) {
      console.error("Error fetching target CSQs:", error);
      res.status(500).json({ message: "Failed to fetch target CSQs" });
    }
  });

  // Offline migration - generate XML files
  app.post("/api/migrations/offline", async (req, res) => {
    try {
      const { targetConnectionId, settings } = req.body;
      const raw = req.body.configurationItems;
      const selectedTypes: string[] = Array.isArray(raw) ? raw : (raw ? [raw] : []);

      if (selectedTypes.length === 0 || !targetConnectionId) {
        return res.status(400).json({ message: "Configuration items and target connection are required" });
      }
      const has = (t: string) => selectedTypes.includes(t);
      let xmlFiles: { filename: string; content: string }[] = [];

      // Generate skill files
      if (has('skills')) {
        const skills = await storage.getSkills();
        skills.forEach((skill: any, index: number) => {
          const skillXML = `<skill>
    <skillId>${skill.skillId}</skillId>
    <skillName>${skill.skillName}</skillName>
</skill>`;
          xmlFiles.push({
            filename: `skill_${index + 1}_${skill.skillName.replace(/[^a-zA-Z0-9]/g, '_')}.xml`,
            content: skillXML
          });
        });
      }

      // Generate resource group files
      if (has('resource_groups')) {
        const resourceGroups = await storage.getResourceGroups();
        resourceGroups.forEach((rg: any, index: number) => {
          const rgXML = `<ResourceGroup>
    <self/>
    <name>${rg.name}</name>
</ResourceGroup>`;
          xmlFiles.push({
            filename: `resource_group_${index + 1}_${rg.name.replace(/[^a-zA-Z0-9]/g, '_')}.xml`,
            content: rgXML
          });
        });
      }

      // Generate CSQ files with skill ID mapping
      if (has('csqs')) {
        const csqs = await storage.getCSQs();
        for (const csq of csqs) {
          // Get CSQ skills to map to target skill IDs
          const csqSkills = await storage.getCSQSkills(csq.id);
          let skillCompetencies = '';
          
          for (const skill of csqSkills) {
            // Get target skill ID if available
            const targetSkillId = await storage.getTargetSkillId(skill.skillId, targetConnectionId);
            const skillRefURL = targetSkillId ? `/adminapi/skill/${targetSkillId}` : `/adminapi/skill/${skill.skillId}`;
            
            // Get skill name
            const skillDetails = await storage.getSkillBySkillId(skill.skillId);
            const skillName = skillDetails?.skillName || `skill${skill.skillId}`;
            
            skillCompetencies += `
            <skillCompetency>
                <competencelevel>${skill.competencyLevel || 5}</competencelevel>
                <skillNameUriPair name="${skillName}">
                    <refURL>${skillRefURL}</refURL>
                </skillNameUriPair>
                <weight>${skill.weight || 1}</weight>
            </skillCompetency>`;
          }

          const csqXML = `<csq xmlns:xsi="https://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="csq.xsd">
    <self href="" rel="" type="" />
    <name>${csq.name}</name>
    <queueType>${csq.queueType || 'VOICE'}</queueType>
    <queueAlgorithm>${csq.queueAlgorithm || 'FIFO'}</queueAlgorithm>
    <autoWork>${csq.autoWork !== undefined ? csq.autoWork : true}</autoWork>
    <wrapupTime>${csq.wrapupTime || 1}</wrapupTime>
    <resourcePoolType>${csq.resourcePoolType || 'SKILL_GROUP'}</resourcePoolType>
    <serviceLevel>${csq.serviceLevel || 5}</serviceLevel>
    <serviceLevelPercentage>${csq.serviceLevelPercentage || 70}</serviceLevelPercentage>
    <poolSpecificInfo>
        <skillGroup>${skillCompetencies}
            <selectionCriteria>Longest Available</selectionCriteria>
        </skillGroup>
    </poolSpecificInfo>
</csq>`;
          
          xmlFiles.push({
            filename: `csq_${csq.name.replace(/[^a-zA-Z0-9]/g, '_')}.xml`,
            content: csqXML
          });
        }
      }

      if (xmlFiles.length === 0) {
        return res.status(400).json({ message: "No migration files to generate" });
      }

      // Create a ZIP file with all XML files
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip();

      xmlFiles.forEach(file => {
        zip.addFile(file.filename, Buffer.from(file.content, 'utf8'));
      });

      // Add readme file
      const readmeContent = `UCCX Migration Files
==================

This package contains XML files for migrating UCCX configurations.
Each file represents a single API call to be made to the target system.

API Endpoints:
- Skills: POST /adminapi/skill
- Resource Groups: POST /adminapi/resourceGroup  
- CSQs: POST /adminapi/csq

Important: 
- Deploy skills first, then resource groups, then CSQs
- CSQ files reference target skill IDs (100+) from previously deployed skills
- Use individual API calls for each file

Generated: ${new Date().toISOString()}
Migration Items: ${selectedTypes.join(', ')}
`;
      
      zip.addFile('README.txt', Buffer.from(readmeContent, 'utf8'));

      const zipBuffer = zip.toBuffer();
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="migration_files_${Date.now()}.zip"`);
      res.send(zipBuffer);

    } catch (error) {
      console.error("Error generating offline migration files:", error);
      res.status(500).json({ message: "Failed to generate migration files" });
    }
  });

  // Get skill mappings for a specific CSQ with resolved skill names
  app.get("/api/csqs/:id/skills", async (req, res) => {
    try {
      const { id } = req.params;
      const skillMappings = await storage.getCSQSkills(id);
      
      // Resolve skill names from skills table
      const skillsWithNames = await Promise.all(
        skillMappings.map(async (mapping) => {
          const skill = await storage.getSkillBySkillId(mapping.skillId);
          return {
            ...mapping,
            skillName: skill?.skillName || `Unknown Skill (${mapping.skillId})`
          };
        })
      );
      
      res.json(skillsWithNames);
    } catch (error) {
      console.error("Error fetching CSQ skills:", error);
      res.status(500).json({ message: "Failed to fetch CSQ skills" });
    }
  });

  // Get resource group raw XML
  app.get("/api/resource-groups/:id/xml", requireProjectAccess('view'), async (req, res) => {
    try {
      const resourceGroup = await storage.getResourceGroup(req.params.id);
      if (!resourceGroup) {
        return res.status(404).json({ message: "Resource group not found" });
      }
      if (resourceGroup.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this resource group" });
      }
      const originalData = (resourceGroup.metadata as any)?.originalData || (resourceGroup.metadata as any)?.rawXml;
      if (!originalData) {
        const xmlString = `<?xml version="1.0" encoding="UTF-8"?>\n<resourceGroup>\n  <id>${resourceGroup.resourceGroupId}</id>\n  <name>${resourceGroup.name}</name>\n</resourceGroup>`;
        return res.type('application/xml').send(xmlString);
      }
      const xmlString = xmlConverter.convertToXml(originalData, 'resourceGroup');
      res.type('application/xml').send(xmlString);
    } catch (error) {
      console.error("Error fetching resource group XML:", error);
      res.status(500).json({ message: "Failed to fetch resource group XML" });
    }
  });

  // Get CSQ raw XML
  app.get("/api/csqs/:id/xml", requireProjectAccess('view'), async (req, res) => {
    try {
      const csq = await storage.getCSQ(req.params.id);
      if (!csq) {
        return res.status(404).json({ message: "CSQ not found" });
      }
      if (csq.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this CSQ" });
      }
      const originalData = (csq.metadata as any)?.originalData || (csq.metadata as any)?.rawXml;
      if (!originalData) {
        const xmlString = `<?xml version="1.0" encoding="UTF-8"?>\n<csq>\n  <id>${csq.csqId}</id>\n  <name>${csq.name}</name>\n</csq>`;
        return res.type('application/xml').send(xmlString);
      }
      const xmlString = xmlConverter.convertToXml(originalData, 'csq');
      res.type('application/xml').send(xmlString);
    } catch (error) {
      console.error("Error fetching CSQ XML:", error);
      res.status(500).json({ message: "Failed to fetch CSQ XML" });
    }
  });

  // Resources management
  app.get("/api/resources", requireProjectAccess('view'), async (req, res) => {
    try {
      const { sourceConnectionId, search, isActive, limit = 100, offset = 0 } = req.query;

      const filters = {
        projectId: req.projectId!,
        sourceConnectionId: sourceConnectionId as string,
        search: search as string,
        isActive: isActive ? isActive === 'true' : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      const resources = await storage.getResources(filters);
      res.json(resources);
    } catch (error) {
      console.error("Error fetching resources:", error);
      res.status(500).json({ message: "Failed to fetch resources" });
    }
  });

  // Get resource raw XML
  app.get("/api/resources/:id/xml", requireProjectAccess('view'), async (req, res) => {
    try {
      const { id } = req.params;
      const resource = await storage.getResource(id);
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }
      if (resource.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this resource" });
      }
      
      const originalData = (resource.metadata as any)?.originalData || (resource.metadata as any)?.rawXml;
      if (!originalData) {
        return res.status(404).json({ message: "No XML data available for this resource" });
      }
      
      const xmlString = xmlConverter.convertToXml(originalData, 'resource');
      res.type('application/xml').send(xmlString);
    } catch (error) {
      console.error("Error fetching resource XML:", error);
      res.status(500).json({ message: "Failed to fetch resource XML" });
    }
  });

  app.get("/api/resources/:id", requireProjectAccess('view'), async (req, res) => {
    try {
      const resource = await storage.getResource(req.params.id);
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }
      if (resource.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this resource" });
      }
      res.json(resource);
    } catch (error) {
      console.error("Error fetching resource:", error);
      res.status(500).json({ message: "Failed to fetch resource" });
    }
  });

  app.put("/api/resources/:id", requireProjectAccess('update'), async (req, res) => {
    try {
      const resourceData = insertResourceSchema.partial().parse(req.body);
      
      const existingResource = await storage.getResource(req.params.id);
      if (!existingResource) {
        return res.status(404).json({ message: "Resource not found" });
      }

      if (existingResource.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this resource" });
      }

      const updatedResource = await storage.updateResource(req.params.id, resourceData);

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Resource updated: ${updatedResource.userID} (ID: ${req.params.id})`,
        source: 'API',
        projectId: req.projectId,
      });

      res.json(updatedResource);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid resource data", errors: error.errors });
      }
      console.error("Error updating resource:", error);
      res.status(500).json({ message: "Failed to update resource" });
    }
  });

  app.delete("/api/resources/:id", requireProjectAccess('update'), async (req, res) => {
    try {
      const resource = await storage.getResource(req.params.id);
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }

      if (resource.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this resource" });
      }

      const deleted = await storage.deleteResource(req.params.id);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete resource" });
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Resource deleted: ${resource.userID} (ID: ${req.params.id})`,
        source: 'API',
        projectId: req.projectId,
      });

      res.json({ message: "Resource deleted successfully" });
    } catch (error) {
      console.error("Error deleting resource:", error);
      res.status(500).json({ message: "Failed to delete resource" });
    }
  });

  // Get target UserID mapping
  app.get("/api/resources/mapping/:originalUserID/:targetConnectionId", async (req, res) => {
    try {
      const { originalUserID, targetConnectionId } = req.params;
      const targetUserID = await storage.getTargetUserID(originalUserID, targetConnectionId);
      
      if (!targetUserID) {
        return res.status(404).json({ message: "Target resource mapping not found" });
      }
      
      res.json({ originalUserID, targetUserID, targetConnectionId });
    } catch (error) {
      console.error("Error fetching resource mapping:", error);
      res.status(500).json({ message: "Failed to fetch resource mapping" });
    }
  });

  // Get resources by target connection
  app.get("/api/resources/target/:targetConnectionId", async (req, res) => {
    try {
      const resources = await storage.getResourcesByTargetConnection(req.params.targetConnectionId);
      res.json(resources);
    } catch (error) {
      console.error("Error fetching target resources:", error);
      res.status(500).json({ message: "Failed to fetch target resources" });
    }
  });

  // Get resource skills with skill names resolved
  app.get("/api/resources/:id/skills", async (req, res) => {
    try {
      const { id } = req.params;
      const resource = await storage.getResource(id);
      if (!resource) {
        return res.status(404).json({ message: "Resource not found" });
      }

      const skillMappings = await storage.getResourceSkills(id);
      
      // Resolve skill names from skills table
      const skillsWithNames = await Promise.all(
        skillMappings.map(async (mapping) => {
          const skill = await storage.getSkillBySkillId(mapping.skillId);
          return {
            ...mapping,
            skillName: skill?.skillName || `Unknown Skill (${mapping.skillId})`
          };
        })
      );
      
      res.json(skillsWithNames);
    } catch (error) {
      console.error("Error fetching resource skills:", error);
      res.status(500).json({ message: "Failed to fetch resource skills" });
    }
  });

  // Resources XML file import
  app.post("/api/resources/import", upload.single('resourcesFile'), async (req: RequestWithFile, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No resources XML file provided" });
      }

      let { sourceConnectionId } = req.body;
      const projectId = req.body.projectId || (req.headers['x-project-id'] as string) || undefined;
      
      // Validate sourceConnectionId if provided
      if (sourceConnectionId) {
        const connection = await storage.getUccxConnection(sourceConnectionId);
        if (!connection) {
          console.warn(`Invalid sourceConnectionId provided: ${sourceConnectionId}, setting to null`);
          sourceConnectionId = null;
        }
      } else {
        sourceConnectionId = null;
      }
      
      // Read and parse XML file
      const xmlContent = fs.readFileSync(req.file.path, 'utf8');
      
      const resourcesParser = new ResourcesParserService();
      const resourcesData = await resourcesParser.parseResourcesXml(xmlContent);
      
      // Validate parsed resources
      const validation = resourcesParser.validateResources(resourcesData);
      if (!validation.isValid) {
        await storage.createAuditLog({
          level: 'warning',
          category: 'import',
          message: `Resources validation warnings for ${req.file.originalname}: ${validation.errors.join(', ')}`,
          source: 'ResourcesParser',
        });
      }

      // Prepare resources for database insertion
      const resourcesForDb = resourcesParser.prepareResourcesForDatabase(resourcesData, sourceConnectionId || undefined)
        .map(item => ({ ...item, resource: { ...item.resource, ...(projectId ? { projectId } : {}) } }));
      
      // Import resources to database
      const importedResources = [];
      let updatedCount = 0;
      
      for (const item of resourcesForDb) {
        try {
          // Check if resource already exists
          const existingResource = await storage.getResourceByUserID(item.resource.userID, sourceConnectionId);
          
          let savedResource;
          if (existingResource) {
            // Update existing resource
            savedResource = await storage.updateResource(existingResource.id, { ...item.resource, ...(projectId ? { projectId } : {}) });
            updatedCount++;
          } else {
            // Create new resource
            savedResource = await storage.createResource(item.resource);
          }

          // Handle resource skills
          if (item.skills.length > 0) {
            // Delete existing skills for this resource
            await storage.deleteResourceSkills(savedResource.id);
            
            // Create new skill associations
            for (const skill of item.skills) {
              await storage.createResourceSkill({
                resourceId: savedResource.id,
                skillId: skill.skillId,
                competencyLevel: skill.competencyLevel,
              });
            }
          }

          importedResources.push(savedResource);
        } catch (resourceError) {
          console.error(`Error importing resource ${item.resource.userID}:`, resourceError);
          await storage.createAuditLog({
            level: 'error',
            category: 'import',
            message: `Failed to import resource ${item.resource.userID}: ${resourceError instanceof Error ? resourceError.message : 'Unknown error'}`,
            source: 'ResourcesImporter',
          });
        }
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'import',
        message: `Resources import completed: ${importedResources.length - updatedCount} new, ${updatedCount} updated from ${req.file.originalname}`,
        source: 'ResourcesImporter',
      });

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        message: "Resources imported successfully",
        imported: importedResources.length - updatedCount,
        updated: updatedCount,
        total: importedResources.length,
        resources: importedResources,
        validation: validation,
      });
    } catch (error) {
      console.error("Error importing resources:", error);
      
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }

      await storage.createAuditLog({
        level: 'error',
        category: 'import',
        message: `Resources import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'ResourcesImporter',
      });

      res.status(500).json({ 
        message: "Failed to import resources",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Resources API import from UCCX connection
  app.post("/api/resources/import-from-api", async (req, res) => {
    try {
      const { connectionId, endpoint } = req.body;
      
      if (!connectionId) {
        return res.status(400).json({ message: "Connection ID is required" });
      }

      const connection = await storage.getUccxConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ message: "UCCX connection not found" });
      }

      // Note: This is a placeholder implementation
      // The actual UCCX API implementation for resources would need to be added to UccxApiService
      // For now, this returns a not implemented error
      
      res.status(501).json({ 
        message: "Resources API import not yet implemented",
        note: "Please use XML file import for resources"
      });
    } catch (error) {
      console.error("Error importing resources from API:", error);
      
      await storage.createAuditLog({
        level: 'error',
        category: 'api',
        message: `Resources API import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'ResourcesApiImporter',
      });

      res.status(500).json({ 
        message: "Failed to import resources from API",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Teams management
  app.get("/api/teams", requireProjectAccess('view'), async (req, res) => {
    try {
      const { sourceConnectionId, search, isActive, limit = 100, offset = 0 } = req.query;

      const filters = {
        projectId: req.projectId!,
        sourceConnectionId: sourceConnectionId as string,
        search: search as string,
        isActive: isActive ? isActive === 'true' : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      const teams = await storage.getTeams(filters);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  // Get team raw XML
  app.get("/api/teams/:id/xml", requireProjectAccess('view'), async (req, res) => {
    try {
      const { id } = req.params;
      const team = await storage.getTeam(id);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      if (team.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this team" });
      }
      
      const originalData = (team.metadata as any)?.originalData || (team.metadata as any)?.rawXml;
      if (!originalData) {
        return res.status(404).json({ message: "No XML data available for this team" });
      }
      
      const xmlString = xmlConverter.convertToXml(originalData, 'team');
      res.type('application/xml').send(xmlString);
    } catch (error) {
      console.error("Error fetching team XML:", error);
      res.status(500).json({ message: "Failed to fetch team XML" });
    }
  });

  app.get("/api/teams/:id", requireProjectAccess('view'), async (req, res) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      if (team.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this team" });
      }
      res.json(team);
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  app.put("/api/teams/:id", requireProjectAccess('update'), async (req, res) => {
    try {
      const teamData = insertTeamSchema.partial().parse(req.body);
      
      const existingTeam = await storage.getTeam(req.params.id);
      if (!existingTeam) {
        return res.status(404).json({ message: "Team not found" });
      }

      if (existingTeam.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this team" });
      }

      const updatedTeam = await storage.updateTeam(req.params.id, teamData);

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Team updated: ${updatedTeam.teamname} (ID: ${req.params.id})`,
        source: 'API',
        projectId: req.projectId,
      });

      res.json(updatedTeam);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid team data", errors: error.errors });
      }
      console.error("Error updating team:", error);
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", requireProjectAccess('update'), async (req, res) => {
    try {
      const team = await storage.getTeam(req.params.id);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      if (team.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this team" });
      }

      const deleted = await storage.deleteTeam(req.params.id);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete team" });
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Team deleted: ${team.teamname} (ID: ${req.params.id})`,
        source: 'API',
        projectId: req.projectId,
      });

      res.json({ message: "Team deleted successfully" });
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  // Get target TeamId mapping
  app.get("/api/teams/mapping/:originalTeamId/:targetConnectionId", async (req, res) => {
    try {
      const { originalTeamId, targetConnectionId } = req.params;
      const targetTeamId = await storage.getTargetTeamId(originalTeamId, targetConnectionId);
      
      if (!targetTeamId) {
        return res.status(404).json({ message: "Target team mapping not found" });
      }
      
      res.json({ originalTeamId, targetTeamId, targetConnectionId });
    } catch (error) {
      console.error("Error fetching team mapping:", error);
      res.status(500).json({ message: "Failed to fetch team mapping" });
    }
  });

  // Get teams by target connection
  app.get("/api/teams/target/:targetConnectionId", async (req, res) => {
    try {
      const teams = await storage.getTeamsByTargetConnection(req.params.targetConnectionId);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching target teams:", error);
      res.status(500).json({ message: "Failed to fetch target teams" });
    }
  });

  // Get team resources with full resource details
  app.get("/api/teams/:id/resources", async (req, res) => {
    try {
      const { id } = req.params;
      const team = await storage.getTeam(id);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }

      const teamResources = await storage.getTeamResources(id);
      
      // Fetch full resource details for each team member
      const resourcesWithDetails = await Promise.all(
        teamResources.map(async (tr) => {
          const resource = await storage.getResourceByUserID(tr.resourceUserID, team.sourceConnectionId || undefined);
          return resource;
        })
      );

      // Filter out any undefined resources (in case some weren't found)
      const validResources = resourcesWithDetails.filter(r => r !== undefined);
      
      res.json(validResources);
    } catch (error) {
      console.error("Error fetching team resources:", error);
      res.status(500).json({ message: "Failed to fetch team resources" });
    }
  });

  // Teams XML file import
  app.post("/api/teams/import", upload.single('teamsFile'), async (req: RequestWithFile, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No teams XML file provided" });
      }

      let { sourceConnectionId } = req.body;
      const projectId = req.body.projectId || (req.headers['x-project-id'] as string) || undefined;
      
      // Validate sourceConnectionId if provided
      if (sourceConnectionId) {
        const connection = await storage.getUccxConnection(sourceConnectionId);
        if (!connection) {
          console.warn(`Invalid sourceConnectionId provided: ${sourceConnectionId}, setting to null`);
          sourceConnectionId = null;
        }
      } else {
        sourceConnectionId = null;
      }
      
      // Read and parse XML file
      const xmlContent = fs.readFileSync(req.file.path, 'utf8');
      
      const teamsParser = new TeamsParserService();
      const teamsData = await teamsParser.parseTeamsXml(xmlContent);
      
      // Validate parsed teams
      const validation = teamsParser.validateTeams(teamsData);
      if (!validation.isValid) {
        await storage.createAuditLog({
          level: 'warning',
          category: 'import',
          message: `Teams validation warnings for ${req.file.originalname}: ${validation.errors.join(', ')}`,
          source: 'TeamsParser',
        });
      }

      // Prepare teams for database insertion
      const teamsForDb = teamsParser.prepareTeamsForDatabase(teamsData, sourceConnectionId || undefined)
        .map(item => ({ ...item, team: { ...item.team, ...(projectId ? { projectId } : {}) } }));
      
      // Import teams to database
      const importedTeams = [];
      let updatedCount = 0;
      
      for (const item of teamsForDb) {
        try {
          // Check if team already exists
          const existingTeam = await storage.getTeamByTeamId(item.team.teamId, sourceConnectionId);
          
          let savedTeam;
          if (existingTeam) {
            // Update existing team
            savedTeam = await storage.updateTeam(existingTeam.id, { ...item.team, ...(projectId ? { projectId } : {}) });
            updatedCount++;
          } else {
            // Create new team
            savedTeam = await storage.createTeam(item.team);
          }

          // Handle team resources
          if (item.teamResources.length > 0) {
            // Delete existing team resources
            await storage.deleteTeamResources(savedTeam.id);
            
            // Create new team resource associations
            for (const teamResource of item.teamResources) {
              await storage.createTeamResource({
                teamId: savedTeam.id,
                resourceUserID: teamResource.resourceUserID,
              });
            }
          }

          importedTeams.push(savedTeam);
        } catch (teamError) {
          console.error(`Error importing team ${item.team.teamId}:`, teamError);
          await storage.createAuditLog({
            level: 'error',
            category: 'import',
            message: `Failed to import team ${item.team.teamId}: ${teamError instanceof Error ? teamError.message : 'Unknown error'}`,
            source: 'TeamsImporter',
          });
        }
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'import',
        message: `Teams import completed: ${importedTeams.length - updatedCount} new, ${updatedCount} updated from ${req.file.originalname}`,
        source: 'TeamsImporter',
      });

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        message: "Teams imported successfully",
        imported: importedTeams.length - updatedCount,
        updated: updatedCount,
        total: importedTeams.length,
        teams: importedTeams,
        validation: validation,
      });
    } catch (error) {
      console.error("Error importing teams:", error);
      
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }

      await storage.createAuditLog({
        level: 'error',
        category: 'import',
        message: `Teams import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'TeamsImporter',
      });

      res.status(500).json({ 
        message: "Failed to import teams",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Teams API import from UCCX connection
  app.post("/api/teams/import-from-api", async (req, res) => {
    try {
      const { connectionId, endpoint } = req.body;
      
      if (!connectionId) {
        return res.status(400).json({ message: "Connection ID is required" });
      }

      const connection = await storage.getUccxConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ message: "UCCX connection not found" });
      }

      // Note: This is a placeholder implementation
      // The actual UCCX API implementation for teams would need to be added to UccxApiService
      // For now, this returns a not implemented error
      
      res.status(501).json({ 
        message: "Teams API import not yet implemented",
        note: "Please use XML file import for teams"
      });
    } catch (error) {
      console.error("Error importing teams from API:", error);
      
      await storage.createAuditLog({
        level: 'error',
        category: 'api',
        message: `Teams API import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        source: 'TeamsApiImporter',
      });

      res.status(500).json({ 
        message: "Failed to import teams from API",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Applications management
  app.get("/api/applications", requireProjectAccess('view'), async (req, res) => {
    try {
      const { sourceConnectionId, search, isActive, limit = 100, offset = 0 } = req.query;

      const filters = {
        projectId: req.projectId!,
        sourceConnectionId: sourceConnectionId as string,
        search: search as string,
        isActive: isActive ? isActive === 'true' : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };
      const applications = await storage.getApplications(filters);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Get application raw XML
  app.get("/api/applications/:id/xml", requireProjectAccess('view'), async (req, res) => {
    try {
      const { id } = req.params;
      const application = await storage.getApplication(id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      if (application.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this application" });
      }
      
      const originalData = (application.metadata as any)?.originalData || (application.metadata as any)?.rawXml;
      if (!originalData) {
        return res.status(404).json({ message: "No XML data available for this application" });
      }
      
      const xmlString = xmlConverter.convertToXml(originalData, 'application');
      res.type('application/xml').send(xmlString);
    } catch (error) {
      console.error("Error fetching application XML:", error);
      res.status(500).json({ message: "Failed to fetch application XML" });
    }
  });

  app.post("/api/applications", requireProjectAccess('update'), async (req, res) => {
    try {
      const application = await storage.createApplication({ ...req.body, projectId: req.projectId });
      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Application created: ${application.applicationName}`,
        source: 'API',
        projectId: req.projectId,
      });
      res.json(application);
    } catch (error) {
      console.error("Error creating application:", error);
      res.status(500).json({ message: "Failed to create application" });
    }
  });

  app.put("/api/applications/:id", requireProjectAccess('update'), async (req, res) => {
    try {
      const existingApplication = await storage.getApplication(req.params.id);
      if (!existingApplication) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (existingApplication.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this application" });
      }

      const updated = await storage.updateApplication(req.params.id, req.body);
      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Application updated: ${updated.applicationName}`,
        source: 'API',
        projectId: req.projectId,
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating application:", error);
      res.status(500).json({ message: "Failed to update application" });
    }
  });

  app.delete("/api/applications/:id", requireProjectAccess('update'), async (req, res) => {
    try {
      const existingApplication = await storage.getApplication(req.params.id);
      if (!existingApplication) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (existingApplication.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this application" });
      }

      const deleted = await storage.deleteApplication(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Application not found" });
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Application deleted: ${req.params.id}`,
        source: 'API',
        projectId: req.projectId,
      });

      res.json({ message: "Application deleted successfully" });
    } catch (error) {
      console.error("Error deleting application:", error);
      res.status(500).json({ message: "Failed to delete application" });
    }
  });

  app.post("/api/applications/import", upload.single('applicationsFile'), async (req: RequestWithFile, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No applications XML file provided" });
      }
      
      let { sourceConnectionId } = req.body;
      if (sourceConnectionId) {
        const connection = await storage.getUccxConnection(sourceConnectionId);
        if (!connection) {
          sourceConnectionId = null;
        }
      } else {
        sourceConnectionId = null;
      }
      
      const xmlContent = fs.readFileSync(req.file.path, 'utf8');
      const parser = new ApplicationsParserService();
      const appsData = await parser.parseApplicationsXml(xmlContent);
      const validation = parser.validateApplications(appsData);
      
      const appsForDb = parser.prepareApplicationsForDatabase(appsData, sourceConnectionId || undefined);
      const importedApps = [];
      let updatedCount = 0;
      
      for (const item of appsForDb) {
        try {
          const existing = await storage.getApplicationByName(item.application.applicationName, sourceConnectionId);
          let savedApp;
          if (existing) {
            savedApp = await storage.updateApplication(existing.id, item.application);
            updatedCount++;
          } else {
            savedApp = await storage.createApplication(item.application);
          }
          importedApps.push(savedApp);
        } catch (error) {
          console.error(`Error importing application ${item.application.applicationName}:`, error);
        }
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'import',
        message: `Applications import completed: ${importedApps.length - updatedCount} new, ${updatedCount} updated`,
        source: 'ApplicationsImporter',
      });

      fs.unlinkSync(req.file.path);

      res.json({
        message: "Applications imported successfully",
        imported: importedApps.length - updatedCount,
        updated: updatedCount,
        total: importedApps.length,
        applications: importedApps,
        validation,
      });
    } catch (error) {
      console.error("Error importing applications:", error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: "Failed to import applications" });
    }
  });

  // Triggers management
  app.get("/api/triggers", requireProjectAccess('view'), async (req, res) => {
    try {
      const { sourceConnectionId, search, isActive, limit = 100, offset = 0 } = req.query;

      const filters = {
        projectId: req.projectId!,
        sourceConnectionId: sourceConnectionId as string,
        search: search as string,
        isActive: isActive ? isActive === 'true' : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };
      const triggers = await storage.getTriggers(filters);
      res.json(triggers);
    } catch (error) {
      console.error("Error fetching triggers:", error);
      res.status(500).json({ message: "Failed to fetch triggers" });
    }
  });

  // Get trigger raw XML
  app.get("/api/triggers/:id/xml", requireProjectAccess('view'), async (req, res) => {
    try {
      const { id } = req.params;
      const trigger = await storage.getTrigger(id);
      if (!trigger) {
        return res.status(404).json({ message: "Trigger not found" });
      }
      if (trigger.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this trigger" });
      }
      
      const originalData = (trigger.metadata as any)?.originalData || (trigger.metadata as any)?.rawXml;
      if (!originalData) {
        return res.status(404).json({ message: "No XML data available for this trigger" });
      }
      
      const xmlString = xmlConverter.convertToXml(originalData, 'trigger');
      res.type('application/xml').send(xmlString);
    } catch (error) {
      console.error("Error fetching trigger XML:", error);
      res.status(500).json({ message: "Failed to fetch trigger XML" });
    }
  });

  app.post("/api/triggers", requireProjectAccess('update'), async (req, res) => {
    try {
      const trigger = await storage.createTrigger({ ...req.body, projectId: req.projectId });
      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Trigger created: ${trigger.directoryNumber}`,
        source: 'API',
        projectId: req.projectId,
      });
      res.json(trigger);
    } catch (error) {
      console.error("Error creating trigger:", error);
      res.status(500).json({ message: "Failed to create trigger" });
    }
  });

  app.put("/api/triggers/:id", requireProjectAccess('update'), async (req, res) => {
    try {
      const existingTrigger = await storage.getTrigger(req.params.id);
      if (!existingTrigger) {
        return res.status(404).json({ message: "Trigger not found" });
      }

      if (existingTrigger.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this trigger" });
      }

      const updated = await storage.updateTrigger(req.params.id, req.body);
      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Trigger updated: ${updated.directoryNumber}`,
        source: 'API',
        projectId: req.projectId,
      });
      res.json(updated);
    } catch (error) {
      console.error("Error updating trigger:", error);
      res.status(500).json({ message: "Failed to update trigger" });
    }
  });

  app.delete("/api/triggers/:id", requireProjectAccess('update'), async (req, res) => {
    try {
      const existingTrigger = await storage.getTrigger(req.params.id);
      if (!existingTrigger) {
        return res.status(404).json({ message: "Trigger not found" });
      }

      if (existingTrigger.projectId !== req.projectId) {
        return res.status(403).json({ message: "Access denied to this trigger" });
      }

      const deleted = await storage.deleteTrigger(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Trigger not found" });
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'system',
        message: `Trigger deleted: ${req.params.id}`,
        source: 'API',
        projectId: req.projectId,
      });

      res.json({ message: "Trigger deleted successfully" });
    } catch (error) {
      console.error("Error deleting trigger:", error);
      res.status(500).json({ message: "Failed to delete trigger" });
    }
  });

  app.post("/api/triggers/import", upload.single('triggersFile'), async (req: RequestWithFile, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No triggers XML file provided" });
      }
      
      let { sourceConnectionId } = req.body;
      if (sourceConnectionId) {
        const connection = await storage.getUccxConnection(sourceConnectionId);
        if (!connection) {
          sourceConnectionId = null;
        }
      } else {
        sourceConnectionId = null;
      }
      
      const xmlContent = fs.readFileSync(req.file.path, 'utf8');
      const parser = new TriggersParserService();
      const triggersData = await parser.parseTriggersXml(xmlContent);
      const validation = parser.validateTriggers(triggersData);
      
      const triggersForDb = parser.prepareTriggersForDatabase(triggersData, sourceConnectionId || undefined);
      const importedTriggers = [];
      let updatedCount = 0;
      
      for (const item of triggersForDb) {
        try {
          const existing = await storage.getTriggerByDirectoryNumber(item.trigger.directoryNumber, sourceConnectionId);
          let savedTrigger;
          if (existing) {
            savedTrigger = await storage.updateTrigger(existing.id, item.trigger);
            updatedCount++;
          } else {
            savedTrigger = await storage.createTrigger(item.trigger);
          }
          importedTriggers.push(savedTrigger);
        } catch (error) {
          console.error(`Error importing trigger ${item.trigger.directoryNumber}:`, error);
        }
      }

      await storage.createAuditLog({
        level: 'info',
        category: 'import',
        message: `Triggers import completed: ${importedTriggers.length - updatedCount} new, ${updatedCount} updated`,
        source: 'TriggersImporter',
      });

      fs.unlinkSync(req.file.path);

      res.json({
        message: "Triggers imported successfully",
        imported: importedTriggers.length - updatedCount,
        updated: updatedCount,
        total: importedTriggers.length,
        triggers: importedTriggers,
        validation,
      });
    } catch (error) {
      console.error("Error importing triggers:", error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: "Failed to import triggers" });
    }
  });

  // Audit logs
  // ============== Branding / System Settings ==============

  app.get("/api/settings/branding", async (req, res) => {
    try {
      const branding = await storage.getBranding();
      res.json(branding);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch branding" });
    }
  });

  app.put("/api/settings/branding", requireAdmin, async (req, res) => {
    try {
      const { appName, appSubtitle, logoDataUrl } = req.body;
      const updated = await storage.setBranding({
        ...(appName !== undefined && { appName }),
        ...(appSubtitle !== undefined && { appSubtitle }),
        ...(logoDataUrl !== undefined && { logoDataUrl }),
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update branding" });
    }
  });

  app.get("/api/logs", async (req, res) => {
    try {
      const { projectId, level, category, search, startDate, endDate, limit = 50, offset = 0 } = req.query;
      
      const filters = {
        projectId: projectId as string | undefined,
        level: level as string,
        category: category as string,
        search: search as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      const logs = await storage.getAuditLogs(filters);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  // WebSocket support for real-time updates
  const httpServer = createServer(app);

  // Migration job events
  migrationQueue.on('jobStarted', (jobStatus) => {
    console.log('Migration job started:', jobStatus.id);
  });

  migrationQueue.on('jobProgress', (jobStatus) => {
    console.log('Migration job progress:', jobStatus.id, jobStatus.progress + '%');
  });

  migrationQueue.on('jobCompleted', (jobStatus) => {
    console.log('Migration job completed:', jobStatus.id);
  });

  migrationQueue.on('jobFailed', (jobStatus) => {
    console.log('Migration job failed:', jobStatus.id, jobStatus.error);
  });

  migrationQueue.on('jobCancelled', (jobStatus) => {
    console.log('Migration job cancelled:', jobStatus.id);
  });

  return httpServer;
}

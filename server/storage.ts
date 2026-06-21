import {
  users,
  configurations,
  uccxConnections,
  migrationJobs,
  auditLogs,
  skills,
  resourceGroups,
  csqs,
  csqSkills,
  csqResourceGroups,
  resources,
  resourceSkills,
  teams,
  teamResources,
  applications,
  triggers,
  projects,
  projectMembers,
  projectSnapshots,
  type User,
  type InsertUser,
  type Configuration,
  type InsertConfiguration,
  type UccxConnection,
  type InsertUccxConnection,
  type MigrationJob,
  type InsertMigrationJob,
  type AuditLog,
  type InsertAuditLog,
  type Skill,
  type InsertSkill,
  type ResourceGroup,
  type InsertResourceGroup,
  type CSQ,
  type InsertCSQ,
  type CSQSkill,
  type InsertCSQSkill,
  type CSQResourceGroup,
  type InsertCSQResourceGroup,
  type Resource,
  type InsertResource,
  type ResourceSkill,
  type InsertResourceSkill,
  type Team,
  type InsertTeam,
  type TeamResource,
  type InsertTeamResource,
  type Application,
  type InsertApplication,
  type Trigger,
  type InsertTrigger,
  type Project,
  type InsertProject,
  type ProjectMember,
  type InsertProjectMember,
  type SafeUser,
  type ProjectSnapshot,
  systemSettings,
  type BrandingSettings,
  DEFAULT_BRANDING,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, like, ilike, gte, lte, sql, count, or } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<boolean>;
  updateLastLogin(id: string): Promise<void>;

  // Configurations
  getConfiguration(id: string): Promise<Configuration | undefined>;
  getConfigurations(filters?: {
    type?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Configuration[]>;
  createConfiguration(config: InsertConfiguration): Promise<Configuration>;
  updateConfiguration(id: string, config: Partial<Configuration>): Promise<Configuration>;
  deleteConfiguration(id: string): Promise<boolean>;
  deleteAllConfigurations(): Promise<boolean>;

  // UCCX Connections
  getUccxConnection(id: string): Promise<UccxConnection | undefined>;
  getUccxConnections(): Promise<UccxConnection[]>;
  getActiveUccxConnections(): Promise<UccxConnection[]>;
  createUccxConnection(connection: InsertUccxConnection): Promise<UccxConnection>;
  updateUccxConnection(id: string, connection: Partial<UccxConnection>): Promise<UccxConnection>;

  // Migration Jobs
  getMigrationJob(id: string): Promise<MigrationJob | undefined>;
  getMigrationJobs(filters?: {
    status?: string;
    configurationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<MigrationJob[]>;
  getActiveMigrationJobs(gracePeriodMs?: number): Promise<MigrationJob[]>;
  createMigrationJob(job: InsertMigrationJob): Promise<MigrationJob>;
  updateMigrationJob(id: string, job: Partial<MigrationJob>): Promise<MigrationJob>;

  // Branding / System Settings
  getBranding(): Promise<BrandingSettings>;
  setBranding(settings: Partial<BrandingSettings>): Promise<BrandingSettings>;

  // Audit Logs
  getAuditLogs(filters?: {
    projectId?: string;
    level?: string;
    category?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Skills
  getSkill(id: string): Promise<Skill | undefined>;
  getSkills(filters?: {
    projectId?: string;
    userId?: string;
    sourceConnectionId?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Skill[]>;
  createSkill(skill: InsertSkill): Promise<Skill>;
  updateSkill(id: string, skill: Partial<Skill>): Promise<Skill>;
  deleteSkill(id: string): Promise<boolean>;
  deleteAllSkills(): Promise<boolean>;
  getSkillBySkillId(skillId: string, sourceConnectionId?: string): Promise<Skill | undefined>;
  getTargetSkillId(originalSkillId: string, targetConnectionId: string): Promise<string | null>;
  getSkillsByTargetConnection(targetConnectionId: string): Promise<Skill[]>;

  // Resource Groups
  getResourceGroup(id: string): Promise<ResourceGroup | undefined>;
  getResourceGroups(filters?: {
    projectId?: string;
    userId?: string;
    sourceConnectionId?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ResourceGroup[]>;
  createResourceGroup(resourceGroup: InsertResourceGroup): Promise<ResourceGroup>;
  updateResourceGroup(id: string, resourceGroup: Partial<ResourceGroup>): Promise<ResourceGroup>;
  deleteResourceGroup(id: string): Promise<boolean>;
  deleteAllResourceGroups(): Promise<boolean>;
  getResourceGroupByResourceGroupId(resourceGroupId: number, sourceConnectionId?: string): Promise<ResourceGroup | undefined>;
  getTargetResourceGroupId(originalResourceGroupId: string, targetConnectionId: string): Promise<string | null>;
  getResourceGroupsByTargetConnection(targetConnectionId: string): Promise<ResourceGroup[]>;

  // CSQs
  getCSQ(id: string): Promise<CSQ | undefined>;
  getCSQs(filters?: {
    projectId?: string;
    userId?: string;
    sourceConnectionId?: string;
    search?: string;
    enabled?: boolean;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<CSQ[]>;
  createCSQ(csq: InsertCSQ): Promise<CSQ>;
  updateCSQ(id: string, csq: Partial<CSQ>): Promise<CSQ>;
  deleteCSQ(id: string): Promise<boolean>;
  deleteAllCSQs(): Promise<boolean>;
  getCSQByCSQId(csqId: string, sourceConnectionId?: string): Promise<CSQ | undefined>;
  getTargetCSQId(originalCSQId: string, targetConnectionId: string): Promise<string | null>;
  getCSQsByTargetConnection(targetConnectionId: string): Promise<CSQ[]>;

  // CSQ Skills
  getCSQSkills(csqId: string): Promise<CSQSkill[]>;
  createCSQSkill(csqSkill: InsertCSQSkill): Promise<CSQSkill>;
  deleteCSQSkills(csqId: string): Promise<boolean>;

  // Resources
  getResource(id: string): Promise<Resource | undefined>;
  getResources(filters?: {
    projectId?: string;
    userId?: string;
    sourceConnectionId?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Resource[]>;
  createResource(resource: InsertResource): Promise<Resource>;
  updateResource(id: string, resource: Partial<Resource>): Promise<Resource>;
  deleteResource(id: string): Promise<boolean>;
  deleteAllResources(): Promise<boolean>;
  getResourceByUserID(userID: string, sourceConnectionId?: string): Promise<Resource | undefined>;
  getTargetUserID(originalUserID: string, targetConnectionId: string): Promise<string | null>;
  getResourcesByTargetConnection(targetConnectionId: string): Promise<Resource[]>;

  // Resource Skills
  getResourceSkills(resourceId: string): Promise<ResourceSkill[]>;
  createResourceSkill(resourceSkill: InsertResourceSkill): Promise<ResourceSkill>;
  deleteResourceSkills(resourceId: string): Promise<boolean>;
  deleteAllResourceSkills(): Promise<boolean>;

  // Teams
  getTeam(id: string): Promise<Team | undefined>;
  getTeams(filters?: {
    projectId?: string;
    userId?: string;
    sourceConnectionId?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, team: Partial<Team>): Promise<Team>;
  deleteTeam(id: string): Promise<boolean>;
  deleteAllTeams(): Promise<boolean>;
  getTeamByTeamId(teamId: string, sourceConnectionId?: string): Promise<Team | undefined>;
  getTargetTeamId(originalTeamId: string, targetConnectionId: string): Promise<string | null>;
  getTeamsByTargetConnection(targetConnectionId: string): Promise<Team[]>;

  // Team Resources
  getTeamResources(teamId: string): Promise<TeamResource[]>;
  createTeamResource(teamResource: InsertTeamResource): Promise<TeamResource>;
  deleteTeamResources(teamId: string): Promise<boolean>;
  deleteAllTeamResources(): Promise<boolean>;

  // Applications
  getApplication(id: string): Promise<Application | undefined>;
  getApplications(filters?: {
    projectId?: string;
    userId?: string;
    sourceConnectionId?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Application[]>;
  createApplication(application: InsertApplication): Promise<Application>;
  updateApplication(id: string, application: Partial<Application>): Promise<Application>;
  deleteApplication(id: string): Promise<boolean>;
  deleteAllApplications(): Promise<boolean>;
  getApplicationByName(applicationName: string, sourceConnectionId?: string): Promise<Application | undefined>;
  getTargetApplicationName(originalApplicationName: string, targetConnectionId: string): Promise<string | null>;
  getApplicationsByTargetConnection(targetConnectionId: string): Promise<Application[]>;

  // Triggers
  getTrigger(id: string): Promise<Trigger | undefined>;
  getTriggers(filters?: {
    projectId?: string;
    userId?: string;
    sourceConnectionId?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Trigger[]>;
  createTrigger(trigger: InsertTrigger): Promise<Trigger>;
  updateTrigger(id: string, trigger: Partial<Trigger>): Promise<Trigger>;
  deleteTrigger(id: string): Promise<boolean>;
  deleteAllTriggers(): Promise<boolean>;
  getTriggerByDirectoryNumber(directoryNumber: string, sourceConnectionId?: string): Promise<Trigger | undefined>;
  getTargetDirectoryNumber(originalDirectoryNumber: string, targetConnectionId: string): Promise<string | null>;
  getTriggersByTargetConnection(targetConnectionId: string): Promise<Trigger[]>;

  // Statistics
  getStatistics(): Promise<{
    importedConfigs: number;
    successfulMigrations: number;
    pendingMigrations: number;
    failedMigrations: number;
  }>;
  
  getProjectStatistics(projectId: string): Promise<{
    importedConfigs: number;
    successfulMigrations: number;
    pendingMigrations: number;
    failedMigrations: number;
    skills: number;
    resourceGroups: number;
    resources: number;
    teams: number;
    csqs: number;
    applications: number;
    triggers: number;
    sourceConnections: number;
    destinationConnections: number;
  }>;
  
  getProjectsWithStats(userId: string): Promise<Array<{
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    ownerUsername: string;
    isActive: boolean;
    createdAt: Date;
    stats: {
      sourceConnections: number;
      destinationConnections: number;
      skills: number;
      resourceGroups: number;
      resources: number;
      teams: number;
      csqs: number;
      applications: number;
      triggers: number;
      successfulMigrations: number;
      failedMigrations: number;
    };
  }>>;

  // User-scoped delete methods for multi-tenant data isolation
  deleteUserConfigurations(userId: string): Promise<boolean>;
  deleteUserSkills(userId: string): Promise<boolean>;
  deleteUserResourceGroups(userId: string): Promise<boolean>;
  deleteUserCSQs(userId: string): Promise<boolean>;
  deleteUserResources(userId: string): Promise<boolean>;
  deleteUserTeams(userId: string): Promise<boolean>;
  deleteUserApplications(userId: string): Promise<boolean>;
  deleteUserTriggers(userId: string): Promise<boolean>;
  deleteUserMigrationJobs(userId: string): Promise<boolean>;

  // Project-scoped delete methods for project-based data isolation
  deleteProjectConfigurations(projectId: string): Promise<boolean>;
  deleteProjectSkills(projectId: string): Promise<boolean>;
  deleteProjectResourceGroups(projectId: string): Promise<boolean>;
  deleteProjectCSQs(projectId: string): Promise<boolean>;
  deleteProjectResources(projectId: string): Promise<boolean>;
  deleteProjectTeams(projectId: string): Promise<boolean>;
  deleteProjectApplications(projectId: string): Promise<boolean>;
  deleteProjectTriggers(projectId: string): Promise<boolean>;
  deleteProjectMigrationJobs(projectId: string): Promise<boolean>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getProjects(filters?: {
    ownerId?: string;
    userId?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Project[]>;
  getProjectsForUser(userId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<Project>): Promise<Project>;
  deleteProject(id: string): Promise<boolean>;
  getProjectBlockingCounts(projectId: string): Promise<Record<string, number>>;

  // Project Members
  getProjectMember(id: string): Promise<ProjectMember | undefined>;
  getProjectMembers(projectId: string): Promise<ProjectMember[]>;
  getProjectMemberByUserAndProject(userId: string, projectId: string): Promise<ProjectMember | undefined>;
  createProjectMember(member: InsertProjectMember): Promise<ProjectMember>;
  updateProjectMember(id: string, member: Partial<ProjectMember>): Promise<ProjectMember>;
  deleteProjectMember(id: string): Promise<boolean>;
  deleteProjectMembers(projectId: string): Promise<boolean>;
  deleteProjectAuditLogs(projectId: string): Promise<boolean>;
  getUserProjectPermissions(userId: string, projectId: string): Promise<ProjectMember | undefined>;

  // Project Snapshots
  createProjectSnapshot(projectId: string, name: string, trigger: string, createdBy: string | null): Promise<ProjectSnapshot>;
  listProjectSnapshots(projectId: string): Promise<ProjectSnapshot[]>;
  getProjectSnapshot(id: string, projectId: string): Promise<ProjectSnapshot | undefined>;
  deleteProjectSnapshot(id: string, projectId: string): Promise<boolean>;
  restoreProjectSnapshot(id: string, projectId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async updateLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  // Configurations
  async getConfiguration(id: string): Promise<Configuration | undefined> {
    const [config] = await db.select().from(configurations).where(eq(configurations.id, id));
    return config || undefined;
  }

  async getConfigurations(filters?: {
    type?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Configuration[]> {
    let query = db.select().from(configurations);
    const conditions = [];

    if (filters?.type) {
      conditions.push(eq(configurations.type, filters.type as any));
    }

    if (filters?.status) {
      conditions.push(eq(configurations.status, filters.status as any));
    }

    if (filters?.search) {
      conditions.push(like(configurations.name, `%${filters.search}%`));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(configurations.importedAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async createConfiguration(config: InsertConfiguration): Promise<Configuration> {
    const [created] = await db.insert(configurations).values(config).returning();
    return created;
  }

  async updateConfiguration(id: string, config: Partial<Configuration>): Promise<Configuration> {
    const [updated] = await db
      .update(configurations)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(configurations.id, id))
      .returning();
    return updated;
  }

  async deleteConfiguration(id: string): Promise<boolean> {
    const result = await db.delete(configurations).where(eq(configurations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteAllConfigurations(): Promise<boolean> {
    const result = await db.delete(configurations);
    return result.rowCount !== null && result.rowCount >= 0;
  }

  // UCCX Connections
  async getUccxConnection(id: string): Promise<UccxConnection | undefined> {
    const [connection] = await db.select().from(uccxConnections).where(eq(uccxConnections.id, id));
    return connection || undefined;
  }

  async getUccxConnections(filters?: { isSource?: boolean; projectId?: string }): Promise<UccxConnection[]> {
    const conditions = [];
    
    if (filters?.projectId) {
      conditions.push(eq(uccxConnections.projectId, filters.projectId));
    }
    
    if (filters?.isSource !== undefined) {
      conditions.push(eq(uccxConnections.isSource, filters.isSource));
    }
    
    let query = db.select().from(uccxConnections);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(uccxConnections.name);
  }

  async getActiveUccxConnections(): Promise<UccxConnection[]> {
    return await db
      .select()
      .from(uccxConnections)
      .where(eq(uccxConnections.isActive, true))
      .orderBy(uccxConnections.name);
  }

  async createUccxConnection(connection: InsertUccxConnection): Promise<UccxConnection> {
    const [created] = await db.insert(uccxConnections).values(connection).returning();
    return created;
  }

  async updateUccxConnection(id: string, connection: Partial<UccxConnection>): Promise<UccxConnection> {
    const [updated] = await db
      .update(uccxConnections)
      .set({ ...connection, updatedAt: new Date() })
      .where(eq(uccxConnections.id, id))
      .returning();
    return updated;
  }

  async deleteUccxConnection(id: string): Promise<boolean> {
    const result = await db.delete(uccxConnections).where(eq(uccxConnections.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Migration Jobs
  async getMigrationJob(id: string): Promise<MigrationJob | undefined> {
    const [job] = await db.select().from(migrationJobs).where(eq(migrationJobs.id, id));
    return job || undefined;
  }

  async getMigrationJobs(filters?: {
    status?: string;
    configurationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<MigrationJob[]> {
    let query = db.select().from(migrationJobs);
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(migrationJobs.status, filters.status as any));
    }

    if (filters?.configurationId) {
      conditions.push(eq(migrationJobs.configurationId, filters.configurationId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(migrationJobs.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async getActiveMigrationJobs(gracePeriodMs = 60000): Promise<MigrationJob[]> {
    const graceStart = new Date(Date.now() - gracePeriodMs);
    const results = await db
      .select()
      .from(migrationJobs)
      .where(
        sql`${migrationJobs.status} IN ('pending', 'running') OR ${migrationJobs.completedAt} >= ${graceStart}`
      )
      .orderBy(desc(migrationJobs.createdAt))
      .limit(50);
    return results;
  }

  async createMigrationJob(job: InsertMigrationJob): Promise<MigrationJob> {
    const [created] = await db.insert(migrationJobs).values(job).returning();
    return created;
  }

  async updateMigrationJob(id: string, job: Partial<MigrationJob>): Promise<MigrationJob> {
    const [updated] = await db
      .update(migrationJobs)
      .set({ ...job, updatedAt: new Date() })
      .where(eq(migrationJobs.id, id))
      .returning();
    return updated;
  }

  // Branding / System Settings
  async getBranding(): Promise<BrandingSettings> {
    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, 'branding'));
    if (rows.length === 0 || !rows[0].value) return { ...DEFAULT_BRANDING };
    try {
      return { ...DEFAULT_BRANDING, ...JSON.parse(rows[0].value) };
    } catch {
      return { ...DEFAULT_BRANDING };
    }
  }

  async setBranding(settings: Partial<BrandingSettings>): Promise<BrandingSettings> {
    const current = await this.getBranding();
    const merged = { ...current, ...settings };
    await db.insert(systemSettings)
      .values({ key: 'branding', value: JSON.stringify(merged), updatedAt: new Date() })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: JSON.stringify(merged), updatedAt: new Date() } });
    return merged;
  }

  // Audit Logs
  async getAuditLogs(filters?: {
    projectId?: string;
    level?: string;
    category?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs);
    const conditions = [];

    if (filters?.projectId) {
      conditions.push(eq(auditLogs.projectId, filters.projectId));
    }

    if (filters?.level) {
      conditions.push(eq(auditLogs.level, filters.level as any));
    }

    if (filters?.category) {
      conditions.push(eq(auditLogs.category, filters.category as any));
    }

    if (filters?.search) {
      conditions.push(or(
        ilike(auditLogs.message, `%${filters.search}%`),
        ilike(auditLogs.source, `%${filters.search}%`),
      ));
    }

    if (filters?.startDate) {
      conditions.push(gte(auditLogs.timestamp, filters.startDate));
    }

    if (filters?.endDate) {
      conditions.push(lte(auditLogs.timestamp, filters.endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(auditLogs.timestamp));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog | null> {
    if (log.projectId) {
      const project = await db.select({ logLevel: projects.logLevel }).from(projects).where(eq(projects.id, log.projectId)).limit(1);
      if (project.length > 0) {
        const levelOrder = { error: 0, warning: 1, info: 2, debug: 3 };
        const projectMinLevel = levelOrder[project[0].logLevel as keyof typeof levelOrder] ?? 2;
        const entryLevel = levelOrder[log.level as keyof typeof levelOrder] ?? 2;
        if (entryLevel > projectMinLevel) return null;
      }
    }
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  // Skills
  async getSkill(id: string): Promise<Skill | undefined> {
    const [skill] = await db.select().from(skills).where(eq(skills.id, id));
    return skill || undefined;
  }

  async getSkills(filters?: {
    projectId?: string;
    userId?: string;
    sourceConnectionId?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Skill[]> {
    let query = db.select().from(skills);
    const conditions = [];

    if (filters?.projectId) {
      conditions.push(eq(skills.projectId, filters.projectId));
    }

    if (filters?.userId) {
      conditions.push(eq(skills.userId, filters.userId));
    }

    if (filters?.sourceConnectionId) {
      conditions.push(eq(skills.sourceConnectionId, filters.sourceConnectionId));
    }

    if (filters?.search) {
      conditions.push(like(skills.skillName, `%${filters.search}%`));
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(skills.isActive, filters.isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(skills.importedAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async createSkill(skill: InsertSkill): Promise<Skill> {
    const [created] = await db.insert(skills).values(skill).returning();
    return created;
  }

  async updateSkill(id: string, skill: Partial<Skill>): Promise<Skill> {
    const [updated] = await db
      .update(skills)
      .set({ ...skill, updatedAt: new Date() })
      .where(eq(skills.id, id))
      .returning();
    return updated;
  }

  async deleteSkill(id: string): Promise<boolean> {
    const result = await db.delete(skills).where(eq(skills.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteAllSkills(): Promise<boolean> {
    const result = await db.delete(skills);
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async getSkillBySkillId(skillId: string, sourceConnectionId?: string): Promise<Skill | undefined> {
    let query = db.select().from(skills).where(eq(skills.skillId, skillId));
    
    if (sourceConnectionId) {
      query = query.where(and(eq(skills.skillId, skillId), eq(skills.sourceConnectionId, sourceConnectionId)));
    }

    const [skill] = await query;
    return skill || undefined;
  }

  async getTargetSkillId(originalSkillId: string, targetConnectionId: string): Promise<string | null> {
    const [skill] = await db
      .select({ targetSkillId: skills.targetSkillId })
      .from(skills)
      .where(and(
        eq(skills.skillId, originalSkillId),
        eq(skills.targetConnectionId, targetConnectionId)
      ));
    
    return skill?.targetSkillId || null;
  }

  async getSkillsByTargetConnection(targetConnectionId: string): Promise<Skill[]> {
    return await db
      .select()
      .from(skills)
      .where(eq(skills.targetConnectionId, targetConnectionId))
      .orderBy(desc(skills.updatedAt));
  }

  // Resource Groups
  async getResourceGroup(id: string): Promise<ResourceGroup | undefined> {
    const [resourceGroup] = await db.select().from(resourceGroups).where(eq(resourceGroups.id, id));
    return resourceGroup || undefined;
  }

  async getResourceGroups(filters?: {
    projectId?: string;
    userId?: string;
    sourceConnectionId?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ResourceGroup[]> {
    let query = db.select().from(resourceGroups);
    const conditions = [];

    if (filters?.projectId) {
      conditions.push(eq(resourceGroups.projectId, filters.projectId));
    }

    if (filters?.userId) {
      conditions.push(eq(resourceGroups.userId, filters.userId));
    }

    if (filters?.sourceConnectionId) {
      conditions.push(eq(resourceGroups.sourceConnectionId, filters.sourceConnectionId));
    }

    if (filters?.search) {
      conditions.push(like(resourceGroups.name, `%${filters.search}%`));
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(resourceGroups.isActive, filters.isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(resourceGroups.importedAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async createResourceGroup(resourceGroup: InsertResourceGroup): Promise<ResourceGroup> {
    const [created] = await db.insert(resourceGroups).values(resourceGroup).returning();
    return created;
  }

  async updateResourceGroup(id: string, resourceGroup: Partial<ResourceGroup>): Promise<ResourceGroup> {
    const [updated] = await db
      .update(resourceGroups)
      .set({ ...resourceGroup, updatedAt: new Date() })
      .where(eq(resourceGroups.id, id))
      .returning();
    return updated;
  }

  async deleteResourceGroup(id: string): Promise<boolean> {
    const result = await db.delete(resourceGroups).where(eq(resourceGroups.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteAllResourceGroups(): Promise<boolean> {
    const result = await db.delete(resourceGroups);
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async getResourceGroupByResourceGroupId(resourceGroupId: number, sourceConnectionId?: string): Promise<ResourceGroup | undefined> {
    let query = db.select().from(resourceGroups).where(eq(resourceGroups.resourceGroupId, resourceGroupId));
    
    if (sourceConnectionId) {
      query = query.where(and(eq(resourceGroups.resourceGroupId, resourceGroupId), eq(resourceGroups.sourceConnectionId, sourceConnectionId)));
    }

    const [resourceGroup] = await query;
    return resourceGroup || undefined;
  }

  async getTargetResourceGroupId(originalResourceGroupId: string, targetConnectionId: string): Promise<string | null> {
    const [resourceGroup] = await db
      .select({ targetResourceGroupId: resourceGroups.targetResourceGroupId })
      .from(resourceGroups)
      .where(and(
        eq(resourceGroups.resourceGroupId, parseInt(originalResourceGroupId)),
        eq(resourceGroups.targetConnectionId, targetConnectionId)
      ));
    
    return resourceGroup?.targetResourceGroupId || null;
  }

  async getResourceGroupsByTargetConnection(targetConnectionId: string): Promise<ResourceGroup[]> {
    return await db
      .select()
      .from(resourceGroups)
      .where(eq(resourceGroups.targetConnectionId, targetConnectionId))
      .orderBy(desc(resourceGroups.updatedAt));
  }

  // CSQs
  async getCSQ(id: string): Promise<CSQ | undefined> {
    const [csq] = await db.select().from(csqs).where(eq(csqs.id, id));
    return csq || undefined;
  }

  async getCSQs(filters?: {
    projectId?: string;
    userId?: string;
    sourceConnectionId?: string;
    search?: string;
    enabled?: boolean;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<CSQ[]> {
    let query = db.select().from(csqs);
    const conditions = [];

    if (filters?.projectId) {
      conditions.push(eq(csqs.projectId, filters.projectId));
    }

    if (filters?.userId) {
      conditions.push(eq(csqs.userId, filters.userId));
    }

    if (filters?.sourceConnectionId) {
      conditions.push(eq(csqs.sourceConnectionId, filters.sourceConnectionId));
    }

    if (filters?.search) {
      conditions.push(like(csqs.name, `%${filters.search}%`));
    }

    if (filters?.enabled !== undefined) {
      conditions.push(eq(csqs.enabled, filters.enabled));
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(csqs.isActive, filters.isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(csqs.importedAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async createCSQ(csq: InsertCSQ): Promise<CSQ> {
    const [created] = await db.insert(csqs).values(csq).returning();
    return created;
  }

  async updateCSQ(id: string, csq: Partial<CSQ>): Promise<CSQ> {
    const [updated] = await db
      .update(csqs)
      .set({ ...csq, updatedAt: new Date() })
      .where(eq(csqs.id, id))
      .returning();
    return updated;
  }

  async deleteCSQ(id: string): Promise<boolean> {
    const result = await db.delete(csqs).where(eq(csqs.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteAllCSQs(): Promise<boolean> {
    const result = await db.delete(csqs);
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async getCSQByCSQId(csqId: string, sourceConnectionId?: string): Promise<CSQ | undefined> {
    let query = db.select().from(csqs).where(eq(csqs.csqId, csqId));
    
    if (sourceConnectionId) {
      query = query.where(and(eq(csqs.csqId, csqId), eq(csqs.sourceConnectionId, sourceConnectionId)));
    }

    const [csq] = await query;
    return csq || undefined;
  }

  async getTargetCSQId(originalCSQId: string, targetConnectionId: string): Promise<string | null> {
    const [csq] = await db
      .select({ targetCSQId: csqs.targetCSQId })
      .from(csqs)
      .where(and(
        eq(csqs.csqId, originalCSQId),
        eq(csqs.targetConnectionId, targetConnectionId)
      ));
    
    return csq?.targetCSQId || null;
  }

  async getCSQsByTargetConnection(targetConnectionId: string): Promise<CSQ[]> {
    return await db
      .select()
      .from(csqs)
      .where(eq(csqs.targetConnectionId, targetConnectionId))
      .orderBy(desc(csqs.updatedAt));
  }

  // CSQ Skills
  async getCSQSkills(csqId: string): Promise<CSQSkill[]> {
    return await db.select().from(csqSkills).where(eq(csqSkills.csqId, csqId));
  }

  async createCSQSkill(csqSkill: InsertCSQSkill): Promise<CSQSkill> {
    const [created] = await db.insert(csqSkills).values(csqSkill).returning();
    return created;
  }

  async deleteCSQSkills(csqId: string): Promise<boolean> {
    const result = await db.delete(csqSkills).where(eq(csqSkills.csqId, csqId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  // CSQ Resource Groups
  async getCSQResourceGroups(csqId: string): Promise<CSQResourceGroup[]> {
    return await db.select().from(csqResourceGroups).where(eq(csqResourceGroups.csqId, csqId));
  }

  async createCSQResourceGroup(csqResourceGroup: InsertCSQResourceGroup): Promise<CSQResourceGroup> {
    const [created] = await db.insert(csqResourceGroups).values(csqResourceGroup).returning();
    return created;
  }

  async deleteCSQResourceGroups(csqId: string): Promise<boolean> {
    const result = await db.delete(csqResourceGroups).where(eq(csqResourceGroups.csqId, csqId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  // Resources
  async getResource(id: string): Promise<Resource | undefined> {
    const [resource] = await db.select().from(resources).where(eq(resources.id, id));
    return resource || undefined;
  }

  async getResources(filters?: {
    projectId?: string;
    userId?: string;
    sourceConnectionId?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Resource[]> {
    let query = db.select().from(resources);
    const conditions = [];

    if (filters?.projectId) {
      conditions.push(eq(resources.projectId, filters.projectId));
    }

    if (filters?.userId) {
      conditions.push(eq(resources.ownerId, filters.userId));
    }

    if (filters?.sourceConnectionId) {
      conditions.push(eq(resources.sourceConnectionId, filters.sourceConnectionId));
    }

    if (filters?.search) {
      conditions.push(
        sql`(${like(resources.userID, `%${filters.search}%`)} OR ${like(resources.firstName, `%${filters.search}%`)} OR ${like(resources.lastName, `%${filters.search}%`)})`
      );
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(resources.isActive, filters.isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(resources.importedAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async createResource(resource: InsertResource): Promise<Resource> {
    const [created] = await db.insert(resources).values(resource).returning();
    return created;
  }

  async updateResource(id: string, resource: Partial<Resource>): Promise<Resource> {
    const [updated] = await db
      .update(resources)
      .set({ ...resource, updatedAt: new Date() })
      .where(eq(resources.id, id))
      .returning();
    return updated;
  }

  async deleteResource(id: string): Promise<boolean> {
    const result = await db.delete(resources).where(eq(resources.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteAllResources(): Promise<boolean> {
    const result = await db.delete(resources);
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async getResourceByUserID(userID: string, sourceConnectionId?: string): Promise<Resource | undefined> {
    let query = db.select().from(resources).where(eq(resources.userID, userID));
    
    if (sourceConnectionId) {
      query = query.where(and(eq(resources.userID, userID), eq(resources.sourceConnectionId, sourceConnectionId)));
    }

    const [resource] = await query;
    return resource || undefined;
  }

  async getTargetUserID(originalUserID: string, targetConnectionId: string): Promise<string | null> {
    const [resource] = await db
      .select({ targetUserID: resources.targetUserID })
      .from(resources)
      .where(and(
        eq(resources.userID, originalUserID),
        eq(resources.targetConnectionId, targetConnectionId)
      ));
    
    return resource?.targetUserID || null;
  }

  async getResourcesByTargetConnection(targetConnectionId: string): Promise<Resource[]> {
    return await db
      .select()
      .from(resources)
      .where(eq(resources.targetConnectionId, targetConnectionId))
      .orderBy(desc(resources.updatedAt));
  }

  // Resource Skills
  async getResourceSkills(resourceId: string): Promise<ResourceSkill[]> {
    return await db.select().from(resourceSkills).where(eq(resourceSkills.resourceId, resourceId));
  }

  async createResourceSkill(resourceSkill: InsertResourceSkill): Promise<ResourceSkill> {
    const [created] = await db.insert(resourceSkills).values(resourceSkill).returning();
    return created;
  }

  async deleteResourceSkills(resourceId: string): Promise<boolean> {
    const result = await db.delete(resourceSkills).where(eq(resourceSkills.resourceId, resourceId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteAllResourceSkills(): Promise<boolean> {
    const result = await db.delete(resourceSkills);
    return result.rowCount !== null && result.rowCount >= 0;
  }

  // Teams
  async getTeam(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team || undefined;
  }

  async getTeams(filters?: {
    projectId?: string;
    userId?: string;
    sourceConnectionId?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Team[]> {
    let query = db.select().from(teams);
    const conditions = [];

    if (filters?.projectId) {
      conditions.push(eq(teams.projectId, filters.projectId));
    }

    if (filters?.userId) {
      conditions.push(eq(teams.userId, filters.userId));
    }

    if (filters?.sourceConnectionId) {
      conditions.push(eq(teams.sourceConnectionId, filters.sourceConnectionId));
    }

    if (filters?.search) {
      conditions.push(like(teams.teamname, `%${filters.search}%`));
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(teams.isActive, filters.isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(teams.importedAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [created] = await db.insert(teams).values(team).returning();
    return created;
  }

  async updateTeam(id: string, team: Partial<Team>): Promise<Team> {
    const [updated] = await db
      .update(teams)
      .set({ ...team, updatedAt: new Date() })
      .where(eq(teams.id, id))
      .returning();
    return updated;
  }

  async deleteTeam(id: string): Promise<boolean> {
    const result = await db.delete(teams).where(eq(teams.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteAllTeams(): Promise<boolean> {
    const result = await db.delete(teams);
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async getTeamByTeamId(teamId: string, sourceConnectionId?: string): Promise<Team | undefined> {
    let query = db.select().from(teams).where(eq(teams.teamId, teamId));
    
    if (sourceConnectionId) {
      query = query.where(and(eq(teams.teamId, teamId), eq(teams.sourceConnectionId, sourceConnectionId)));
    }

    const [team] = await query;
    return team || undefined;
  }

  async getTargetTeamId(originalTeamId: string, targetConnectionId: string): Promise<string | null> {
    const [team] = await db
      .select({ targetTeamId: teams.targetTeamId })
      .from(teams)
      .where(and(
        eq(teams.teamId, originalTeamId),
        eq(teams.targetConnectionId, targetConnectionId)
      ));
    
    return team?.targetTeamId || null;
  }

  async getTeamsByTargetConnection(targetConnectionId: string): Promise<Team[]> {
    return await db
      .select()
      .from(teams)
      .where(eq(teams.targetConnectionId, targetConnectionId))
      .orderBy(desc(teams.updatedAt));
  }

  // Team Resources
  async getTeamResources(teamId: string): Promise<TeamResource[]> {
    return await db.select().from(teamResources).where(eq(teamResources.teamId, teamId));
  }

  async createTeamResource(teamResource: InsertTeamResource): Promise<TeamResource> {
    const [created] = await db.insert(teamResources).values(teamResource).returning();
    return created;
  }

  async deleteTeamResources(teamId: string): Promise<boolean> {
    const result = await db.delete(teamResources).where(eq(teamResources.teamId, teamId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteAllTeamResources(): Promise<boolean> {
    const result = await db.delete(teamResources);
    return result.rowCount !== null && result.rowCount >= 0;
  }

  // Applications
  async getApplication(id: string): Promise<Application | undefined> {
    const [application] = await db.select().from(applications).where(eq(applications.id, id));
    return application || undefined;
  }

  async getApplications(filters?: {
    projectId?: string;
    userId?: string;
    sourceConnectionId?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Application[]> {
    let query = db.select().from(applications);
    const conditions = [];

    if (filters?.projectId) {
      conditions.push(eq(applications.projectId, filters.projectId));
    }

    if (filters?.userId) {
      conditions.push(eq(applications.userId, filters.userId));
    }

    if (filters?.sourceConnectionId) {
      conditions.push(eq(applications.sourceConnectionId, filters.sourceConnectionId));
    }

    if (filters?.search) {
      conditions.push(
        sql`(${like(applications.applicationName, `%${filters.search}%`)} OR ${like(applications.description, `%${filters.search}%`)})`
      );
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(applications.isActive, filters.isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(applications.importedAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async createApplication(application: InsertApplication): Promise<Application> {
    const [created] = await db.insert(applications).values(application).returning();
    return created;
  }

  async updateApplication(id: string, application: Partial<Application>): Promise<Application> {
    const [updated] = await db
      .update(applications)
      .set({ ...application, updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning();
    return updated;
  }

  async deleteApplication(id: string): Promise<boolean> {
    const result = await db.delete(applications).where(eq(applications.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteAllApplications(): Promise<boolean> {
    const result = await db.delete(applications);
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async getApplicationByName(applicationName: string, sourceConnectionId?: string): Promise<Application | undefined> {
    let query = db.select().from(applications).where(eq(applications.applicationName, applicationName));
    
    if (sourceConnectionId) {
      query = query.where(and(eq(applications.applicationName, applicationName), eq(applications.sourceConnectionId, sourceConnectionId)));
    }

    const [application] = await query;
    return application || undefined;
  }

  async getTargetApplicationName(originalApplicationName: string, targetConnectionId: string): Promise<string | null> {
    const [application] = await db
      .select()
      .from(applications)
      .where(
        and(
          eq(applications.applicationName, originalApplicationName),
          eq(applications.targetConnectionId, targetConnectionId)
        )
      );
    
    return application?.targetApplicationName || null;
  }

  async getApplicationsByTargetConnection(targetConnectionId: string): Promise<Application[]> {
    return await db
      .select()
      .from(applications)
      .where(eq(applications.targetConnectionId, targetConnectionId))
      .orderBy(desc(applications.updatedAt));
  }

  // Triggers
  async getTrigger(id: string): Promise<Trigger | undefined> {
    const [trigger] = await db.select().from(triggers).where(eq(triggers.id, id));
    return trigger || undefined;
  }

  async getTriggers(filters?: {
    projectId?: string;
    userId?: string;
    sourceConnectionId?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Trigger[]> {
    let query = db.select().from(triggers);
    const conditions = [];

    if (filters?.projectId) {
      conditions.push(eq(triggers.projectId, filters.projectId));
    }

    if (filters?.userId) {
      conditions.push(eq(triggers.userId, filters.userId));
    }

    if (filters?.sourceConnectionId) {
      conditions.push(eq(triggers.sourceConnectionId, filters.sourceConnectionId));
    }

    if (filters?.search) {
      conditions.push(
        sql`(${like(triggers.directoryNumber, `%${filters.search}%`)} OR ${like(triggers.description, `%${filters.search}%`)} OR ${like(triggers.deviceName, `%${filters.search}%`)})`
      );
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(triggers.isActive, filters.isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(triggers.importedAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async createTrigger(trigger: InsertTrigger): Promise<Trigger> {
    const [created] = await db.insert(triggers).values(trigger).returning();
    return created;
  }

  async updateTrigger(id: string, trigger: Partial<Trigger>): Promise<Trigger> {
    const [updated] = await db
      .update(triggers)
      .set({ ...trigger, updatedAt: new Date() })
      .where(eq(triggers.id, id))
      .returning();
    return updated;
  }

  async deleteTrigger(id: string): Promise<boolean> {
    const result = await db.delete(triggers).where(eq(triggers.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteAllTriggers(): Promise<boolean> {
    const result = await db.delete(triggers);
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async getTriggerByDirectoryNumber(directoryNumber: string, sourceConnectionId?: string): Promise<Trigger | undefined> {
    let query = db.select().from(triggers).where(eq(triggers.directoryNumber, directoryNumber));
    
    if (sourceConnectionId) {
      query = query.where(and(eq(triggers.directoryNumber, directoryNumber), eq(triggers.sourceConnectionId, sourceConnectionId)));
    }

    const [trigger] = await query;
    return trigger || undefined;
  }

  async getTargetDirectoryNumber(originalDirectoryNumber: string, targetConnectionId: string): Promise<string | null> {
    const [trigger] = await db
      .select()
      .from(triggers)
      .where(
        and(
          eq(triggers.directoryNumber, originalDirectoryNumber),
          eq(triggers.targetConnectionId, targetConnectionId)
        )
      );
    
    return trigger?.targetDirectoryNumber || null;
  }

  async getTriggersByTargetConnection(targetConnectionId: string): Promise<Trigger[]> {
    return await db
      .select()
      .from(triggers)
      .where(eq(triggers.targetConnectionId, targetConnectionId))
      .orderBy(desc(triggers.updatedAt));
  }

  async getStatistics(): Promise<{
    importedConfigs: number;
    successfulMigrations: number;
    pendingMigrations: number;
    failedMigrations: number;
  }> {
    const [configCount] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(configurations);

    const [successfulMigrations] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(migrationJobs)
      .where(eq(migrationJobs.status, "completed"));

    const [pendingMigrations] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(migrationJobs)
      .where(eq(migrationJobs.status, "pending"));

    const [failedMigrations] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(migrationJobs)
      .where(eq(migrationJobs.status, "failed"));

    return {
      importedConfigs: configCount?.count || 0,
      successfulMigrations: successfulMigrations?.count || 0,
      pendingMigrations: pendingMigrations?.count || 0,
      failedMigrations: failedMigrations?.count || 0,
    };
  }

  async getProjectStatistics(projectId: string): Promise<{
    importedConfigs: number;
    successfulMigrations: number;
    pendingMigrations: number;
    failedMigrations: number;
    skills: number;
    resourceGroups: number;
    resources: number;
    teams: number;
    csqs: number;
    applications: number;
    triggers: number;
    sourceConnections: number;
    destinationConnections: number;
  }> {
    const [configCount] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(configurations)
      .where(eq(configurations.projectId, projectId));

    const [successfulMigrations] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(migrationJobs)
      .where(and(eq(migrationJobs.projectId, projectId), eq(migrationJobs.status, "completed")));

    const [pendingMigrations] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(migrationJobs)
      .where(and(eq(migrationJobs.projectId, projectId), eq(migrationJobs.status, "pending")));

    const [failedMigrations] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(migrationJobs)
      .where(and(eq(migrationJobs.projectId, projectId), eq(migrationJobs.status, "failed")));

    const [skillsCount] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(skills)
      .where(eq(skills.projectId, projectId));

    const [resourceGroupsCount] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(resourceGroups)
      .where(eq(resourceGroups.projectId, projectId));

    const [resourcesCount] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(resources)
      .where(eq(resources.projectId, projectId));

    const [teamsCount] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(teams)
      .where(eq(teams.projectId, projectId));

    const [csqsCount] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(csqs)
      .where(eq(csqs.projectId, projectId));

    const [applicationsCount] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(applications)
      .where(eq(applications.projectId, projectId));

    const [triggersCount] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(triggers)
      .where(eq(triggers.projectId, projectId));

    const [sourceConnCount] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(uccxConnections)
      .where(and(eq(uccxConnections.projectId, projectId), eq(uccxConnections.isSource, true)));

    const [destConnCount] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(uccxConnections)
      .where(and(eq(uccxConnections.projectId, projectId), eq(uccxConnections.isSource, false)));

    return {
      importedConfigs: configCount?.count || 0,
      successfulMigrations: successfulMigrations?.count || 0,
      pendingMigrations: pendingMigrations?.count || 0,
      failedMigrations: failedMigrations?.count || 0,
      skills: skillsCount?.count || 0,
      resourceGroups: resourceGroupsCount?.count || 0,
      resources: resourcesCount?.count || 0,
      teams: teamsCount?.count || 0,
      csqs: csqsCount?.count || 0,
      applications: applicationsCount?.count || 0,
      triggers: triggersCount?.count || 0,
      sourceConnections: sourceConnCount?.count || 0,
      destinationConnections: destConnCount?.count || 0,
    };
  }

  async getProjectsWithStats(userId: string): Promise<Array<{
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    ownerUsername: string;
    isActive: boolean;
    createdAt: Date;
    stats: {
      sourceConnections: number;
      destinationConnections: number;
      skills: number;
      resourceGroups: number;
      resources: number;
      teams: number;
      csqs: number;
      applications: number;
      triggers: number;
      successfulMigrations: number;
      failedMigrations: number;
    };
  }>> {
    // Get all projects accessible to the user
    const userProjects = await this.getProjectsForUser(userId);
    
    const result = await Promise.all(userProjects.map(async (project) => {
      const owner = await this.getUserById(String(project.ownerId));
      const stats = await this.getProjectStatistics(String(project.id));
      
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        ownerId: project.ownerId,
        ownerUsername: owner?.username || 'Unknown',
        isActive: project.isActive,
        createdAt: project.createdAt,
        stats: {
          sourceConnections: stats.sourceConnections,
          destinationConnections: stats.destinationConnections,
          skills: stats.skills,
          resourceGroups: stats.resourceGroups,
          resources: stats.resources,
          teams: stats.teams,
          csqs: stats.csqs,
          applications: stats.applications,
          triggers: stats.triggers,
          successfulMigrations: stats.successfulMigrations,
          failedMigrations: stats.failedMigrations,
        },
      };
    }));
    
    return result;
  }

  // User-scoped delete methods for multi-tenant data isolation
  async deleteUserConfigurations(userId: string): Promise<boolean> {
    const result = await db.delete(configurations).where(eq(configurations.userId, userId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteUserSkills(userId: string): Promise<boolean> {
    const result = await db.delete(skills).where(eq(skills.userId, userId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteUserResourceGroups(userId: string): Promise<boolean> {
    const result = await db.delete(resourceGroups).where(eq(resourceGroups.userId, userId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteUserCSQs(userId: string): Promise<boolean> {
    // First get all CSQs for this user to delete related records
    const userCSQs = await db.select().from(csqs).where(eq(csqs.userId, userId));
    
    // Delete related csqSkills and csqResourceGroups first
    for (const csq of userCSQs) {
      await db.delete(csqSkills).where(eq(csqSkills.csqId, csq.id));
      await db.delete(csqResourceGroups).where(eq(csqResourceGroups.csqId, csq.id));
    }
    
    const result = await db.delete(csqs).where(eq(csqs.userId, userId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteUserResources(userId: string): Promise<boolean> {
    // First get all resources for this user to delete related records
    const userResources = await db.select().from(resources).where(eq(resources.ownerId, userId));
    
    // Delete related resourceSkills first
    for (const resource of userResources) {
      await db.delete(resourceSkills).where(eq(resourceSkills.resourceId, resource.id));
    }
    
    const result = await db.delete(resources).where(eq(resources.ownerId, userId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteUserTeams(userId: string): Promise<boolean> {
    // First get all teams for this user to delete related records
    const userTeams = await db.select().from(teams).where(eq(teams.userId, userId));
    
    // Delete related teamResources first
    for (const team of userTeams) {
      await db.delete(teamResources).where(eq(teamResources.teamId, team.id));
    }
    
    const result = await db.delete(teams).where(eq(teams.userId, userId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteUserApplications(userId: string): Promise<boolean> {
    const result = await db.delete(applications).where(eq(applications.userId, userId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteUserTriggers(userId: string): Promise<boolean> {
    const result = await db.delete(triggers).where(eq(triggers.userId, userId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteUserMigrationJobs(userId: string): Promise<boolean> {
    const result = await db.delete(migrationJobs).where(eq(migrationJobs.userId, userId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  // Project-scoped delete methods
  async deleteProjectConfigurations(projectId: string): Promise<boolean> {
    const result = await db.delete(configurations).where(eq(configurations.projectId, projectId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteProjectSkills(projectId: string): Promise<boolean> {
    const result = await db.delete(skills).where(eq(skills.projectId, projectId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteProjectResourceGroups(projectId: string): Promise<boolean> {
    const result = await db.delete(resourceGroups).where(eq(resourceGroups.projectId, projectId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteProjectCSQs(projectId: string): Promise<boolean> {
    const projectCSQs = await db.select().from(csqs).where(eq(csqs.projectId, projectId));
    
    for (const csq of projectCSQs) {
      await db.delete(csqSkills).where(eq(csqSkills.csqId, csq.id));
      await db.delete(csqResourceGroups).where(eq(csqResourceGroups.csqId, csq.id));
    }
    
    const result = await db.delete(csqs).where(eq(csqs.projectId, projectId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteProjectResources(projectId: string): Promise<boolean> {
    const projectResources = await db.select().from(resources).where(eq(resources.projectId, projectId));
    
    for (const resource of projectResources) {
      await db.delete(resourceSkills).where(eq(resourceSkills.resourceId, resource.id));
    }
    
    const result = await db.delete(resources).where(eq(resources.projectId, projectId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteProjectTeams(projectId: string): Promise<boolean> {
    const projectTeams = await db.select().from(teams).where(eq(teams.projectId, projectId));
    
    for (const team of projectTeams) {
      await db.delete(teamResources).where(eq(teamResources.teamId, team.id));
    }
    
    const result = await db.delete(teams).where(eq(teams.projectId, projectId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteProjectApplications(projectId: string): Promise<boolean> {
    const result = await db.delete(applications).where(eq(applications.projectId, projectId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteProjectTriggers(projectId: string): Promise<boolean> {
    const result = await db.delete(triggers).where(eq(triggers.projectId, projectId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteProjectMigrationJobs(projectId: string): Promise<boolean> {
    const result = await db.delete(migrationJobs).where(eq(migrationJobs.projectId, projectId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async getProjects(filters?: {
    ownerId?: string;
    userId?: string;
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Project[]> {
    let query = db.select().from(projects);
    const conditions = [];

    if (filters?.ownerId) {
      conditions.push(eq(projects.ownerId, filters.ownerId));
    }

    if (filters?.search) {
      conditions.push(like(projects.name, `%${filters.search}%`));
    }

    if (filters?.isActive !== undefined) {
      conditions.push(eq(projects.isActive, filters.isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    query = query.orderBy(desc(projects.createdAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }

  async getProjectsForUser(userId: string): Promise<Project[]> {
    const ownedProjects = await db.select().from(projects).where(eq(projects.ownerId, userId));
    
    const memberProjects = await db
      .select({ project: projects })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projectMembers.userId, userId));
    
    const allProjects = [...ownedProjects, ...memberProjects.map(m => m.project)];
    const uniqueProjects = Array.from(new Map(allProjects.map(p => [p.id, p])).values());
    return uniqueProjects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: string, project: Partial<Project>): Promise<Project> {
    const [updated] = await db
      .update(projects)
      .set({ ...project, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getProjectBlockingCounts(projectId: string): Promise<Record<string, number>> {
    const count = (rows: { count: number }[]) => Number(rows[0]?.count ?? 0);
    const [conns, sk, rg, csq, res, tm, app, trig] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(uccxConnections).where(eq(uccxConnections.projectId, projectId)),
      db.select({ count: sql<number>`count(*)::int` }).from(skills).where(eq(skills.projectId, projectId)),
      db.select({ count: sql<number>`count(*)::int` }).from(resourceGroups).where(eq(resourceGroups.projectId, projectId)),
      db.select({ count: sql<number>`count(*)::int` }).from(csqs).where(eq(csqs.projectId, projectId)),
      db.select({ count: sql<number>`count(*)::int` }).from(resources).where(eq(resources.projectId, projectId)),
      db.select({ count: sql<number>`count(*)::int` }).from(teams).where(eq(teams.projectId, projectId)),
      db.select({ count: sql<number>`count(*)::int` }).from(applications).where(eq(applications.projectId, projectId)),
      db.select({ count: sql<number>`count(*)::int` }).from(triggers).where(eq(triggers.projectId, projectId)),
    ]);
    return {
      'server connections': count(conns),
      'skills': count(sk),
      'resource groups': count(rg),
      'CSQs': count(csq),
      'resources': count(res),
      'teams': count(tm),
      'applications': count(app),
      'triggers': count(trig),
    };
  }

  // Project Members
  async getProjectMember(id: string): Promise<ProjectMember | undefined> {
    const [member] = await db.select().from(projectMembers).where(eq(projectMembers.id, id));
    return member || undefined;
  }

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    return await db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));
  }

  async getProjectMemberByUserAndProject(userId: string, projectId: string): Promise<ProjectMember | undefined> {
    const [member] = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)));
    return member || undefined;
  }

  async createProjectMember(member: InsertProjectMember): Promise<ProjectMember> {
    const [created] = await db.insert(projectMembers).values(member).returning();
    return created;
  }

  async updateProjectMember(id: string, member: Partial<ProjectMember>): Promise<ProjectMember> {
    const [updated] = await db
      .update(projectMembers)
      .set({ ...member, updatedAt: new Date() })
      .where(eq(projectMembers.id, id))
      .returning();
    return updated;
  }

  async deleteProjectMember(id: string): Promise<boolean> {
    const result = await db.delete(projectMembers).where(eq(projectMembers.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteProjectMembers(projectId: string): Promise<boolean> {
    const result = await db.delete(projectMembers).where(eq(projectMembers.projectId, projectId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async deleteProjectAuditLogs(projectId: string): Promise<boolean> {
    const result = await db.delete(auditLogs).where(eq(auditLogs.projectId, projectId));
    return result.rowCount !== null && result.rowCount >= 0;
  }

  async getUserProjectPermissions(userId: string, projectId: string): Promise<ProjectMember | undefined> {
    const project = await this.getProject(projectId);
    if (project && project.ownerId === userId) {
      return {
        id: 'owner',
        projectId,
        userId,
        canView: true,
        canManageConnections: true,
        canImport: true,
        canUpdate: true,
        canMigrate: true,
        isAdmin: true,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      };
    }
    return this.getProjectMemberByUserAndProject(userId, projectId);
  }

  // ── Project Snapshots ──────────────────────────────────────────────────────

  async createProjectSnapshot(projectId: string, name: string, trigger: string, createdBy: string | null): Promise<ProjectSnapshot> {
    // Gather all current project configuration data
    const [
      projectSkills,
      projectResourceGroups,
      projectCSQs,
      projectResources,
      projectTeams,
      projectApplications,
      projectTriggers,
    ] = await Promise.all([
      db.select().from(skills).where(eq(skills.projectId, projectId)),
      db.select().from(resourceGroups).where(eq(resourceGroups.projectId, projectId)),
      db.select().from(csqs).where(eq(csqs.projectId, projectId)),
      db.select().from(resources).where(eq(resources.projectId, projectId)),
      db.select().from(teams).where(eq(teams.projectId, projectId)),
      db.select().from(applications).where(eq(applications.projectId, projectId)),
      db.select().from(triggers).where(eq(triggers.projectId, projectId)),
    ]);

    // Gather junction tables
    const csqSkillRows = await Promise.all(
      projectCSQs.map(c => db.select().from(csqSkills).where(eq(csqSkills.csqId, c.id)))
    );
    const csqResourceGroupRows = await Promise.all(
      projectCSQs.map(c => db.select().from(csqResourceGroups).where(eq(csqResourceGroups.csqId, c.id)))
    );
    const resourceSkillRows = await Promise.all(
      projectResources.map(r => db.select().from(resourceSkills).where(eq(resourceSkills.resourceId, r.id)))
    );
    const teamResourceRows = await Promise.all(
      projectTeams.map(t => db.select().from(teamResources).where(eq(teamResources.teamId, t.id)))
    );

    const snapshotData = {
      skills: projectSkills,
      resourceGroups: projectResourceGroups,
      csqs: projectCSQs,
      csqSkills: csqSkillRows.flat(),
      csqResourceGroups: csqResourceGroupRows.flat(),
      resources: projectResources,
      resourceSkills: resourceSkillRows.flat(),
      teams: projectTeams,
      teamResources: teamResourceRows.flat(),
      applications: projectApplications,
      triggers: projectTriggers,
    };

    const counts = {
      skills: projectSkills.length,
      resourceGroups: projectResourceGroups.length,
      csqs: projectCSQs.length,
      resources: projectResources.length,
      teams: projectTeams.length,
      applications: projectApplications.length,
      triggers: projectTriggers.length,
    };

    const [snapshot] = await db.insert(projectSnapshots).values({
      projectId,
      name,
      trigger,
      snapshotData,
      counts,
      createdBy,
    }).returning();
    return snapshot;
  }

  async listProjectSnapshots(projectId: string): Promise<ProjectSnapshot[]> {
    return await db.select().from(projectSnapshots)
      .where(eq(projectSnapshots.projectId, projectId))
      .orderBy(desc(projectSnapshots.createdAt));
  }

  async getProjectSnapshot(id: string, projectId: string): Promise<ProjectSnapshot | undefined> {
    const [snapshot] = await db.select().from(projectSnapshots)
      .where(and(eq(projectSnapshots.id, id), eq(projectSnapshots.projectId, projectId)));
    return snapshot || undefined;
  }

  async deleteProjectSnapshot(id: string, projectId: string): Promise<boolean> {
    const result = await db.delete(projectSnapshots)
      .where(and(eq(projectSnapshots.id, id), eq(projectSnapshots.projectId, projectId)));
    return (result.rowCount ?? 0) > 0;
  }

  async restoreProjectSnapshot(id: string, projectId: string): Promise<void> {
    const snapshot = await this.getProjectSnapshot(id, projectId);
    if (!snapshot) throw new Error('Snapshot not found');

    const raw = snapshot.snapshotData as any;

    // Timestamp fields stored as ISO strings in JSON must be converted back to Date objects
    // so Drizzle's PgTimestamp driver can call .toISOString() on them.
    const TIMESTAMP_KEYS = new Set([
      'importedAt', 'updatedAt', 'createdAt', 'processedAt',
      'startedAt', 'completedAt', 'lastLoginAt',
    ]);
    const parseDates = (rows: any[]): any[] =>
      rows.map((row) => {
        const out: any = { ...row };
        for (const key of Object.keys(out)) {
          if (TIMESTAMP_KEYS.has(key) && typeof out[key] === 'string') {
            const d = new Date(out[key]);
            out[key] = isNaN(d.getTime()) ? null : d;
          }
        }
        return out;
      });

    const data: Record<string, any[]> = {
      skills:            parseDates(raw.skills            ?? []),
      resourceGroups:    parseDates(raw.resourceGroups    ?? []),
      csqs:              parseDates(raw.csqs              ?? []),
      csqSkills:         raw.csqSkills                    ?? [],
      csqResourceGroups: raw.csqResourceGroups            ?? [],
      resources:         parseDates(raw.resources         ?? []),
      resourceSkills:    raw.resourceSkills               ?? [],
      teams:             parseDates(raw.teams             ?? []),
      teamResources:     raw.teamResources                ?? [],
      applications:      parseDates(raw.applications      ?? []),
      triggers:          parseDates(raw.triggers          ?? []),
    };

    // Delete all existing project configuration data (cascade handles junction tables)
    const projectCSQs = await db.select().from(csqs).where(eq(csqs.projectId, projectId));
    for (const c of projectCSQs) {
      await db.delete(csqSkills).where(eq(csqSkills.csqId, c.id));
      await db.delete(csqResourceGroups).where(eq(csqResourceGroups.csqId, c.id));
    }
    const projectResources = await db.select().from(resources).where(eq(resources.projectId, projectId));
    for (const r of projectResources) {
      await db.delete(resourceSkills).where(eq(resourceSkills.resourceId, r.id));
    }
    const projectTeams = await db.select().from(teams).where(eq(teams.projectId, projectId));
    for (const t of projectTeams) {
      await db.delete(teamResources).where(eq(teamResources.teamId, t.id));
    }
    await db.delete(skills).where(eq(skills.projectId, projectId));
    await db.delete(resourceGroups).where(eq(resourceGroups.projectId, projectId));
    await db.delete(csqs).where(eq(csqs.projectId, projectId));
    await db.delete(resources).where(eq(resources.projectId, projectId));
    await db.delete(teams).where(eq(teams.projectId, projectId));
    await db.delete(applications).where(eq(applications.projectId, projectId));
    await db.delete(triggers).where(eq(triggers.projectId, projectId));

    // Restore from snapshot — preserve original IDs
    if (data.skills.length)            await db.insert(skills).values(data.skills).onConflictDoNothing();
    if (data.resourceGroups.length)    await db.insert(resourceGroups).values(data.resourceGroups).onConflictDoNothing();
    if (data.csqs.length)              await db.insert(csqs).values(data.csqs).onConflictDoNothing();
    if (data.csqSkills.length)         await db.insert(csqSkills).values(data.csqSkills).onConflictDoNothing();
    if (data.csqResourceGroups.length) await db.insert(csqResourceGroups).values(data.csqResourceGroups).onConflictDoNothing();
    if (data.resources.length)         await db.insert(resources).values(data.resources).onConflictDoNothing();
    if (data.resourceSkills.length)    await db.insert(resourceSkills).values(data.resourceSkills).onConflictDoNothing();
    if (data.teams.length)             await db.insert(teams).values(data.teams).onConflictDoNothing();
    if (data.teamResources.length)     await db.insert(teamResources).values(data.teamResources).onConflictDoNothing();
    if (data.applications.length)      await db.insert(applications).values(data.applications).onConflictDoNothing();
    if (data.triggers.length)          await db.insert(triggers).values(data.triggers).onConflictDoNothing();
  }
}

export const storage = new DatabaseStorage();

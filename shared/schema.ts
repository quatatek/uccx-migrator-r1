import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, json, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);

export const projectPermissionEnum = pgEnum("project_permission", [
  "view",
  "manage_connections",
  "import",
  "update",
  "migrate",
  "admin"
]);

export const logLevelEnum = pgEnum("log_level", [
  "error",
  "warning",
  "info",
  "debug",
]);

export const logCategoryEnum = pgEnum("log_category", [
  "import",
  "migration",
  "api",
  "system",
  "project",
]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: userRoleEnum("role").notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Projects table
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  isActive: boolean("is_active").notNull().default(true),
  logLevel: logLevelEnum("log_level").notNull().default("info"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Project members table - links users to projects with permissions
export const projectMembers = pgTable("project_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  canView: boolean("can_view").notNull().default(true),
  canManageConnections: boolean("can_manage_connections").notNull().default(false),
  canImport: boolean("can_import").notNull().default(false),
  canUpdate: boolean("can_update").notNull().default(false),
  canMigrate: boolean("can_migrate").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const configurationTypeEnum = pgEnum("configuration_type", [
  "full_system",
  "agents",
  "csqs", 
  "applications",
  "devices",
  "skills",
  "resource_groups",
  "resources",
  "teams",
]);

export const configurationStatusEnum = pgEnum("configuration_status", [
  "pending",
  "processing",
  "ready",
  "migrated",
  "failed",
]);

export const migrationStatusEnum = pgEnum("migration_status", [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

export const configurations = pgTable("configurations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  type: configurationTypeEnum("type").notNull(),
  status: configurationStatusEnum("status").notNull().default("pending"),
  xmlData: json("xml_data").notNull(),
  parsedData: json("parsed_data"),
  filePath: text("file_path"),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const uccxConnections = pgTable("uccx_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(443),
  username: text("username").notNull(),
  password: text("password").notNull(),
  useHttps: boolean("use_https").notNull().default(true),
  isSource: boolean("is_source").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const migrationJobs = pgTable("migration_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configurationId: varchar("configuration_id").references(() => configurations.id),
  sourceConnectionId: varchar("source_connection_id").references(() => uccxConnections.id),
  targetConnectionId: varchar("target_connection_id").notNull().references(() => uccxConnections.id),
  status: migrationStatusEnum("status").notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  settings: json("settings"),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  level: logLevelEnum("level").notNull(),
  category: logCategoryEnum("category").notNull(),
  message: text("message").notNull(),
  source: text("source").notNull(),
  metadata: json("metadata"),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const skills = pgTable("skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  skillId: varchar("skill_id", { length: 50 }).notNull(),
  skillName: text("skill_name").notNull(),
  description: text("description"),
  sourceConnectionId: varchar("source_connection_id").references(() => uccxConnections.id),
  targetSkillId: varchar("target_skill_id", { length: 50 }),
  targetConnectionId: varchar("target_connection_id").references(() => uccxConnections.id),
  isActive: boolean("is_active").notNull().default(true),
  metadata: json("metadata"),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const resourceGroups = pgTable("resource_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resourceGroupId: integer("resource_group_id").notNull(),
  name: text("name").notNull(),
  self: text("self"),
  sourceConnectionId: varchar("source_connection_id").references(() => uccxConnections.id),
  targetResourceGroupId: varchar("target_resource_group_id", { length: 50 }),
  targetConnectionId: varchar("target_connection_id").references(() => uccxConnections.id),
  isActive: boolean("is_active").notNull().default(true),
  metadata: json("metadata"),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const csqs = pgTable("csqs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  csqId: text("csq_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  queueType: varchar("queue_type", { length: 50 }),
  routingType: varchar("routing_type", { length: 50 }),
  accountUserId: varchar("account_user_id", { length: 100 }),
  queueAlgorithm: varchar("queue_algorithm", { length: 50 }),
  resourcePoolType: varchar("resource_pool_type", { length: 50 }),
  autoWork: boolean("auto_work"),
  wrapupTime: integer("wrapup_time"),
  serviceLevel: integer("service_level"),
  serviceLevelPercentage: integer("service_level_percentage"),
  emailAuthType: varchar("email_auth_type", { length: 50 }),
  accountPassword: text("account_password"),
  channelProviderName: varchar("channel_provider_name", { length: 100 }),
  channelProviderRefURL: text("channel_provider_ref_url"),
  pollingInterval: integer("polling_interval"),
  folderName: varchar("folder_name", { length: 100 }),
  snapshotAge: integer("snapshot_age"),
  settings: json("settings"),
  sourceConnectionId: varchar("source_connection_id").references(() => uccxConnections.id),
  targetCSQId: varchar("target_csq_id", { length: 50 }),
  targetConnectionId: varchar("target_connection_id").references(() => uccxConnections.id),
  isActive: boolean("is_active").notNull().default(true),
  metadata: json("metadata"),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// CSQ-Skill mapping table to track skill relationships with competency levels
export const csqSkills = pgTable("csq_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  csqId: varchar("csq_id").notNull().references(() => csqs.id, { onDelete: "cascade" }),
  skillId: varchar("skill_id", { length: 50 }).notNull(), // Original skill ID from UCCX
  competencyLevel: integer("competency_level").notNull(), // 1-10 scale
  weight: integer("weight").default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// CSQ-Resource Group mapping table for RESOURCE_GROUP type CSQs
export const csqResourceGroups = pgTable("csq_resource_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  csqId: varchar("csq_id").notNull().references(() => csqs.id, { onDelete: "cascade" }),
  resourceGroupId: varchar("resource_group_id", { length: 50 }).notNull(), // Original resource group ID from UCCX
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Resources table
export const resources = pgTable("resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userID: text("user_id").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  extension: text("extension"),
  alias: text("alias"),
  autoAvailable: boolean("auto_available").default(true),
  type: integer("type").default(1),
  teamId: text("team_id"),
  resourceGroupId: text("resource_group_id"),
  sourceConnectionId: varchar("source_connection_id").references(() => uccxConnections.id),
  targetUserID: text("target_user_id"),
  targetConnectionId: varchar("target_connection_id").references(() => uccxConnections.id),
  isActive: boolean("is_active").notNull().default(true),
  metadata: json("metadata"),
  projectId: varchar("project_id").references(() => projects.id),
  ownerId: varchar("owner_id").references(() => users.id),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Resource-Skill mapping table to track skill competencies for resources
export const resourceSkills = pgTable("resource_skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resourceId: varchar("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
  skillId: varchar("skill_id", { length: 50 }).notNull(), // Original skill ID from UCCX
  competencyLevel: integer("competency_level").notNull(), // 1-10 scale
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Teams table
export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: text("team_id").notNull(),
  teamname: text("teamname").notNull(),
  primarySupervisorUserID: text("primary_supervisor_user_id"),
  sourceConnectionId: varchar("source_connection_id").references(() => uccxConnections.id),
  targetTeamId: text("target_team_id"),
  targetConnectionId: varchar("target_connection_id").references(() => uccxConnections.id),
  isActive: boolean("is_active").notNull().default(true),
  metadata: json("metadata"),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Team-Resource mapping table to track team members
export const teamResources = pgTable("team_resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  resourceUserID: text("resource_user_id").notNull(), // Original userID from UCCX
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Applications table
export const applications = pgTable("applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationName: text("application_name").notNull(),
  script: text("script"),
  defaultScript: text("default_script"),
  applicationId: text("application_id"),
  type: text("type"),
  description: text("description"),
  maxsession: integer("maxsession"),
  enabled: boolean("enabled").default(true),
  sourceConnectionId: varchar("source_connection_id").references(() => uccxConnections.id),
  targetApplicationName: text("target_application_name"),
  targetConnectionId: varchar("target_connection_id").references(() => uccxConnections.id),
  isActive: boolean("is_active").notNull().default(true),
  metadata: json("metadata"),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Triggers table
export const triggers = pgTable("triggers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  directoryNumber: text("directory_number").notNull(),
  locale: text("locale"),
  applicationName: text("application_name"),
  deviceName: text("device_name"),
  description: text("description"),
  callControlGroupName: text("call_control_group_name"),
  callControlGroupId: text("call_control_group_id"),
  triggerEnabled: boolean("trigger_enabled").default(true),
  maxNumOfSessions: integer("max_num_of_sessions"),
  idleTimeout: integer("idle_timeout"),
  alertingNameAscii: text("alerting_name_ascii"),
  devicePool: text("device_pool"),
  location: text("location"),
  busyTrigger: text("busy_trigger"),
  partition: text("partition"),
  voiceMailProfile: text("voice_mail_profile"),
  callingSearchSpace: text("calling_search_space"),
  callingSearchSpaceForRedirect: text("calling_search_space_for_redirect"),
  aarGroup: text("aar_group"),
  presenceGroup: text("presence_group"),
  display: text("display"),
  externalPhoneMaskNumber: text("external_phone_mask_number"),
  sourceConnectionId: varchar("source_connection_id").references(() => uccxConnections.id),
  targetDirectoryNumber: text("target_directory_number"),
  targetConnectionId: varchar("target_connection_id").references(() => uccxConnections.id),
  isActive: boolean("is_active").notNull().default(true),
  metadata: json("metadata"),
  projectId: varchar("project_id").references(() => projects.id),
  userId: varchar("user_id").references(() => users.id),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Project snapshots — full capture of a project's configuration data before import
export const projectSnapshots = pgTable("project_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  trigger: text("trigger").notNull().default("manual"), // "manual" | "pre-import"
  snapshotData: json("snapshot_data").notNull(),
  counts: json("counts"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: varchar("created_by").references(() => users.id),
});

export const insertProjectSnapshotSchema = createInsertSchema(projectSnapshots).omit({
  id: true,
  createdAt: true,
});

export type ProjectSnapshot = typeof projectSnapshots.$inferSelect;
export type InsertProjectSnapshot = z.infer<typeof insertProjectSnapshotSchema>;

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
});

export const createUserSchema = insertUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.confirmPassword) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const insertConfigurationSchema = createInsertSchema(configurations).omit({
  id: true,
  importedAt: true,
  updatedAt: true,
});

export const insertResourceGroupSchema = createInsertSchema(resourceGroups).omit({
  id: true,
  importedAt: true,
  updatedAt: true,
});

export const insertCSQSchema = createInsertSchema(csqs).omit({
  id: true,
  importedAt: true,
  updatedAt: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type SafeUser = Omit<User, 'password'>;
export type Configuration = typeof configurations.$inferSelect;
export type InsertConfiguration = z.infer<typeof insertConfigurationSchema>;
export type UccxConnection = typeof uccxConnections.$inferSelect;
export type InsertUccxConnection = z.infer<typeof insertUccxConnectionSchema>;
export type MigrationJob = typeof migrationJobs.$inferSelect;
export type InsertMigrationJob = z.infer<typeof insertMigrationJobSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type Skill = typeof skills.$inferSelect;
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type ResourceGroup = typeof resourceGroups.$inferSelect;
export type InsertResourceGroup = z.infer<typeof insertResourceGroupSchema>;
export type CSQ = typeof csqs.$inferSelect;
export type InsertCSQ = z.infer<typeof insertCSQSchema>;

export type CSQSkill = typeof csqSkills.$inferSelect;
export type InsertCSQSkill = typeof csqSkills.$inferInsert;
export const insertCSQSkillSchema = createInsertSchema(csqSkills).omit({
  id: true,
  createdAt: true,
});
export type InsertCSQSkillSchema = z.infer<typeof insertCSQSkillSchema>;

export type CSQResourceGroup = typeof csqResourceGroups.$inferSelect;
export type InsertCSQResourceGroup = typeof csqResourceGroups.$inferInsert;
export const insertCSQResourceGroupSchema = createInsertSchema(csqResourceGroups).omit({
  id: true,
  createdAt: true,
});

export const insertUccxConnectionSchema = createInsertSchema(uccxConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMigrationJobSchema = createInsertSchema(migrationJobs).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export const insertSkillSchema = createInsertSchema(skills).omit({
  id: true,
  importedAt: true,
  updatedAt: true,
});

export const insertResourceSchema = createInsertSchema(resources).omit({
  id: true,
  importedAt: true,
  updatedAt: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  importedAt: true,
  updatedAt: true,
});

export const insertResourceSkillSchema = createInsertSchema(resourceSkills).omit({
  id: true,
  createdAt: true,
});

export const insertTeamResourceSchema = createInsertSchema(teamResources).omit({
  id: true,
  createdAt: true,
});

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  importedAt: true,
  updatedAt: true,
});

export const insertTriggerSchema = createInsertSchema(triggers).omit({
  id: true,
  importedAt: true,
  updatedAt: true,
});

export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type Team = typeof teams.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type ResourceSkill = typeof resourceSkills.$inferSelect;
export type InsertResourceSkill = z.infer<typeof insertResourceSkillSchema>;
export type TeamResource = typeof teamResources.$inferSelect;
export type InsertTeamResource = z.infer<typeof insertTeamResourceSchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Trigger = typeof triggers.$inferSelect;
export type InsertTrigger = z.infer<typeof insertTriggerSchema>;

// Project schemas and types
export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectMemberSchema = createInsertSchema(projectMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;

// Project member with user info for display
export type ProjectMemberWithUser = ProjectMember & {
  user: SafeUser;
};

// Project with members for display
export type ProjectWithMembers = Project & {
  members: ProjectMemberWithUser[];
  owner: SafeUser;
};

// System settings (branding, etc.)
export const systemSettings = pgTable("system_settings", {
  key: varchar("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;

export interface BrandingSettings {
  appName: string;
  appSubtitle: string;
  logoDataUrl: string | null;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  appName: "UCCX Migration Tool",
  appSubtitle: "Enterprise Configuration Management",
  logoDataUrl: null,
};

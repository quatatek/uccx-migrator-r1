import { EventEmitter } from 'events';
import type { MigrationJob, InsertMigrationJob } from '@shared/schema';
import { storage } from '../storage';
import { UccxApiService, type UccxApiConfig } from './uccxApi';
import { type UccxConfig } from './xmlParser';

export interface MigrationJobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

const CONNECTION_TIMEOUT_MS = 20000; // 20 seconds

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

export class MigrationQueueService extends EventEmitter {
  private activeJobs = new Map<string, MigrationJobStatus>();
  private processingQueue: string[] = [];
  private isProcessing = false;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    // Recover any jobs left in 'running' state from a previous server crash/restart
    try {
      const stuckJobs = await storage.getMigrationJobs({ status: 'running' });
      for (const job of stuckJobs) {
        await storage.updateMigrationJob(job.id, {
          status: 'failed',
          errorMessage: 'Server restarted while job was running',
          completedAt: new Date(),
        });
        await storage.createAuditLog({
          level: 'warning',
          category: 'migration',
          message: `Migration job recovered after restart: ${job.id}`,
          source: 'MigrationQueue',
          metadata: { jobId: job.id },
          projectId: job.projectId ?? undefined,
        });
      }
      if (stuckJobs.length > 0) {
        console.log(`MigrationQueue: recovered ${stuckJobs.length} stuck job(s) from previous run`);
      }
    } catch (err) {
      console.error('MigrationQueue: failed to recover stuck jobs on startup', err);
    }
  }

  async createMigrationJob(jobData: InsertMigrationJob): Promise<MigrationJob> {
    const job = await storage.createMigrationJob(jobData);
    
    // Add to queue
    this.processingQueue.push(job.id);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    await storage.createAuditLog({
      level: 'info',
      category: 'migration',
      message: `Migration job created: ${job.id}`,
      source: 'MigrationQueue',
      metadata: { jobId: job.id, configurationId: job.configurationId },
      projectId: job.projectId ?? undefined,
    });

    return job;
  }

  async cancelMigrationJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    
    if (!job) {
      return false;
    }

    if (job.status === 'running') {
      job.status = 'cancelled';
      this.activeJobs.set(jobId, job);
      
      await storage.updateMigrationJob(jobId, {
        status: 'cancelled',
        progress: job.progress,
      });

      const cancelledJob = await storage.getMigrationJob(jobId);
      await storage.createAuditLog({
        level: 'info',
        category: 'migration',
        message: `Migration job cancelled: ${jobId}`,
        source: 'MigrationQueue',
        metadata: { jobId },
        projectId: cancelledJob?.projectId ?? undefined,
      });

      this.emit('jobCancelled', job);
      return true;
    }

    return false;
  }

  getJobStatus(jobId: string): MigrationJobStatus | undefined {
    return this.activeJobs.get(jobId);
  }

  getAllActiveJobs(): MigrationJobStatus[] {
    const GRACE_PERIOD_MS = 60 * 1000; // keep finished jobs visible for 60 seconds
    const now = Date.now();
    return Array.from(this.activeJobs.values()).filter((job) => {
      if (job.status === 'pending' || job.status === 'running') return true;
      // Show completed/failed/cancelled jobs briefly so the user can see the result
      if (job.completedAt && (now - job.completedAt.getTime()) <= GRACE_PERIOD_MS) return true;
      return false;
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const jobId = this.processingQueue.shift();
      if (!jobId) continue;

      try {
        await this.processJob(jobId);
      } catch (error) {
        console.error(`Error processing job ${jobId}:`, error);
        
        await storage.updateMigrationJob(jobId, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        });

        const failedJob = await storage.getMigrationJob(jobId);
        await storage.createAuditLog({
          level: 'error',
          category: 'migration',
          message: `Migration job failed: ${jobId} - ${error instanceof Error ? error.message : 'Unknown error'}`,
          source: 'MigrationQueue',
          metadata: { jobId, error: error instanceof Error ? error.message : 'Unknown error' },
          projectId: failedJob?.projectId ?? undefined,
        });
      }
    }

    this.isProcessing = false;
  }

  private async processJob(jobId: string): Promise<void> {
    const job = await storage.getMigrationJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Initialize job status
    const jobStatus: MigrationJobStatus = {
      id: jobId,
      status: 'running',
      progress: 0,
      startedAt: new Date(),
    };

    this.activeJobs.set(jobId, jobStatus);

    // Update job in database
    await storage.updateMigrationJob(jobId, {
      status: 'running',
      progress: 0,
      startedAt: new Date(),
    });

    this.emit('jobStarted', jobStatus);

    try {
      // Get configuration data
      let configData: any;
      const settings = job.settings as any || {};
      
      // Comprehensive debug logging for all migration types
      console.log('=== Migration Job Processing ===');
      console.log('Job ID:', job.id);
      console.log('Job configurationId:', job.configurationId);
      console.log('Job targetConnectionId:', job.targetConnectionId);
      console.log('Raw job.settings:', job.settings);
      console.log('Settings type:', typeof settings, JSON.stringify(settings, null, 2));
      console.log('Settings.type value:', settings.type);
      console.log('Settings.skills:', !!settings.skills, Array.isArray(settings.skills), settings.skills?.length);
      console.log('Settings.resourceGroups:', !!settings.resourceGroups, Array.isArray(settings.resourceGroups), settings.resourceGroups?.length);
      console.log('Settings.csqs:', !!settings.csqs, Array.isArray(settings.csqs), settings.csqs?.length);
      console.log('Settings.resources:', !!settings.resources, Array.isArray(settings.resources), settings.resources?.length);
      console.log('Settings.teams:', !!settings.teams, Array.isArray(settings.teams), settings.teams?.length);
      console.log('Settings.applications:', !!settings.applications, Array.isArray(settings.applications), settings.applications?.length);
      console.log('Settings.triggers:', !!settings.triggers, Array.isArray(settings.triggers), settings.triggers?.length);
      console.log('================================');
      
      if (settings.type === 'skills' && settings.skills) {
        // Handle skills provisioning directly from settings
        // Add target connection ID to each skill for mapping
        const skillsWithTargetConnection = settings.skills.map((skill: any) => ({
          ...skill,
          targetConnectionId: job.targetConnectionId,
        }));
        
        configData = {
          skills: skillsWithTargetConnection,
        };
      } else if (settings.type === 'resource_groups' && settings.resourceGroups) {
        // Handle resource groups provisioning directly from settings
        const resourceGroupsWithTargetConnection = settings.resourceGroups.map((resourceGroup: any) => ({
          ...resourceGroup,
          targetConnectionId: job.targetConnectionId,
        }));
        
        configData = {
          resourceGroups: resourceGroupsWithTargetConnection,
        };
      } else if (settings.type === 'csqs' && settings.csqs) {
        // Handle CSQ provisioning directly from settings
        const csqsWithTargetConnection = settings.csqs.map((csq: any) => ({
          ...csq,
          targetConnectionId: job.targetConnectionId,
        }));
        
        configData = {
          csqs: csqsWithTargetConnection,
        };
      } else if (settings.type === 'resources' && settings.resources) {
        // Handle resources provisioning directly from settings
        const resourcesWithTargetConnection = settings.resources.map((resource: any) => ({
          ...resource,
          targetConnectionId: job.targetConnectionId,
        }));
        
        configData = {
          resources: resourcesWithTargetConnection,
        };
      } else if (settings.type === 'teams' && settings.teams) {
        // Handle teams provisioning directly from settings
        const teamsWithTargetConnection = settings.teams.map((team: any) => ({
          ...team,
          targetConnectionId: job.targetConnectionId,
        }));
        
        configData = {
          teams: teamsWithTargetConnection,
        };
      } else if (settings.type === 'applications' && settings.applications) {
        // Handle applications provisioning directly from settings
        const applicationsWithTargetConnection = settings.applications.map((application: any) => ({
          ...application,
          targetConnectionId: job.targetConnectionId,
        }));
        
        configData = {
          applications: applicationsWithTargetConnection,
        };
      } else if (settings.type === 'triggers' && settings.triggers) {
        // Handle triggers provisioning directly from settings
        const triggersWithTargetConnection = settings.triggers.map((trigger: any) => ({
          ...trigger,
          targetConnectionId: job.targetConnectionId,
        }));
        
        configData = {
          triggers: triggersWithTargetConnection,
        };
      } else if (settings.type === 'configuration') {
        // "All items" — assemble every config type present in settings.
        // Dependency order: Skills → Resource Groups → CSQs → Resources → Teams → Applications → Triggers
        configData = {};
        if (settings.skills?.length)
          configData.skills = settings.skills.map((s: any) => ({ ...s, targetConnectionId: job.targetConnectionId }));
        if (settings.resourceGroups?.length)
          configData.resourceGroups = settings.resourceGroups.map((rg: any) => ({ ...rg, targetConnectionId: job.targetConnectionId }));
        if (settings.csqs?.length)
          configData.csqs = settings.csqs.map((csq: any) => ({ ...csq, targetConnectionId: job.targetConnectionId }));
        if (settings.resources?.length)
          configData.resources = settings.resources.map((r: any) => ({ ...r, targetConnectionId: job.targetConnectionId }));
        if (settings.teams?.length)
          configData.teams = settings.teams.map((t: any) => ({ ...t, targetConnectionId: job.targetConnectionId }));
        if (settings.applications?.length)
          configData.applications = settings.applications.map((a: any) => ({ ...a, targetConnectionId: job.targetConnectionId }));
        if (settings.triggers?.length)
          configData.triggers = settings.triggers.map((tr: any) => ({ ...tr, targetConnectionId: job.targetConnectionId }));
      } else {
        // Handle traditional configuration migration
        if (!job.configurationId) {
          throw new Error('Configuration ID is required for traditional migrations');
        }
        const configuration = await storage.getConfiguration(job.configurationId);
        if (!configuration || !configuration.parsedData) {
          throw new Error('Configuration not found or not parsed');
        }
        configData = configuration.parsedData;
      }

      // Get target connection
      const targetConnection = await storage.getUccxConnection(job.targetConnectionId);
      if (!targetConnection) {
        throw new Error('Target connection not found');
      }

      // Create UCCX API client
      const apiConfig: UccxApiConfig = {
        host: targetConnection.host,
        port: targetConnection.port,
        username: targetConnection.username,
        password: targetConnection.password,
        useHttps: true,
      };

      const uccxApi = new UccxApiService(apiConfig);

      // Test connection first
      jobStatus.progress = 10;
      jobStatus.message = 'Testing connection to target UCCX...';
      this.updateJobStatus(jobId, jobStatus);

      const connectionTest = await withTimeout(
        uccxApi.testConnection(),
        CONNECTION_TIMEOUT_MS,
        `Connection test timed out after ${CONNECTION_TIMEOUT_MS / 1000}s`
      );
      if (!connectionTest.success) {
        throw new Error(`Connection test failed: ${connectionTest.message}`);
      }

      // Parse migration settings
      const migrationOptions = {
        dryRun: settings.options?.dryRun || settings.dryRun || false,
        createBackup: settings.options?.createBackup || settings.createBackup || false,
        overrideExisting: settings.options?.overrideExisting || settings.overrideExisting || false,
      };

      // Start migration
      jobStatus.progress = 20;
      const migrationTypeMessages: Record<string, string> = {
        'skills': 'Starting skills migration...',
        'resource_groups': 'Starting resource groups migration...',
        'csqs': 'Starting CSQs migration...',
        'resources': 'Starting resources migration...',
        'teams': 'Starting teams migration...',
        'applications': 'Starting applications migration...',
        'triggers': 'Starting triggers migration...',
      };
      jobStatus.message = migrationTypeMessages[settings.type] || 'Starting configuration migration...';
      this.updateJobStatus(jobId, jobStatus);

      const migrationResult = await uccxApi.migrateConfiguration(
        configData as UccxConfig,
        migrationOptions
      );

      if (!migrationResult.success) {
        throw new Error(`Migration failed: ${migrationResult.message}`);
      }

      // Complete job
      jobStatus.status = 'completed';
      jobStatus.progress = 100;
      jobStatus.message = migrationResult.message;
      jobStatus.completedAt = new Date();
      
      this.activeJobs.set(jobId, jobStatus);

      await storage.updateMigrationJob(jobId, {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
      });

      await storage.createAuditLog({
        level: 'info',
        category: 'migration',
        message: `Migration job completed successfully: ${jobId}`,
        source: 'MigrationQueue',
        metadata: { 
          jobId, 
          configurationId: job.configurationId,
          results: migrationResult.details 
        },
        projectId: job.projectId ?? undefined,
      });

      this.emit('jobCompleted', jobStatus);

    } catch (error) {
      jobStatus.status = 'failed';
      jobStatus.error = error instanceof Error ? error.message : 'Unknown error';
      jobStatus.completedAt = new Date();
      
      this.activeJobs.set(jobId, jobStatus);

      await storage.updateMigrationJob(jobId, {
        status: 'failed',
        errorMessage: jobStatus.error,
        completedAt: new Date(),
      });

      this.emit('jobFailed', jobStatus);
      throw error;
    }
  }

  private async updateJobStatus(jobId: string, status: MigrationJobStatus): Promise<void> {
    this.activeJobs.set(jobId, status);
    
    await storage.updateMigrationJob(jobId, {
      progress: status.progress,
    });

    this.emit('jobProgress', status);
  }

  // Clean up completed/failed jobs from memory
  cleanupOldJobs(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [jobId, job] of Array.from(this.activeJobs.entries())) {
      if (job.completedAt && (now - job.completedAt.getTime()) > maxAge) {
        this.activeJobs.delete(jobId);
      }
    }
  }
}

export const migrationQueue = new MigrationQueueService();

// Clean up old jobs every hour
setInterval(() => {
  migrationQueue.cleanupOldJobs();
}, 60 * 60 * 1000);

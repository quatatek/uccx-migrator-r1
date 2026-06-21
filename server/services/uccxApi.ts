import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import https from 'https';
import { parseStringPromise } from 'xml2js';
import type { UccxConfig, Agent, CSQ, Application, Device } from './xmlParser';
import { storage } from '../storage';

export interface UccxApiConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  useHttps: boolean;
}

export interface MigrationResult {
  success: boolean;
  message: string;
  details?: {
    skills?: { created: number; updated: number; failed: number };
    resourceGroups?: { created: number; updated: number; failed: number };
    agents?: { created: number; updated: number; failed: number };
    csqs?: { created: number; updated: number; failed: number };
    resources?: { created: number; updated: number; failed: number };
    teams?: { created: number; updated: number; failed: number };
    applications?: { created: number; updated: number; failed: number };
    triggers?: { created: number; updated: number; failed: number };
    devices?: { created: number; updated: number; failed: number };
  };
  errors?: string[];
}

export class UccxApiService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(config: UccxApiConfig) {
    this.baseUrl = `${config.useHttps ? 'https' : 'http'}://${config.host}:${config.port}`;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      auth: {
        username: config.username,
        password: config.password,
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // For self-signed certificates
      }),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        const fullUrl = `${config.baseURL}${config.url}`;
        const headers = { ...config.headers };
        
        // Mask sensitive headers
        if (headers.Authorization) {
          headers.Authorization = '[MASKED]';
        }
        
        console.log('\n========== UCCX API REQUEST ==========');
        console.log(`Method: ${config.method?.toUpperCase()}`);
        console.log(`URL: ${fullUrl}`);
        console.log(`Headers:`, JSON.stringify(headers, null, 2));
        if (config.data) {
          console.log(`Body:`, typeof config.data === 'string' ? config.data : JSON.stringify(config.data, null, 2));
        }
        console.log('======================================\n');
        
        return config;
      },
      (error) => {
        console.error('UCCX API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log('\n========== UCCX API RESPONSE ==========');
        console.log(`Status: ${response.status} ${response.statusText}`);
        console.log(`URL: ${response.config.baseURL}${response.config.url}`);
        if (response.data) {
          console.log(`Response Body:`, typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2));
        }
        console.log('=======================================\n');
        
        return response;
      },
      (error) => {
        console.log('\n========== UCCX API ERROR ==========');
        console.log(`Status: ${error.response?.status}`);
        console.log(`URL: ${error.config?.baseURL}${error.config?.url}`);
        console.log(`Error Data:`, JSON.stringify(error.response?.data, null, 2));
        console.log('====================================\n');
        
        const status = error.response?.status;
        const serverMessage = error.response?.data?.message;
        if (status) {
          return Promise.reject(new Error(`UCCX API Error: ${status} - ${serverMessage || error.message}`));
        }
        // Network-level error (no response): use the original message directly
        return Promise.reject(new Error(error.message || 'Network error connecting to UCCX'));
      }
    );
  }

  // Helper to extract values from xml2js arrays
  private getValue(value: any): any {
    if (value === undefined || value === null) return null;
    if (Array.isArray(value)) {
      return value[0] || null;
    }
    return value;
  }

  // Normalize xml2js parsed object by extracting values from arrays
  private normalizeXmlObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this.normalizeXmlObject(item));
    }
    if (typeof obj === 'object') {
      const normalized: any = {};
      for (const key in obj) {
        if (key === '$') {
          // Merge attributes into parent object
          Object.assign(normalized, obj[key]);
        } else {
          const value = obj[key];
          if (Array.isArray(value) && value.length === 1 && typeof value[0] !== 'object') {
            // Single primitive value in array - extract it
            normalized[key] = value[0];
          } else if (Array.isArray(value) && value.length === 1 && typeof value[0] === 'object') {
            // Single object in array - recursively normalize it
            normalized[key] = this.normalizeXmlObject(value[0]);
          } else if (Array.isArray(value)) {
            // Multiple items - normalize each
            normalized[key] = value.map(item => this.normalizeXmlObject(item));
          } else if (typeof value === 'object') {
            // Nested object - recursively normalize
            normalized[key] = this.normalizeXmlObject(value);
          } else {
            normalized[key] = value;
          }
        }
      }
      return normalized;
    }
    return obj;
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.client.get('/adminapi/systemConfig');
      return {
        success: true,
        message: `Successfully connected to UCCX server. System: ${response.data?.systemName || 'Connected'}`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown connection error',
      };
    }
  }

  async fetchSkills(): Promise<any[]> {
    try {
      // Fetch all skills from UCCX API
      const response = await this.client.get('/adminapi/skill', {
        headers: {
          'Accept': 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      
      // Parse XML response
      const parsed = await parseStringPromise(response.data, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true,
      });
      
      // Extract skills array
      const skillsData = parsed?.skills?.skill;
      if (!skillsData) return [];
      
      // Ensure array format
      return Array.isArray(skillsData) ? skillsData : [skillsData];
    } catch (error) {
      console.error('Failed to fetch skills from UCCX API:', error);
      throw new Error(`Failed to fetch skills: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchSkillsXml(): Promise<string> {
    try {
      const response = await this.client.get('/adminapi/skill', {
        headers: {
          'Accept': 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch skills XML from UCCX API:', error);
      throw new Error(`Failed to fetch skills XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchResourceGroups(): Promise<any[]> {
    try {
      const response = await this.client.get('/adminapi/resourceGroup', {
        headers: {
          'Accept': 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      
      // Parse XML response
      const parsed = await parseStringPromise(response.data, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true,
      });
      
      // Extract resource groups array
      const rgData = parsed?.resourceGroups?.resourceGroup;
      if (!rgData) {
        return [];
      }
      
      const rgArray = Array.isArray(rgData) ? rgData : [rgData];
      
      // Normalize each resource group to extract values from arrays
      const normalized = rgArray.map(rg => this.normalizeXmlObject(rg));
      console.log(`Returning ${normalized.length} normalized resource groups`);
      if (normalized.length > 0) {
        console.log('First normalized RG keys:', Object.keys(normalized[0]));
        console.log('First normalized RG sample:', JSON.stringify(normalized[0], null, 2));
      }
      return normalized;
    } catch (error) {
      console.error('Failed to fetch resource groups from UCCX API:', error);
      throw new Error(`Failed to fetch resource groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchResourceGroupsXml(): Promise<string> {
    try {
      const response = await this.client.get('/adminapi/resourceGroup', {
        headers: {
          'Accept': 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch resource groups XML from UCCX API:', error);
      throw new Error(`Failed to fetch resource groups XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchCSQs(): Promise<any[]> {
    try {
      const response = await this.client.get('/adminapi/csq', {
        headers: {
          'Accept': 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      
      // Parse XML response
      const parsed = await parseStringPromise(response.data, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true,
      });
      
      // Extract CSQs array
      const csqData = parsed?.csqs?.csq;
      if (!csqData) {
        return [];
      }
      
      const csqArray = Array.isArray(csqData) ? csqData : [csqData];
      
      // Normalize each CSQ to extract values from arrays
      const normalized = csqArray.map(csq => this.normalizeXmlObject(csq));
      console.log(`Returning ${normalized.length} normalized CSQs`);
      if (normalized.length > 0) {
        console.log('First normalized CSQ keys:', Object.keys(normalized[0]));
        console.log('First normalized CSQ sample:', JSON.stringify(normalized[0], null, 2));
      }
      return normalized;
    } catch (error) {
      console.error('Failed to fetch CSQs from UCCX API:', error);
      throw new Error(`Failed to fetch CSQs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchCSQsXml(): Promise<string> {
    try {
      const response = await this.client.get('/adminapi/csq', {
        headers: {
          'Accept': 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch CSQs XML from UCCX API:', error);
      throw new Error(`Failed to fetch CSQs XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchResources(): Promise<any[]> {
    try {
      const response = await this.client.get('/adminapi/resource', {
        headers: {
          'Accept': 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      
      // Parse XML response
      const parsed = await parseStringPromise(response.data, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true,
      });
      
      // Extract resources array
      const resourceData = parsed?.resources?.resource;
      if (!resourceData) return [];
      
      return Array.isArray(resourceData) ? resourceData : [resourceData];
    } catch (error) {
      console.error('Failed to fetch resources from UCCX API:', error);
      throw new Error(`Failed to fetch resources: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchResourcesXml(): Promise<string> {
    try {
      const response = await this.client.get('/adminapi/resource', {
        headers: {
          'Accept': 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch resources XML from UCCX API:', error);
      throw new Error(`Failed to fetch resources XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchTeams(): Promise<any[]> {
    try {
      const response = await this.client.get('/adminapi/team', {
        headers: {
          'Accept': 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      
      // Parse XML response
      const parsed = await parseStringPromise(response.data, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true,
      });
      
      // Extract teams array
      const teamData = parsed?.teams?.team;
      if (!teamData) {
        return [];
      }
      
      const teamArray = Array.isArray(teamData) ? teamData : [teamData];
      
      // Normalize each team to extract values from arrays
      const normalized = teamArray.map(team => this.normalizeXmlObject(team));
      console.log(`Returning ${normalized.length} normalized teams`);
      return normalized;
    } catch (error) {
      console.error('Failed to fetch teams from UCCX API:', error);
      throw new Error(`Failed to fetch teams: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchTeamsXml(): Promise<string> {
    try {
      const response = await this.client.get('/adminapi/team', {
        headers: {
          'Accept': 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch teams XML from UCCX API:', error);
      throw new Error(`Failed to fetch teams XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchApplications(): Promise<any[]> {
    try {
      const response = await this.client.get('/adminapi/application', {
        headers: {
          'Accept': 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      
      // Parse XML response
      const parsed = await parseStringPromise(response.data, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true,
      });
      
      // Extract applications array
      const appData = parsed?.applications?.application;
      if (!appData) return [];
      
      return Array.isArray(appData) ? appData : [appData];
    } catch (error) {
      console.error('Failed to fetch applications from UCCX API:', error);
      throw new Error(`Failed to fetch applications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchApplicationsXml(): Promise<string> {
    try {
      const response = await this.client.get('/adminapi/application', {
        headers: {
          'Accept': 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch applications XML from UCCX API:', error);
      throw new Error(`Failed to fetch applications XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchTriggers(): Promise<any[]> {
    try {
      const response = await this.client.get('/adminapi/trigger', {
        headers: {
          'Accept': 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      
      // Parse XML response
      const parsed = await parseStringPromise(response.data, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true,
      });
      
      // Extract triggers array
      const triggerData = parsed?.triggers?.trigger;
      if (!triggerData) return [];
      
      return Array.isArray(triggerData) ? triggerData : [triggerData];
    } catch (error) {
      console.error('Failed to fetch triggers from UCCX API:', error);
      throw new Error(`Failed to fetch triggers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async fetchTriggersXml(): Promise<string> {
    try {
      const response = await this.client.get('/adminapi/trigger', {
        headers: {
          'Accept': 'application/xml',
          'Content-Type': 'application/xml',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch triggers XML from UCCX API:', error);
      throw new Error(`Failed to fetch triggers XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async migrateConfiguration(
    config: UccxConfig,
    options: {
      dryRun?: boolean;
      createBackup?: boolean;
      overrideExisting?: boolean;
    } = {}
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      message: 'Migration completed successfully',
      details: {
        skills: { created: 0, updated: 0, failed: 0 },
        resourceGroups: { created: 0, updated: 0, failed: 0 },
        agents: { created: 0, updated: 0, failed: 0 },
        csqs: { created: 0, updated: 0, failed: 0 },
        resources: { created: 0, updated: 0, failed: 0 },
        teams: { created: 0, updated: 0, failed: 0 },
        applications: { created: 0, updated: 0, failed: 0 },
        devices: { created: 0, updated: 0, failed: 0 },
      },
      errors: [],
    };

    if (options.dryRun) {
      console.log('Performing dry run migration...');
    }

    try {
      // Create backup if requested
      if (options.createBackup && !options.dryRun) {
        await this.createBackup();
      }

      // Migrate skills
      if (config.skills && config.skills.length > 0) {
        const skillResults = await this.migrateSkills(config.skills, options);
        result.details!.skills = skillResults;
      }

      // Migrate resource groups
      if (config.resourceGroups && config.resourceGroups.length > 0) {
        const resourceGroupResults = await this.migrateResourceGroups(config.resourceGroups, options);
        result.details!.resourceGroups = resourceGroupResults;
      }

      // Migrate agents
      if (config.agents && config.agents.length > 0) {
        const agentResults = await this.migrateAgents(config.agents, options);
        result.details!.agents = agentResults;
      }

      // Migrate CSQs
      if (config.csqs && config.csqs.length > 0) {
        const csqResults = await this.migrateCSQs(config.csqs, options);
        result.details!.csqs = csqResults;
      }

      // Migrate resources
      if (config.resources && config.resources.length > 0) {
        const resourceResults = await this.migrateResources(config.resources, options);
        result.details!.resources = resourceResults;
      }

      // Migrate teams
      if (config.teams && config.teams.length > 0) {
        const teamResults = await this.migrateTeams(config.teams, options);
        result.details!.teams = teamResults;
      }

      // Migrate applications
      if (config.applications && config.applications.length > 0) {
        const appResults = await this.migrateApplications(config.applications, options);
        result.details!.applications = appResults;
      }

      // Migrate triggers
      if (config.triggers && config.triggers.length > 0) {
        result.details!.triggers = { created: 0, updated: 0, failed: 0 };
        const triggerResults = await this.migrateTriggers(config.triggers, options);
        result.details!.triggers = triggerResults;
      }

      // Migrate devices
      if (config.devices && config.devices.length > 0) {
        const deviceResults = await this.migrateDevices(config.devices, options);
        result.details!.devices = deviceResults;
      }

      // Check for any failures
      const totalFailures = 
        (result.details!.skills?.failed || 0) +
        (result.details!.resourceGroups?.failed || 0) +
        (result.details!.agents?.failed || 0) +
        (result.details!.csqs?.failed || 0) +
        (result.details!.resources?.failed || 0) +
        (result.details!.teams?.failed || 0) +
        (result.details!.applications?.failed || 0) +
        (result.details!.devices?.failed || 0);

      if (totalFailures > 0) {
        result.success = false;
        result.message = `Migration completed with ${totalFailures} failures`;
      }

    } catch (error) {
      result.success = false;
      result.message = error instanceof Error ? error.message : 'Migration failed with unknown error';
      result.errors = [result.message];
    }

    return result;
  }

  private async migrateAgents(
    agents: Agent[],
    options: { dryRun?: boolean; overrideExisting?: boolean }
  ): Promise<{ created: number; updated: number; failed: number }> {
    const results = { created: 0, updated: 0, failed: 0 };

    for (const agent of agents) {
      try {
        if (options.dryRun) {
          console.log(`[DRY RUN] Would migrate agent: ${agent.name}`);
          results.created++;
          continue;
        }

        // Check if agent exists
        const existingAgent = await this.getAgent(agent.id);
        
        if (existingAgent && !options.overrideExisting) {
          console.log(`Agent ${agent.name} already exists, skipping`);
          continue;
        }

        const agentData = {
          id: agent.id,
          name: agent.name,
          extension: agent.extension,
          enabled: agent.enabled,
          skills: agent.skills || [],
          teams: agent.teams || [],
          ...agent.settings,
        };

        if (existingAgent) {
          await this.updateAgent(agent.id, agentData);
          results.updated++;
        } else {
          await this.createAgent(agentData);
          results.created++;
        }
      } catch (error) {
        console.error(`Failed to migrate agent ${agent.name}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  private async migrateCSQs(
    csqs: any[],
    options: { dryRun?: boolean; overrideExisting?: boolean }
  ): Promise<{ created: number; updated: number; failed: number }> {
    const results = { created: 0, updated: 0, failed: 0 };

    for (const csq of csqs) {
      try {
        if (options.dryRun) {
          console.log(`[DRY RUN] Would migrate CSQ: ${csq.name}`);
          results.created++;
          continue;
        }

        // Build CSQ data with target skill IDs
        const csqData = await this.buildCSQXMLData(csq);

        // Create CSQ directly (don't check if exists - just provision)
        const createdCSQ = await this.createCSQ(csqData);
        // Store target CSQ ID mapping
        if (createdCSQ && createdCSQ.id && csq.targetConnectionId) {
          await this.updateCSQMapping(csq.id, createdCSQ.id, csq.targetConnectionId);
          console.log(`Created new CSQ, stored mapping: DB ${csq.id} -> Target ${createdCSQ.id}`);
        }
        results.created++;
      } catch (error) {
        console.error(`Failed to migrate CSQ ${csq.name}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  private async migrateResources(
    resources: any[],
    options: { dryRun?: boolean; overrideExisting?: boolean }
  ): Promise<{ created: number; updated: number; failed: number }> {
    const results = { created: 0, updated: 0, failed: 0 };

    for (const resource of resources) {
      try {
        if (options.dryRun) {
          console.log(`[DRY RUN] Would migrate resource: ${resource.first_name || resource.firstName} ${resource.last_name || resource.lastName}`);
          results.created++;
          continue;
        }

        // Build resource XML data with target skill IDs
        const resourceData = await this.buildResourcesXMLData(resource);

        // Create resource directly (don't check if exists - just provision)
        const createdResource = await this.createResource(resourceData);
        // Store target user ID mapping
        if (createdResource && createdResource.userID && resource.targetConnectionId) {
          await this.updateResourceMapping(resource.id, createdResource.userID, resource.targetConnectionId);
          console.log(`Created new resource, stored mapping: DB ${resource.id} -> Target ${createdResource.userID}`);
        }
        results.created++;
      } catch (error) {
        console.error(`Failed to migrate resource ${resource.first_name || resource.firstName} ${resource.last_name || resource.lastName}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  private async migrateTeams(
    teams: any[],
    options: { dryRun?: boolean; overrideExisting?: boolean }
  ): Promise<{ created: number; updated: number; failed: number }> {
    const results = { created: 0, updated: 0, failed: 0 };

    for (const team of teams) {
      try {
        if (options.dryRun) {
          console.log(`[DRY RUN] Would migrate team: ${team.teamname || team.name}`);
          results.created++;
          continue;
        }

        // Build team XML data with target user IDs
        const teamData = await this.buildTeamsXMLData(team);

        // Create team directly (don't check if exists - just provision)
        const createdTeam = await this.createTeam(teamData);
        // Store target team ID mapping
        if (createdTeam && createdTeam.teamId && team.targetConnectionId) {
          await this.updateTeamMapping(team.id, createdTeam.teamId, team.targetConnectionId);
          console.log(`Created new team, stored mapping: DB ${team.id} -> Target ${createdTeam.teamId}`);
        }
        results.created++;
      } catch (error) {
        console.error(`Failed to migrate team ${team.teamname || team.name}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  private async migrateApplications(
    applications: any[],
    options: { dryRun?: boolean; overrideExisting?: boolean }
  ): Promise<{ created: number; updated: number; failed: number }> {
    const results = { created: 0, updated: 0, failed: 0 };

    for (const application of applications) {
      try {
        if (options.dryRun) {
          console.log(`[DRY RUN] Would migrate application: ${application.application_name || application.applicationName}`);
          results.created++;
          continue;
        }

        // Build application XML data
        const applicationData = await this.buildApplicationsXMLData(application);

        // Create application directly (don't check if exists - just provision)
        const createdApplication = await this.createApplication(applicationData);
        // Store target application name mapping
        if (createdApplication && createdApplication.applicationName && application.targetConnectionId) {
          await this.updateApplicationMapping(application.id, createdApplication.applicationName, application.targetConnectionId);
          console.log(`Created new application, stored mapping: DB ${application.id} -> Target ${createdApplication.applicationName}`);
        }
        results.created++;
      } catch (error) {
        console.error(`Failed to migrate application ${application.application_name || application.applicationName}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  private async migrateTriggers(
    triggers: any[],
    options: { dryRun?: boolean; overrideExisting?: boolean }
  ): Promise<{ created: number; updated: number; failed: number }> {
    const results = { created: 0, updated: 0, failed: 0 };

    for (const trigger of triggers) {
      try {
        if (options.dryRun) {
          console.log(`[DRY RUN] Would migrate trigger: ${trigger.directory_number || trigger.directoryNumber}`);
          results.created++;
          continue;
        }

        // Build trigger XML data
        const triggerData = await this.buildTriggersXMLData(trigger);

        // Create trigger directly (don't check if exists - just provision)
        const createdTrigger = await this.createTrigger(triggerData);
        // Store target directory number mapping
        if (createdTrigger && createdTrigger.directoryNumber && trigger.targetConnectionId) {
          await this.updateTriggerMapping(trigger.id, createdTrigger.directoryNumber, trigger.targetConnectionId);
          console.log(`Created new trigger, stored mapping: DB ${trigger.id} -> Target ${createdTrigger.directoryNumber}`);
        }
        results.created++;
      } catch (error) {
        console.error(`Failed to migrate trigger ${trigger.directory_number || trigger.directoryNumber}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  private async buildResourcesXMLData(resource: any): Promise<string> {
    // Build the skill competencies with target skill IDs
    let skillCompetencies = '';
    
    // Get resource skills from database if not provided
    let resourceSkills = resource.skills || [];
    if (!resource.skills || resource.skills.length === 0) {
      resourceSkills = await storage.getResourceSkills(resource.id);
    }
    
    if (resourceSkills && resourceSkills.length > 0) {
      for (const skill of resourceSkills) {
        // Get skill details to get skill name
        const skillDetails = await storage.getSkillBySkillId(skill.skillId);
        let skillName = skillDetails?.skillName || `skill${skill.skillId}`;
        
        // Clean skill name - remove curly braces, quotes, and other invalid XML characters
        skillName = String(skillName).replace(/[{}"']/g, '').trim();
        
        // Get target skill ID for this connection
        const targetSkillId = await storage.getTargetSkillId(skill.skillId, resource.targetConnectionId);
        const skillRefURL = targetSkillId ? `/adminapi/skill/${targetSkillId}` : `/adminapi/skill/${skill.skillId}`;
        
        skillCompetencies += `
          <skillCompetency>
              <competencelevel>${skill.competencyLevel || 5}</competencelevel>
              <skillNameUriPair name="${skillName}">
                  <refURL>${skillRefURL}</refURL>
              </skillNameUriPair>
          </skillCompetency>`;
      }
    }

    // Build the complete Resource XML
    const resourceXML = `<resource xmlns:xsi="https://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="resource.xsd">
    <self href="" rel="" type="" />
    <userID>${resource.user_id || resource.userID}</userID>
    <firstName>${resource.first_name || resource.firstName}</firstName>
    <lastName>${resource.last_name || resource.lastName}</lastName>
    <extension>${resource.extension || ''}</extension>
    <alias>${resource.alias || ''}</alias>
    <skillMap>${skillCompetencies}
    </skillMap>
    <autoAvailable>${resource.auto_available !== undefined ? resource.auto_available : (resource.autoAvailable !== false)}</autoAvailable>
    <type>${resource.type || 1}</type>
</resource>`;

    return resourceXML;
  }

  private async buildTeamsXMLData(team: any): Promise<string> {
    // Build the team members with target user IDs
    let teamMembers = '';
    
    // Get team resources from database if not provided
    let teamResources = team.resources || [];
    if (!team.resources || team.resources.length === 0) {
      teamResources = await storage.getTeamResources(team.id);
    }
    
    if (teamResources && teamResources.length > 0) {
      for (const teamResource of teamResources) {
        // Get resource details to get user ID
        const resourceDetails = await storage.getResourceByUserID(teamResource.userID);
        let userID = resourceDetails?.userID || teamResource.userID;
        
        // Get target user ID for this connection
        const targetUserID = await storage.getTargetUserID(teamResource.userID, team.targetConnectionId);
        const userRefURL = targetUserID ? `/adminapi/user/${targetUserID}` : `/adminapi/user/${userID}`;
        
        teamMembers += `
          <member>
              <userID>${targetUserID || userID}</userID>
              <refURL>${userRefURL}</refURL>
          </member>`;
      }
    }

    // Build primary supervisor element if available
    let primarySupervisorXML = '';
    if (team.primary_supervisor_user_id || team.primarySupervisorUserID) {
      const supervisorUserID = team.primary_supervisor_user_id || team.primarySupervisorUserID;
      
      // Get target user ID for the supervisor
      const targetSupervisorUserID = await storage.getTargetUserID(supervisorUserID, team.targetConnectionId);
      const supervisorRefURL = targetSupervisorUserID 
        ? `/adminapi/resource/${targetSupervisorUserID}` 
        : `/adminapi/resource/${supervisorUserID}`;
      
      primarySupervisorXML = `
    <primarySupervisor>
        <refURL>${supervisorRefURL}</refURL>
    </primarySupervisor>`;
    }

    // Build the complete Team XML
    const teamXML = `<team xmlns:xsi="https://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="team.xsd">
    <self href="" rel="" type="" />
    <teamname>${team.teamname || team.name}</teamname>
    <teamId>${team.team_id || team.teamId}</teamId>${primarySupervisorXML}
    <members>${teamMembers}
    </members>
</team>`;

    return teamXML;
  }

  private async buildApplicationsXMLData(application: any): Promise<string> {
    // Build ScriptApplication nested element if script is provided
    let scriptApplicationXML = '';
    const script = application.script || application.application_script;
    const defaultScript = application.default_script || application.defaultScript;
    
    if (script) {
      scriptApplicationXML = `
    <ScriptApplication>
        <script>${script}</script>${defaultScript ? `
        <defaultScript>${defaultScript}</defaultScript>` : ''}
    </ScriptApplication>`;
    }
    
    // Build the complete Application XML matching UCCX schema
    const applicationXML = `<application xmlns:xsi="https://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="application.xsd">
    <self href="" rel="" type="" />${scriptApplicationXML}
    <id>${application.application_id || application.applicationId || ''}</id>
    <applicationName>${application.application_name || application.applicationName}</applicationName>
    <type>${application.type || 'Cisco Script Application'}</type>
    <description>${application.description || ''}</description>
    <maxsession>${application.maxsession || 200}</maxsession>
    <enabled>${application.enabled !== false}</enabled>
</application>`;

    return applicationXML;
  }

  private async buildTriggersXMLData(trigger: any): Promise<string> {
    // Get field values with fallbacks for snake_case and camelCase
    const directoryNumber = trigger.directory_number || trigger.directoryNumber || '';
    const applicationName = trigger.application_name || trigger.applicationName || '';
    const deviceName = trigger.device_name || trigger.deviceName || '';
    const description = trigger.description || '';
    const callControlGroupId = trigger.call_control_group_id || trigger.callControlGroupId || '0';
    const callControlGroupName = trigger.call_control_group_name || trigger.callControlGroupName || callControlGroupId;
    const triggerEnabled = trigger.trigger_enabled !== undefined ? trigger.trigger_enabled : (trigger.triggerEnabled !== false);
    const maxNumOfSessions = trigger.max_num_of_sessions || trigger.maxNumOfSessions || 10;
    const idleTimeout = trigger.idle_timeout || trigger.idleTimeout || 5000;
    const alertingNameAscii = trigger.alerting_name_ascii || trigger.alertingNameAscii || '';
    const devicePool = trigger.device_pool || trigger.devicePool || 'Default';
    const location = trigger.location || 'Hub_None';
    const partition = trigger.partition || 'None';
    const voiceMailProfile = trigger.voice_mail_profile || trigger.voiceMailProfile || 'None';
    const callingSearchSpace = trigger.calling_search_space || trigger.callingSearchSpace || 'None';
    const callingSearchSpaceForRedirect = trigger.calling_search_space_for_redirect || trigger.callingSearchSpaceForRedirect || 'default';
    const presenceGroup = trigger.presence_group || trigger.presenceGroup || 'Standard Presence group';
    const display = trigger.display || '';
    const externalPhoneMaskNumber = trigger.external_phone_mask_number || trigger.externalPhoneMaskNumber || '';
    const locale = trigger.locale || 'en_US';
    
    // Get forward busy settings from metadata if available
    const metadata = trigger.metadata || {};
    const forwardBusy = metadata.forwardBusy || metadata.originalData?.forwardBusy?.[0] || {};
    const forwardBusyVoiceMail = forwardBusy.forwardBusyVoiceMail?.[0] || 'false';
    const forwardBusyDestination = forwardBusy.forwardBusyDestination?.[0] || '';
    const forwardBusyCallingSearchSpace = forwardBusy.forwardBusyCallingSearchSpace?.[0] || 'None';
    
    // Get dialog group from metadata for overrideMediaTermination
    const dialogGroupId = metadata.dialogGroupId || metadata.originalData?.overrideMediaTermination?.[0]?.dialogGroup?.[0]?.$?.name || '0';
    
    // Build the complete Trigger XML matching UCCX schema
    const triggerXML = `<?xml version="1.0" encoding="UTF-8"?>
<trigger>
    <self rel="self" href="/adminapi/trigger/${encodeURIComponent(directoryNumber)}" type="trigger"/>
    <directoryNumber>${directoryNumber}</directoryNumber>
    <locale>${locale}</locale>
    <application name="${applicationName}">
        <refURL>/adminapi/application/${encodeURIComponent(applicationName)}</refURL>
    </application>
    <deviceName>${deviceName}</deviceName>
    <description>${description}</description>
    <callControlGroup name="${callControlGroupName}">
        <refURL>/adminapi/callControlGroup/${callControlGroupId}</refURL>
    </callControlGroup>
    <triggerEnabled>${triggerEnabled}</triggerEnabled>
    <maxNumOfSessions>${maxNumOfSessions}</maxNumOfSessions>
    <idleTimeout>${idleTimeout}</idleTimeout>
    <overrideMediaTermination>
        <dialogGroup name="${dialogGroupId}">
            <refURL>/adminapi/dialogGroup/${dialogGroupId}</refURL>
        </dialogGroup>
    </overrideMediaTermination>
    <alertingNameAscii>${alertingNameAscii}</alertingNameAscii>
    <devicePool>${devicePool}</devicePool>
    <location>${location}</location>
    <partition>${partition}</partition>
    <voiceMailProfile>${voiceMailProfile}</voiceMailProfile>
    <callingSearchSpace>${callingSearchSpace}</callingSearchSpace>
    <callingSearchSpaceForRedirect>${callingSearchSpaceForRedirect}</callingSearchSpaceForRedirect>
    <presenceGroup>${presenceGroup}</presenceGroup>
    <forwardBusy>
        <forwardBusyVoiceMail>${forwardBusyVoiceMail}</forwardBusyVoiceMail>
        <forwardBusyDestination>${forwardBusyDestination}</forwardBusyDestination>
        <forwardBusyCallingSearchSpace>${forwardBusyCallingSearchSpace}</forwardBusyCallingSearchSpace>
    </forwardBusy>
    <display>${display}</display>
    <externalPhoneMaskNumber>${externalPhoneMaskNumber}</externalPhoneMaskNumber>
</trigger>`;

    return triggerXML;
  }

  private async createResource(xmlData: string): Promise<any> {
    // UCCX API requires PUT method for creating/updating resources
    // Extract userID from xmlData to use in URL
    const userIDMatch = xmlData.match(/<userID>([^<]+)<\/userID>/);
    if (!userIDMatch) {
      throw new Error('Could not extract userID from resource XML data');
    }
    const userID = userIDMatch[1];
    
    const response = await this.client.put(`/adminapi/resource/${userID}`, xmlData, {
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
      },
    });
    
    // UCCX API returns the resource URL or XML
    const responseData = response.data;
    if (typeof responseData === 'string') {
      // Extract userID from URL if it's a URL response
      const urlMatch = responseData.match(/\/resource\/([^\/]+)$/);
      if (urlMatch) {
        return {
          userID: urlMatch[1],
          self: responseData,
        };
      }
      
      // Try parsing as XML if it's not a URL
      if (responseData.trim().startsWith('<')) {
        const parsed = await parseStringPromise(responseData, { explicitArray: false });
        const resource = parsed.resource || {};
        return {
          userID: resource.userID || userID,
          self: resource.self,
        };
      }
    }
    
    return { userID };
  }

  private async createTeam(xmlData: string): Promise<any> {
    // UCCX API requires POST method for creating teams
    // Extract teamId from xmlData for response parsing
    const teamIdMatch = xmlData.match(/<teamId>([^<]+)<\/teamId>/);
    if (!teamIdMatch) {
      throw new Error('Could not extract teamId from team XML data');
    }
    const teamId = teamIdMatch[1];
    
    const response = await this.client.post('/adminapi/team', xmlData, {
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
      },
    });
    
    // UCCX API returns the team URL or XML
    const responseData = response.data;
    if (typeof responseData === 'string') {
      // Extract teamId from URL if it's a URL response
      const urlMatch = responseData.match(/\/team\/([^\/]+)$/);
      if (urlMatch) {
        return {
          teamId: urlMatch[1],
          self: responseData,
        };
      }
      
      // Try parsing as XML if it's not a URL
      if (responseData.trim().startsWith('<')) {
        const parsed = await parseStringPromise(responseData, { explicitArray: false });
        const team = parsed.team || {};
        return {
          teamId: team.teamId || teamId,
          self: team.self,
        };
      }
    }
    
    return { teamId };
  }

  private async updateResourceMapping(resourceDbId: string, targetUserID: string, targetConnectionId: string): Promise<void> {
    await storage.updateResource(resourceDbId, {
      targetUserID: targetUserID,
      targetConnectionId: targetConnectionId,
    });
    
    console.log(`Updated resource mapping: DB ID ${resourceDbId} -> Target User ID ${targetUserID} on connection ${targetConnectionId}`);
  }

  private async updateTeamMapping(teamDbId: string, targetTeamId: string, targetConnectionId: string): Promise<void> {
    await storage.updateTeam(teamDbId, {
      targetTeamId: targetTeamId,
      targetConnectionId: targetConnectionId,
    });
    
    console.log(`Updated team mapping: DB ID ${teamDbId} -> Target Team ID ${targetTeamId} on connection ${targetConnectionId}`);
  }

  private async createApplication(xmlData: string): Promise<any> {
    // UCCX API requires POST method for creating applications
    // Extract applicationName from xmlData for response parsing
    const appNameMatch = xmlData.match(/<applicationName>([^<]+)<\/applicationName>/);
    if (!appNameMatch) {
      throw new Error('Could not extract applicationName from application XML data');
    }
    const applicationName = appNameMatch[1];
    
    const response = await this.client.post('/adminapi/application', xmlData, {
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
      },
    });
    
    // UCCX API returns the application URL or XML
    const responseData = response.data;
    if (typeof responseData === 'string') {
      // Extract applicationName from URL if it's a URL response
      const urlMatch = responseData.match(/\/application\/([^\/]+)$/);
      if (urlMatch) {
        return {
          applicationName: decodeURIComponent(urlMatch[1]),
          self: responseData,
        };
      }
      
      // Try parsing as XML if it's not a URL
      if (responseData.trim().startsWith('<')) {
        const parsed = await parseStringPromise(responseData, { explicitArray: false });
        const application = parsed.application || {};
        return {
          applicationName: application.applicationName || applicationName,
          self: application.self,
        };
      }
    }
    
    return { applicationName };
  }

  private async createTrigger(xmlData: string): Promise<any> {
    // UCCX API requires POST method for creating triggers
    // Extract directoryNumber from xmlData for response parsing
    const dnMatch = xmlData.match(/<directoryNumber>([^<]+)<\/directoryNumber>/);
    if (!dnMatch) {
      throw new Error('Could not extract directoryNumber from trigger XML data');
    }
    const directoryNumber = dnMatch[1];
    
    const response = await this.client.post('/adminapi/trigger', xmlData, {
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
      },
    });
    
    // UCCX API returns the trigger URL or XML
    const responseData = response.data;
    if (typeof responseData === 'string') {
      // Extract directoryNumber from URL if it's a URL response
      const urlMatch = responseData.match(/\/trigger\/([^\/]+)$/);
      if (urlMatch) {
        return {
          directoryNumber: decodeURIComponent(urlMatch[1]),
          self: responseData,
        };
      }
      
      // Try parsing as XML if it's not a URL
      if (responseData.trim().startsWith('<')) {
        const parsed = await parseStringPromise(responseData, { explicitArray: false });
        const trigger = parsed.trigger || {};
        return {
          directoryNumber: trigger.directoryNumber || directoryNumber,
          self: trigger.self,
        };
      }
    }
    
    return { directoryNumber };
  }

  private async updateApplicationMapping(applicationDbId: string, targetApplicationName: string, targetConnectionId: string): Promise<void> {
    await storage.updateApplication(applicationDbId, {
      targetApplicationName: targetApplicationName,
      targetConnectionId: targetConnectionId,
    });
    
    console.log(`Updated application mapping: DB ID ${applicationDbId} -> Target Application Name ${targetApplicationName} on connection ${targetConnectionId}`);
  }

  private async updateTriggerMapping(triggerDbId: string, targetDirectoryNumber: string, targetConnectionId: string): Promise<void> {
    await storage.updateTrigger(triggerDbId, {
      targetDirectoryNumber: targetDirectoryNumber,
      targetConnectionId: targetConnectionId,
    });
    
    console.log(`Updated trigger mapping: DB ID ${triggerDbId} -> Target Directory Number ${targetDirectoryNumber} on connection ${targetConnectionId}`);
  }

  private async migrateSkills(
    skills: any[],
    options: { dryRun?: boolean; overrideExisting?: boolean }
  ): Promise<{ created: number; updated: number; failed: number }> {
    const results = { created: 0, updated: 0, failed: 0 };

    // Load all target skills ONCE and build name-based map for efficient lookup
    console.log('Loading existing skills from target system...');
    const targetSkills = await this.fetchSkills();
    const skillNameMap = new Map<string, any>();
    targetSkills.forEach(targetSkill => {
      if (targetSkill.skillName) {
        skillNameMap.set(targetSkill.skillName.toLowerCase(), targetSkill);
      }
    });
    console.log(`Found ${targetSkills.length} existing skills on target system`);

    for (const skill of skills) {
      try {
        if (options.dryRun) {
          console.log(`[DRY RUN] Would migrate skill: ${skill.skillName}`);
          results.created++;
          continue;
        }

        // Check if skill exists by NAME (not ID) on target system
        const existingSkill = skillNameMap.get(skill.skillName.toLowerCase());
        
        if (existingSkill) {
          console.log(`Skill "${skill.skillName}" already exists on target with ID ${existingSkill.skillId}`);
          
          if (options.overrideExisting) {
            // Update existing skill using target system's skill ID
            // Extract plain string from skillName (handle cases where it might be wrapped in JSON)
            let plainSkillName = skill.skillName;
            if (typeof plainSkillName === 'object') {
              plainSkillName = JSON.stringify(plainSkillName);
            }
            // Remove any JSON wrapping characters
            plainSkillName = String(plainSkillName).replace(/^[{"']+|[}"']+$/g, '');
            
            const skillData: any = {
              skillName: plainSkillName,
            };
            const updatedSkill = await this.updateSkill(existingSkill.skillId, skillData);
            // Store the mapping using target skill ID
            if (updatedSkill && updatedSkill.skillId) {
              await this.updateSkillMapping(skill.id, updatedSkill.skillId, skill.targetConnectionId);
            }
            results.updated++;
          } else {
            // Skip migration but still persist mapping for CSQ provisioning
            await this.updateSkillMapping(skill.id, existingSkill.skillId, skill.targetConnectionId);
            console.log(`Skipped existing skill, stored mapping: DB ${skill.id} -> Target ${existingSkill.skillId}`);
            // Don't increment any counter for skipped skills
          }
        } else {
          // Skill doesn't exist, create new one
          // Extract plain string from skillName (handle cases where it might be wrapped in JSON)
          let plainSkillName = skill.skillName;
          if (typeof plainSkillName === 'object') {
            plainSkillName = JSON.stringify(plainSkillName);
          }
          // Remove any JSON wrapping characters
          plainSkillName = String(plainSkillName).replace(/^[{"']+|[}"']+$/g, '');
          
          const skillData: any = {
            skillName: plainSkillName,
          };
          const createdSkill = await this.createSkill(skillData);
          // Store the target skill ID returned by the API
          if (createdSkill && createdSkill.skillId) {
            await this.updateSkillMapping(skill.id, createdSkill.skillId, skill.targetConnectionId);
            console.log(`Created new skill, stored mapping: DB ${skill.id} -> Target ${createdSkill.skillId}`);
          }
          results.created++;
        }
      } catch (error) {
        console.error(`Failed to migrate skill ${skill.skillName}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  private async migrateResourceGroups(
    resourceGroups: any[],
    options: { dryRun?: boolean; overrideExisting?: boolean }
  ): Promise<{ created: number; updated: number; failed: number }> {
    const results = { created: 0, updated: 0, failed: 0 };

    for (const resourceGroup of resourceGroups) {
      try {
        if (options.dryRun) {
          console.log(`[DRY RUN] Would migrate resource group: ${resourceGroup.name}`);
          results.created++;
          continue;
        }

        // Create resource group directly (don't check if exists - just provision)
        const resourceGroupData: any = {
          name: resourceGroup.name,
        };

        const createdResourceGroup = await this.createResourceGroup(resourceGroupData);
        // Store the target resource group ID returned by the API
        if (createdResourceGroup && createdResourceGroup.id) {
          await this.updateResourceGroupMapping(resourceGroup.id, createdResourceGroup.id, resourceGroup.targetConnectionId);
          console.log(`Created new resource group, stored mapping: DB ${resourceGroup.id} -> Target ${createdResourceGroup.id}`);
        }
        results.created++;
      } catch (error) {
        console.error(`Failed to migrate resource group ${resourceGroup.name}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  private async migrateDevices(
    devices: Device[],
    options: { dryRun?: boolean; overrideExisting?: boolean }
  ): Promise<{ created: number; updated: number; failed: number }> {
    const results = { created: 0, updated: 0, failed: 0 };

    for (const device of devices) {
      try {
        if (options.dryRun) {
          console.log(`[DRY RUN] Would migrate device: ${device.name}`);
          results.created++;
          continue;
        }

        const existingDevice = await this.getDevice(device.id);
        
        if (existingDevice && !options.overrideExisting) {
          console.log(`Device ${device.name} already exists, skipping`);
          continue;
        }

        const deviceData = {
          id: device.id,
          name: device.name,
          type: device.type,
          description: device.description,
          enabled: device.enabled,
          ...device.settings,
        };

        if (existingDevice) {
          await this.updateDevice(device.id, deviceData);
          results.updated++;
        } else {
          await this.createDevice(deviceData);
          results.created++;
        }
      } catch (error) {
        console.error(`Failed to migrate device ${device.name}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  // UCCX API endpoints (based on Cisco UCCX Configuration APIs)
  private async getAgent(id: string): Promise<any> {
    try {
      const response = await this.client.get(`/appadmin/agent/${id}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async createAgent(agentData: any): Promise<any> {
    const response = await this.client.post('/appadmin/agent', agentData);
    return response.data;
  }

  private async updateAgent(id: string, agentData: any): Promise<any> {
    const response = await this.client.post('/appadmin/agent', agentData);
    return response.data;
  }

  private async getCSQ(id: string): Promise<any> {
    try {
      const response = await this.client.get(`/adminapi/csq/${id}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async createCSQ(csqData: any): Promise<any> {
    const response = await this.client.post('/adminapi/csq', csqData, {
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
      },
    });
    
    // UCCX API returns the CSQ URL (e.g., "https://host/adminapi/csq/25")
    const responseData = response.data;
    console.log('CSQ API Response:', responseData);
    console.log('Response type:', typeof responseData);
    
    if (typeof responseData === 'string') {
      // Extract CSQ ID from URL
      const urlMatch = responseData.match(/\/csq\/(\d+)$/);
      console.log('URL match result:', urlMatch);
      
      if (urlMatch) {
        const result = {
          id: urlMatch[1],
          self: responseData,
        };
        console.log('Returning CSQ with ID:', result);
        return result;
      }
      
      // Try parsing as XML if it's not a URL
      if (responseData.trim().startsWith('<')) {
        const parsed = await parseStringPromise(responseData, { explicitArray: false });
        const csq = parsed.csq || parsed.CSQ || {};
        return {
          id: csq.csqId || csq.id,
          name: csq.name,
          self: csq.self,
        };
      }
    }
    
    console.log('Returning raw response data:', responseData);
    return responseData;
  }

  private async updateCSQ(id: string, csqData: any): Promise<any> {
    const response = await this.client.post('/adminapi/csq', csqData, {
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
      },
    });
    
    // UCCX API returns the CSQ URL (e.g., "https://host/adminapi/csq/25")
    const responseData = response.data;
    if (typeof responseData === 'string') {
      // Extract CSQ ID from URL
      const urlMatch = responseData.match(/\/csq\/(\d+)$/);
      if (urlMatch) {
        return {
          id: urlMatch[1],
          self: responseData,
        };
      }
      
      // Try parsing as XML if it's not a URL
      if (responseData.trim().startsWith('<')) {
        const parsed = await parseStringPromise(responseData, { explicitArray: false });
        const csq = parsed.csq || parsed.CSQ || {};
        return {
          id: csq.csqId || csq.id,
          name: csq.name,
          self: csq.self,
        };
      }
    }
    
    return responseData;
  }

  private async buildCSQXMLData(csq: any): Promise<string> {
    
    const resourcePoolType = csq.resourcePoolType || 'SKILL_GROUP';
    let poolSpecificInfoXml = '';
    
    if (resourcePoolType === 'SKILL_GROUP') {
      // Build the skill competencies with target skill IDs
      let skillCompetencies = '';
      
      // Get CSQ skills from database if not provided
      let csqSkills = csq.skills || [];
      if (!csq.skills || csq.skills.length === 0) {
        csqSkills = await storage.getCSQSkills(csq.id);
      }
      
      if (csqSkills && csqSkills.length > 0) {
        for (const skill of csqSkills) {
          // Get skill details to get skill name
          const skillDetails = await storage.getSkillBySkillId(skill.skillId);
          let skillName = skillDetails?.skillName || `skill${skill.skillId}`;
          
          // Clean skill name - remove curly braces, quotes, and other invalid XML characters
          skillName = String(skillName).replace(/[{}"']/g, '').trim();
          
          // Get target skill ID for this connection
          const targetSkillId = await storage.getTargetSkillId(skill.skillId, csq.targetConnectionId);
          const skillRefURL = targetSkillId ? `/adminapi/skill/${targetSkillId}` : `/adminapi/skill/${skill.skillId}`;
          
          skillCompetencies += `
            <skillCompetency>
                <competencelevel>${skill.competencyLevel || 5}</competencelevel>
                <skillNameUriPair name="${skillName}">
                    <refURL>${skillRefURL}</refURL>
                </skillNameUriPair>
                <weight>${skill.weight || 1}</weight>
            </skillCompetency>`;
        }
      }
      
      poolSpecificInfoXml = `
        <skillGroup>${skillCompetencies}
            <selectionCriteria>Longest Available</selectionCriteria>
        </skillGroup>`;
        
    } else if (resourcePoolType === 'RESOURCE_GROUP') {
      // Build resource group XML structure
      let csqResourceGroups = csq.resourceGroups || [];
      if (!csq.resourceGroups || csq.resourceGroups.length === 0) {
        csqResourceGroups = await storage.getCSQResourceGroups(csq.id);
      }
      
      if (csqResourceGroups && csqResourceGroups.length > 0) {
        const resourceGroup = csqResourceGroups[0]; // CSQs typically have one resource group
        
        console.log(`Looking up resource group ID: ${resourceGroup.resourceGroupId} for CSQ: ${csq.name}`);
        
        // Get resource group details - don't filter by source connection, just get by ID
        const resourceGroupDetails = await storage.getResourceGroupByResourceGroupId(Number(resourceGroup.resourceGroupId));
        
        console.log(`Resource group details:`, resourceGroupDetails);
        
        let resourceGroupName = resourceGroupDetails?.name || `ResourceGroup${resourceGroup.resourceGroupId}`;
        
        // Clean resource group name
        resourceGroupName = String(resourceGroupName).replace(/[{}"']/g, '').trim();
        
        console.log(`Resource group name: ${resourceGroupName}`);
        
        // Get target resource group ID for this connection
        const targetResourceGroupId = await storage.getTargetResourceGroupId(
          String(resourceGroup.resourceGroupId), 
          csq.targetConnectionId
        );
        
        console.log(`Target resource group ID: ${targetResourceGroupId} for connection: ${csq.targetConnectionId}`);
        
        if (!targetResourceGroupId) {
          throw new Error(
            `Resource group ID ${resourceGroup.resourceGroupId} (${resourceGroupName}) has not been migrated to the target system yet. ` +
            `Please migrate resource groups first before migrating CSQs.`
          );
        }
        
        const resourceGroupRefURL = `/adminapi/resourceGroup/${targetResourceGroupId}`;
        
        poolSpecificInfoXml = `
        <resourceGroup>
            <resourceGroupNameUriPair name="${resourceGroupName}">
                <refURL>${resourceGroupRefURL}</refURL>
            </resourceGroupNameUriPair>
            <selectionCriteria>Longest Available</selectionCriteria>
        </resourceGroup>`;
      }
    }

    // Build routingType for EMAIL and CHAT CSQs (required by UCCX API)
    let routingTypeXml = '';
    let accountUserIdXml = '';
    let emailFieldsXml = '';
    const queueType = csq.queueType || 'VOICE';
    if (queueType === 'EMAIL' || queueType === 'CHAT') {
      // Default to NONINTERACTIVE for EMAIL, INTERACTIVE for CHAT if not specified
      const routingType = csq.routingType || (queueType === 'EMAIL' ? 'NONINTERACTIVE' : 'INTERACTIVE');
      routingTypeXml = `\n    <routingType>${routingType}</routingType>`;
      
      // Add accountUserId for NONINTERACTIVE routing type (required for EMAIL)
      if (routingType === 'NONINTERACTIVE' && csq.accountUserId) {
        accountUserIdXml = `\n    <accountUserId>${csq.accountUserId}</accountUserId>`;
      }
      
      // Add email-specific fields for EMAIL queue type
      if (queueType === 'EMAIL') {
        const emailAuthType = csq.emailAuthType || 'PLAIN';
        // Use dummy password if not provided (UCCX API requires accountPassword field)
        const accountPassword = csq.accountPassword || 'password123';
        const channelProviderName = csq.channelProviderName || '1';
        // Build channelProviderRefURL from target system's base URL if not provided
        const channelProviderRefURL = csq.channelProviderRefURL || `${this.baseUrl}/adminapi/channelProvider/${channelProviderName}`;
        const pollingInterval = csq.pollingInterval || 60;
        const folderName = csq.folderName || 'inbox';
        const snapshotAge = csq.snapshotAge || 120;
        
        emailFieldsXml = `
    <emailAuthType>${emailAuthType}</emailAuthType>
    <accountPassword>${accountPassword}</accountPassword>
    <channelProvider name="${channelProviderName}">
        <refURL>${channelProviderRefURL}</refURL>
    </channelProvider>
    <pollingInterval>${pollingInterval}</pollingInterval>
    <folderName>${folderName}</folderName>
    <snapshotAge>${snapshotAge}</snapshotAge>`;
      }
    }

    // Build the complete CSQ XML
    const csqXML = `<csq xmlns:xsi="https://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="csq.xsd">
    <self href="" rel="" type="" />
    <name>${csq.name}</name>
    <queueType>${queueType}</queueType>${routingTypeXml}${accountUserIdXml}${emailFieldsXml}
    <queueAlgorithm>${csq.queueAlgorithm || 'FIFO'}</queueAlgorithm>
    <autoWork>${csq.autoWork !== undefined ? csq.autoWork : true}</autoWork>
    <wrapupTime>${csq.wrapupTime || 1}</wrapupTime>
    <resourcePoolType>${resourcePoolType}</resourcePoolType>
    <serviceLevel>${csq.serviceLevel || 5}</serviceLevel>
    <serviceLevelPercentage>${csq.serviceLevelPercentage || 70}</serviceLevelPercentage>
    <poolSpecificInfo>${poolSpecificInfoXml}
    </poolSpecificInfo>
</csq>`;

    return csqXML;
  }

  private async updateCSQMapping(csqDbId: string, targetCSQId: string, targetConnectionId: string): Promise<void> {
    
    await storage.updateCSQ(csqDbId, {
      targetCSQId: targetCSQId,
      targetConnectionId: targetConnectionId,
    });
    
    console.log(`Updated CSQ mapping: DB ID ${csqDbId} -> Target ID ${targetCSQId} on connection ${targetConnectionId}`);
  }

  private async getDevice(id: string): Promise<any> {
    try {
      const response = await this.client.get(`/appadmin/device/${id}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async createDevice(deviceData: any): Promise<any> {
    const response = await this.client.post('/appadmin/device', deviceData);
    return response.data;
  }

  private async updateDevice(id: string, deviceData: any): Promise<any> {
    const response = await this.client.post('/appadmin/device', deviceData);
    return response.data;
  }

  private async getSkill(skillId: string): Promise<any> {
    try {
      const response = await this.client.get(`/adminapi/skill/${skillId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async createSkill(skillData: any): Promise<any> {
    // UCCX API requires XML format for creating skills
    const xmlBody = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<skill>
  <skillName>${skillData.skillName}</skillName>
</skill>`;

    const response = await this.client.post('/adminapi/skill', xmlBody, {
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
      },
    });
    
    // UCCX API returns the skill URL (e.g., "https://host/adminapi/skill/49")
    const responseData = response.data;
    if (typeof responseData === 'string') {
      // Extract skill ID from URL
      const urlMatch = responseData.match(/\/skill\/(\d+)$/);
      if (urlMatch) {
        return {
          skillId: urlMatch[1],
          skillName: skillData.skillName,
          self: responseData,
        };
      }
      
      // Try parsing as XML if it's not a URL
      if (responseData.trim().startsWith('<')) {
        const parsed = await parseStringPromise(responseData, { explicitArray: false });
        const skill = parsed.skill || {};
        return {
          skillId: skill.skillId,
          skillName: skill.skillName,
          self: skill.self,
        };
      }
    }
    
    return responseData;
  }

  private async updateSkill(skillId: string, skillData: any): Promise<any> {
    // UCCX API requires XML format for updating skills
    const xmlBody = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<skill>
  <skillId>${skillId}</skillId>
  <skillName>${skillData.skillName}</skillName>
</skill>`;

    const response = await this.client.post('/adminapi/skill', xmlBody, {
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml',
      },
    });
    
    // UCCX API returns the skill URL (e.g., "https://host/adminapi/skill/49")
    const responseData = response.data;
    if (typeof responseData === 'string') {
      // Extract skill ID from URL
      const urlMatch = responseData.match(/\/skill\/(\d+)$/);
      if (urlMatch) {
        return {
          skillId: urlMatch[1],
          skillName: skillData.skillName,
          self: responseData,
        };
      }
      
      // Try parsing as XML if it's not a URL
      if (responseData.trim().startsWith('<')) {
        const parsed = await parseStringPromise(responseData, { explicitArray: false });
        const skill = parsed.skill || {};
        return {
          skillId: skill.skillId,
          skillName: skill.skillName,
          self: skill.self,
        };
      }
    }
    
    return responseData;
  }

  private async updateSkillMapping(skillDbId: string, targetSkillId: string, targetConnectionId: string): Promise<void> {
    
    await storage.updateSkill(skillDbId, {
      targetSkillId: targetSkillId,
      targetConnectionId: targetConnectionId,
    });
    
    console.log(`Updated skill mapping: DB ID ${skillDbId} -> Target ID ${targetSkillId} on connection ${targetConnectionId}`);
  }

  private async getResourceGroup(resourceGroupId: string): Promise<any> {
    try {
      const response = await this.client.get(`/adminapi/resourceGroup/${resourceGroupId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  private async createResourceGroup(resourceGroupData: any): Promise<any> {
    const response = await this.client.post('/adminapi/resourceGroup', resourceGroupData);
    
    // UCCX API returns the resource group URL (e.g., "https://host/adminapi/resourceGroup/10")
    const responseData = response.data;
    console.log('Resource Group API Response:', responseData);
    console.log('Response type:', typeof responseData);
    
    if (typeof responseData === 'string') {
      // Extract resource group ID from URL
      const urlMatch = responseData.match(/\/resourceGroup\/(\d+)$/);
      console.log('URL match result:', urlMatch);
      
      if (urlMatch) {
        const result = {
          id: urlMatch[1],
          name: resourceGroupData.name,
          self: responseData,
        };
        console.log('Returning resource group with ID:', result);
        return result;
      }
      
      // Try parsing as XML if it's not a URL
      if (responseData.trim().startsWith('<')) {
        const parsed = await parseStringPromise(responseData, { explicitArray: false });
        const resourceGroup = parsed.ResourceGroup || parsed.resourceGroup || {};
        return {
          id: resourceGroup.resourceGroupId || resourceGroup.id,
          name: resourceGroup.name,
          self: resourceGroup.self,
        };
      }
    }
    
    console.log('Returning raw response data:', responseData);
    return responseData;
  }

  private async updateResourceGroup(resourceGroupId: string, resourceGroupData: any): Promise<any> {
    const response = await this.client.post('/adminapi/resourceGroup', resourceGroupData);
    
    // UCCX API returns the resource group URL (e.g., "https://host/adminapi/resourceGroup/10")
    const responseData = response.data;
    if (typeof responseData === 'string') {
      // Extract resource group ID from URL
      const urlMatch = responseData.match(/\/resourceGroup\/(\d+)$/);
      if (urlMatch) {
        return {
          id: urlMatch[1],
          name: resourceGroupData.name,
          self: responseData,
        };
      }
      
      // Try parsing as XML if it's not a URL
      if (responseData.trim().startsWith('<')) {
        const parsed = await parseStringPromise(responseData, { explicitArray: false });
        const resourceGroup = parsed.ResourceGroup || parsed.resourceGroup || {};
        return {
          id: resourceGroup.resourceGroupId || resourceGroup.id,
          name: resourceGroup.name,
          self: resourceGroup.self,
        };
      }
    }
    
    return responseData;
  }

  private async updateResourceGroupMapping(resourceGroupDbId: string, targetResourceGroupId: string, targetConnectionId: string): Promise<void> {
    
    await storage.updateResourceGroup(resourceGroupDbId, {
      targetResourceGroupId: targetResourceGroupId,
      targetConnectionId: targetConnectionId,
    });
    
    console.log(`Updated resource group mapping: DB ID ${resourceGroupDbId} -> Target ID ${targetResourceGroupId} on connection ${targetConnectionId}`);
  }

  private async createBackup(): Promise<void> {
    console.log('Creating backup of target UCCX configuration...');
    // Implementation would depend on specific UCCX backup API
    // This is a placeholder for the backup functionality
    await this.client.post('/appadmin/backup', {
      name: `Migration_Backup_${new Date().toISOString()}`,
      description: 'Backup created before migration',
    });
  }
}

import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXML = promisify(parseString) as (xml: string, options?: any) => Promise<any>;

export interface UccxConfig {
  skills?: Skill[];
  resourceGroups?: ResourceGroup[];
  agents?: Agent[];
  csqs?: CSQ[];
  resources?: any[];
  teams?: any[];
  applications?: Application[];
  triggers?: any[];
  devices?: Device[];
  metadata?: {
    version?: string;
    exportDate?: string;
    source?: string;
  };
}

export interface ResourceGroup {
  id: string;
  name: string;
  self?: string;
}

export interface Agent {
  id: string;
  name: string;
  extension?: string;
  skills?: Skill[];
  teams?: string[];
  enabled: boolean;
  settings?: Record<string, any>;
}

export interface CSQ {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  settings?: Record<string, any>;
}

export interface Application {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  script?: string;
  parameters?: Record<string, any>;
}

export interface Device {
  id: string;
  name: string;
  type: string;
  description?: string;
  enabled: boolean;
  settings?: Record<string, any>;
}

export interface Skill {
  id: string;
  name: string;
  competence?: number;
}

export class XmlParserService {
  async parseUccxConfiguration(xmlContent: string): Promise<UccxConfig> {
    try {
      const parsed = await parseXML(xmlContent, {
        explicitArray: false,
        ignoreAttrs: false,
        mergeAttrs: true,
      });

      const config: UccxConfig = {
        metadata: this.extractMetadata(parsed),
        agents: this.extractAgents(parsed),
        csqs: this.extractCSQs(parsed),
        applications: this.extractApplications(parsed),
        devices: this.extractDevices(parsed),
      };
      


      return config;
    } catch (error) {
      console.error('XML Parsing error details:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      throw new Error(`Failed to parse XML configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractMetadata(parsed: any): UccxConfig['metadata'] {
    const root = parsed.uccx_configuration || parsed.configuration || parsed;
    
    return {
      version: root?.$ ? root.$.version : root?.version || '12.0',
      exportDate: root?.$ ? root.$.export_date : root?.export_date || new Date().toISOString(),
      source: root?.$ ? root.$.source : root?.source || 'Unknown',
    };
  }

  private extractAgents(parsed: any): Agent[] {
    const root = parsed.uccx_configuration || parsed.configuration || parsed;
    const agentsNode = root.agents || root.Agents;
    
    if (!agentsNode || !agentsNode.agent) {
      return [];
    }

    const agentList = Array.isArray(agentsNode.agent) ? agentsNode.agent : [agentsNode.agent];
    
    return agentList.map((agent: any) => {
      const attrs = agent?.$ || {};
      return {
        id: attrs.id || agent?.id || 'unknown',
        name: attrs.name || agent?.name || 'Unknown Agent', 
        extension: attrs.extension || agent?.extension,
        enabled: this.parseBoolean(attrs.enabled || agent?.enabled || true),
        skills: this.extractSkills(agent?.skills || agent?.Skills),
        teams: this.extractTeams(agent?.teams || agent?.Teams),
        settings: this.extractSettings(agent?.settings || agent?.Settings),
      };
    });
  }

  private extractCSQs(parsed: any): CSQ[] {
    const root = parsed.uccx_configuration || parsed.configuration || parsed;
    const csqsNode = root.csqs || root.CSQs || root.contact_service_queues;
    
    if (!csqsNode || !csqsNode.csq) {
      return [];
    }

    const csqList = Array.isArray(csqsNode.csq) ? csqsNode.csq : [csqsNode.csq];
    
    return csqList.map((csq: any) => {
      const attrs = csq?.$ || {};
      return {
        id: attrs.id || csq?.id || 'unknown',
        name: attrs.name || csq?.name || 'Unknown CSQ',
        description: attrs.description || csq?.description || '',
        enabled: this.parseBoolean(attrs.enabled || csq?.enabled || true),
        settings: this.extractSettings(csq?.settings || csq?.Settings),
      };
    });
  }

  private extractApplications(parsed: any): Application[] {
    const root = parsed.uccx_configuration || parsed.configuration || parsed;
    const appsNode = root.applications || root.Applications;
    
    if (!appsNode || !appsNode.application) {
      return [];
    }

    const appList = Array.isArray(appsNode.application) ? appsNode.application : [appsNode.application];
    
    return appList.map((app: any) => {
      const attrs = app?.$ || {};
      return {
        id: attrs.id || app?.id || 'unknown',
        name: attrs.name || app?.name || 'Unknown Application',
        description: attrs.description || app?.description || '',
        enabled: this.parseBoolean(attrs.enabled || app?.enabled || true),
        script: app?.script || app?.Script || '',
        parameters: this.extractParameters(app?.parameters || app?.Parameters),
      };
    });
  }

  private extractDevices(parsed: any): Device[] {
    const root = parsed.uccx_configuration || parsed.configuration || parsed;
    const devicesNode = root.devices || root.Devices;
    
    if (!devicesNode || !devicesNode.device) {
      return [];
    }

    const deviceList = Array.isArray(devicesNode.device) ? devicesNode.device : [devicesNode.device];
    
    return deviceList.map((device: any) => {
      const attrs = device?.$ || {};
      return {
        id: attrs.id || device?.id || 'unknown',
        name: attrs.name || device?.name || 'Unknown Device',
        type: attrs.type || device?.type || 'unknown',
        description: attrs.description || device?.description,
        enabled: this.parseBoolean(attrs.enabled || device?.enabled || true),
        settings: this.extractSettings(device?.settings || device?.Settings),
      };
    });
  }

  private extractSkills(skillsNode: any): Skill[] {
    if (!skillsNode || !skillsNode.skill) {
      return [];
    }

    const skillList = Array.isArray(skillsNode.skill) ? skillsNode.skill : [skillsNode.skill];
    
    return skillList.map((skill: any) => {
      const attrs = skill?.$ || {};
      return {
        id: attrs.id || skill?.id || 'unknown',
        name: attrs.name || skill?.name || 'Unknown Skill',
        competence: parseInt(attrs.competence || skill?.competence || '0') || 0,
      };
    });
  }

  private extractTeams(teamsNode: any): string[] {
    if (!teamsNode || !teamsNode.team) {
      return [];
    }

    const teamList = Array.isArray(teamsNode.team) ? teamsNode.team : [teamsNode.team];
    return teamList.map((team: any) => {
      const attrs = team?.$ || {};
      return attrs.name || team?.name || team || 'Unknown Team';
    });
  }

  private extractSettings(settingsNode: any): Record<string, any> {
    if (!settingsNode) {
      return {};
    }

    const settings: Record<string, any> = {};
    
    // Handle structured settings like <setting name="key">value</setting>
    if (settingsNode.setting) {
      const settingList = Array.isArray(settingsNode.setting) ? settingsNode.setting : [settingsNode.setting];
      
      settingList.forEach((setting: any) => {
        const key = setting?.$ ? setting.$.name : setting?.name;
        const value = setting?.$ ? setting.$.value : setting?.value || setting?._ || setting;
        if (key) {
          settings[key] = value;
        }
      });
    }
    
    // Handle direct XML element settings like <max_wait_time>300</max_wait_time>
    Object.keys(settingsNode).forEach((key) => {
      if (key !== 'setting' && key !== '$') {
        const value = settingsNode[key];
        if (typeof value === 'string' || typeof value === 'number') {
          settings[key] = value;
        } else if (value && typeof value === 'object' && value._) {
          // Handle cases where the value is wrapped in an object with underscore
          settings[key] = value._;
        }
      }
    });

    return settings;
  }

  private extractParameters(parametersNode: any): Record<string, any> {
    if (!parametersNode) {
      return {};
    }

    const parameters: Record<string, any> = {};
    
    if (parametersNode.parameter) {
      const paramList = Array.isArray(parametersNode.parameter) ? parametersNode.parameter : [parametersNode.parameter];
      
      paramList.forEach((param: any) => {
        const key = param.name || param.$.name;
        const value = param.value || param.$.value;
        if (key) {
          parameters[key] = value;
        }
      });
    }

    return parameters;
  }

  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
    }
    
    return !!value;
  }

  detectConfigurationType(config: UccxConfig): 'full_system' | 'agents' | 'csqs' | 'applications' | 'devices' {
    const hasAgents = config.agents && config.agents.length > 0;
    const hasCSQs = config.csqs && config.csqs.length > 0;
    const hasApplications = config.applications && config.applications.length > 0;
    const hasDevices = config.devices && config.devices.length > 0;

    // Count how many different types of components are present
    const componentCount = [hasAgents, hasCSQs, hasApplications, hasDevices].filter(Boolean).length;

    // If multiple types or no specific type dominates, consider it full_system
    if (componentCount > 1) {
      return 'full_system';
    }

    // Single type configurations
    if (hasAgents && !hasCSQs && !hasApplications && !hasDevices) {
      return 'agents';
    }
    if (hasCSQs && !hasAgents && !hasApplications && !hasDevices) {
      return 'csqs';
    }
    if (hasApplications && !hasAgents && !hasCSQs && !hasDevices) {
      return 'applications';
    }
    if (hasDevices && !hasAgents && !hasCSQs && !hasApplications) {
      return 'devices';
    }

    // Default to full_system
    return 'full_system';
  }

  validateConfiguration(config: UccxConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate agents
    if (config.agents) {
      config.agents.forEach((agent, index) => {
        if (!agent.id) {
          errors.push(`Agent at index ${index} is missing required ID`);
        }
        if (!agent.name) {
          errors.push(`Agent at index ${index} is missing required name`);
        }
      });
    }

    // Validate CSQs
    if (config.csqs) {
      config.csqs.forEach((csq, index) => {
        if (!csq.id) {
          errors.push(`CSQ at index ${index} is missing required ID`);
        }
        if (!csq.name) {
          errors.push(`CSQ at index ${index} is missing required name`);
        }
      });
    }

    // Validate applications
    if (config.applications) {
      config.applications.forEach((app, index) => {
        if (!app.id) {
          errors.push(`Application at index ${index} is missing required ID`);
        }
        if (!app.name) {
          errors.push(`Application at index ${index} is missing required name`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export const xmlParserService = new XmlParserService();

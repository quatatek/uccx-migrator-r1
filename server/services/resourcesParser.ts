import { parseString as parseXML } from 'xml2js';
import { promisify } from 'util';
import type { InsertResource, InsertResourceSkill } from '@shared/schema';

const parseXMLAsync = promisify(parseXML);

export interface ParsedResourceData {
  resource: InsertResource;
  skills: InsertResourceSkill[];
}

export class ResourcesParserService {
  // Helper to get text value from xml2js parsed data (handles arrays)
  private getText(value: any): string | null {
    if (value === undefined || value === null) return null;
    if (Array.isArray(value)) {
      return value[0] || null;
    }
    return String(value);
  }

  async parseResourcesXml(xmlContent: string): Promise<ParsedResourceData[]> {
    try {
      const parsed = await parseXMLAsync(xmlContent);

      console.log('Parsed Resources XML structure:', JSON.stringify(parsed, null, 2));

      const resources = this.extractResources(parsed);
      return resources;
    } catch (error) {
      console.error('Resources XML Parsing error details:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      throw new Error(`Failed to parse resources XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractResources(parsed: any): ParsedResourceData[] {
    const root = parsed.resources || parsed.Resources || parsed;
    let resourcesNode = root.resource || root.Resource;
    
    // Handle case where resource is directly at root level (UCCX API single resource response)
    if (!resourcesNode && parsed.resource) {
      resourcesNode = parsed.resource;
    } else if (!resourcesNode && parsed.userID) {
      // If the root itself is a resource
      resourcesNode = parsed;
    }
    
    if (!resourcesNode) {
      return [];
    }

    const resourceList = Array.isArray(resourcesNode) ? resourcesNode : [resourcesNode];
    
    return resourceList.map((resource: any) => {
      const attrs = resource?.$ || {};
      
      // Extract userID (primary identifier) - handle xml2js array format
      const userID = this.getText(resource?.userID) || attrs.userID || 'unknown';
      
      // Extract team ID from team refURL
      let teamId = null;
      const teamNode = Array.isArray(resource?.team) ? resource.team[0] : resource?.team;
      if (teamNode) {
        const teamRefURL = this.getText(teamNode?.refURL);
        const teamAttrs = teamNode?.$ || {};
        const teamMatch = (teamRefURL || '').match(/\/team\/(\d+)$/);
        if (teamMatch) {
          teamId = teamMatch[1];
        }
      }
      
      // Extract resource group ID from resourceGroup refURL
      let resourceGroupId = null;
      const rgNode = Array.isArray(resource?.resourceGroup) ? resource.resourceGroup[0] : resource?.resourceGroup;
      if (rgNode) {
        const rgRefURL = this.getText(rgNode?.refURL);
        const rgMatch = (rgRefURL || '').match(/\/resourceGroup\/(\d+)$/);
        if (rgMatch) {
          resourceGroupId = rgMatch[1];
        }
      }
      
      // Extract self URL
      const self = this.getText(resource?.self) || attrs.self || null;
      
      // Parse autoAvailable as boolean
      let autoAvailable = true;
      const autoAvailableText = this.getText(resource?.autoAvailable);
      if (autoAvailableText !== null) {
        autoAvailable = autoAvailableText === 'true';
      }
      
      // Parse type as integer
      let type = 1;
      const typeText = this.getText(resource?.type);
      if (typeText !== null) {
        type = parseInt(typeText) || 1;
      }
      
      const resourceData: InsertResource = {
        userID,
        firstName: this.getText(resource?.firstName) || null,
        lastName: this.getText(resource?.lastName) || null,
        extension: this.getText(resource?.extension) || null,
        alias: this.getText(resource?.alias) || null,
        autoAvailable,
        type,
        teamId,
        resourceGroupId,
        sourceConnectionId: null,
        targetUserID: null,
        targetConnectionId: null,
        isActive: true,
        metadata: {
          originalData: resource,
          rawXml: resource,
          self,
          importSource: 'xml_file'
        }
      };

      // Extract skills from skillMap
      const skills = this.extractSkillsFromResource(resource, userID);

      return {
        resource: resourceData,
        skills
      };
    });
  }

  private extractSkillsFromResource(resource: any, resourceId: string): InsertResourceSkill[] {
    const skills: InsertResourceSkill[] = [];

    try {
      // Extract skills from skillMap/skillCompetency structure
      const skillMapNode = Array.isArray(resource?.skillMap) ? resource.skillMap[0] : resource?.skillMap;
      if (skillMapNode?.skillCompetency) {
        const competencies = Array.isArray(skillMapNode.skillCompetency) 
          ? skillMapNode.skillCompetency 
          : [skillMapNode.skillCompetency];

        competencies.forEach((competency: any) => {
          const skillNameUriPairNode = Array.isArray(competency?.skillNameUriPair) 
            ? competency.skillNameUriPair[0] 
            : competency?.skillNameUriPair;
            
          if (skillNameUriPairNode) {
            const refURL = this.getText(skillNameUriPairNode?.refURL);
            
            // Extract skill ID from refURL (e.g., /adminapi/skill/37 -> 37)
            let skillId = 'unknown';
            if (refURL) {
              const match = refURL.match(/\/[Ss]kill\/(\d+)$/);
              if (match) {
                skillId = match[1];
              }
            }

            const competencyLevelText = this.getText(competency?.competencelevel);
            const competencyLevel = competencyLevelText 
              ? parseInt(competencyLevelText) 
              : 5;

            skills.push({
              resourceId, // This will be updated with actual DB ID after insertion
              skillId,
              competencyLevel
            });
          }
        });
      }

    } catch (error) {
      console.error(`Error extracting skills for resource ${resourceId}:`, error);
    }

    return skills;
  }

  validateResources(resources: ParsedResourceData[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (resources.length === 0) {
      errors.push('No valid resources found in XML');
    }

    const userIDs = new Set<string>();
    resources.forEach((item, index) => {
      const resource = item.resource;
      
      if (!resource.userID || resource.userID.trim() === '') {
        errors.push(`Resource at index ${index} has empty userID`);
      }
      
      if (userIDs.has(resource.userID)) {
        errors.push(`Duplicate userID found: ${resource.userID}`);
      } else {
        userIDs.add(resource.userID);
      }
      
      // Validate skill references
      item.skills.forEach((skill, skillIndex) => {
        if (!skill.skillId || skill.skillId === 'unknown') {
          errors.push(`Resource ${resource.userID} has invalid skill at index ${skillIndex}`);
        }
        if (skill.competencyLevel < 1 || skill.competencyLevel > 10) {
          errors.push(`Resource ${resource.userID} has invalid competency level ${skill.competencyLevel} for skill ${skill.skillId}`);
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  prepareResourcesForDatabase(
    resources: ParsedResourceData[], 
    sourceConnectionId?: string
  ): ParsedResourceData[] {
    return resources.map((item) => ({
      resource: {
        ...item.resource,
        sourceConnectionId: sourceConnectionId || null,
      },
      skills: item.skills
    }));
  }
}

export const resourcesParserService = new ResourcesParserService();

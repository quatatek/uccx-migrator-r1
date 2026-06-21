import { parseString as parseXML } from 'xml2js';
import { promisify } from 'util';
import type { InsertTeam, InsertTeamResource } from '@shared/schema';

const parseXMLAsync = promisify(parseXML);

export interface ParsedTeamData {
  team: InsertTeam;
  teamResources: InsertTeamResource[];
}

export class TeamsParserService {
  // Helper to get text value from xml2js parsed data (handles arrays)
  private getText(value: any): string | null {
    if (value === undefined || value === null) return null;
    if (Array.isArray(value)) {
      return value[0] || null;
    }
    return String(value);
  }

  async parseTeamsXml(xmlContent: string): Promise<ParsedTeamData[]> {
    try {
      const parsed = await parseXMLAsync(xmlContent);

      console.log('Parsed Teams XML structure:', JSON.stringify(parsed, null, 2));

      const teams = this.extractTeams(parsed);
      return teams;
    } catch (error) {
      console.error('Teams XML Parsing error details:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      throw new Error(`Failed to parse teams XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractTeams(parsed: any): ParsedTeamData[] {
    const root = parsed.teams || parsed.Teams || parsed;
    let teamsNode = root.team || root.Team;
    
    // Handle case where team is directly at root level (UCCX API single team response)
    if (!teamsNode && parsed.team) {
      teamsNode = parsed.team;
    } else if (!teamsNode && parsed.teamId) {
      // If the root itself is a team
      teamsNode = parsed;
    }
    
    if (!teamsNode) {
      return [];
    }

    const teamList = Array.isArray(teamsNode) ? teamsNode : [teamsNode];
    
    return teamList.map((team: any) => {
      const attrs = team?.$ || {};
      
      // Extract teamId (primary identifier) - handle xml2js array format
      const teamId = this.getText(team?.teamId) || attrs.teamId || 'unknown';
      
      // Extract primary supervisor userID from primarySupervisor refURL
      let primarySupervisorUserID = null;
      const primarySupervisorNode = Array.isArray(team?.primarySupervisor) 
        ? team.primarySupervisor[0] 
        : team?.primarySupervisor;
        
      if (primarySupervisorNode) {
        const refURL = this.getText(primarySupervisorNode?.refURL);
        if (refURL) {
          // Extract userID from refURL (e.g., https://uccx/adminapi/resource/rgrant -> rgrant)
          const supervisorMatch = refURL.match(/\/resource\/([^\/]+)$/);
          if (supervisorMatch) {
            primarySupervisorUserID = supervisorMatch[1];
          }
        }
      }
      
      // Extract self URL
      const self = this.getText(team?.self) || attrs.self || null;
      
      const teamData: InsertTeam = {
        teamId,
        teamname: this.getText(team?.teamname) || attrs.teamname || 'Unknown Team',
        primarySupervisorUserID,
        sourceConnectionId: null,
        targetTeamId: null,
        targetConnectionId: null,
        isActive: true,
        metadata: {
          originalData: team,
          self,
          importSource: 'xml_file'
        }
      };

      // Extract team resources (members) - Note: In UCCX exports, team members are in the resources file
      // This extracts secondary supervisors or explicitly listed resources if present
      const teamResources = this.extractTeamResources(team, teamId);

      return {
        team: teamData,
        teamResources
      };
    });
  }

  private extractTeamResources(team: any, teamId: string): InsertTeamResource[] {
    const teamResources: InsertTeamResource[] = [];

    try {
      // Note: In UCCX exports, team membership is defined in the resources XML file (each resource has a team reference)
      // The teams XML only contains supervisor information
      // However, we can extract secondary supervisors as team resources if present
      
      const secondarySupervisorsNode = Array.isArray(team?.secondarySupervisors) 
        ? team.secondarySupervisors[0] 
        : team?.secondarySupervisors;
        
      if (secondarySupervisorsNode?.secondrySupervisor) {
        const supervisorList = Array.isArray(secondarySupervisorsNode.secondrySupervisor) 
          ? secondarySupervisorsNode.secondrySupervisor 
          : [secondarySupervisorsNode.secondrySupervisor];

        supervisorList.forEach((supervisor: any) => {
          const refURL = this.getText(supervisor?.refURL);
          
          // Extract userID from refURL (e.g., https://uccx/adminapi/resource/9770uu-ccx-cuic -> 9770uu-ccx-cuic)
          if (refURL) {
            const match = refURL.match(/\/resource\/([^\/]+)$/);
            if (match) {
              const resourceUserID = match[1];
              teamResources.push({
                teamId, // This will be updated with actual DB ID after insertion
                resourceUserID
              });
            }
          }
        });
      }

    } catch (error) {
      console.error(`Error extracting team resources for team ${teamId}:`, error);
    }

    return teamResources;
  }

  validateTeams(teams: ParsedTeamData[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (teams.length === 0) {
      errors.push('No valid teams found in XML');
    }

    const teamIds = new Set<string>();
    teams.forEach((item, index) => {
      const team = item.team;
      
      if (!team.teamId || team.teamId.trim() === '') {
        errors.push(`Team at index ${index} has empty teamId`);
      }
      
      if (!team.teamname || team.teamname.trim() === '') {
        errors.push(`Team at index ${index} has empty teamname`);
      }
      
      if (teamIds.has(team.teamId)) {
        errors.push(`Duplicate teamId found: ${team.teamId}`);
      } else {
        teamIds.add(team.teamId);
      }
      
      // Validate team resource references
      item.teamResources.forEach((resource, resourceIndex) => {
        if (!resource.resourceUserID || resource.resourceUserID.trim() === '') {
          errors.push(`Team ${team.teamId} has invalid resource at index ${resourceIndex}`);
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  prepareTeamsForDatabase(
    teams: ParsedTeamData[], 
    sourceConnectionId?: string
  ): ParsedTeamData[] {
    return teams.map((item) => ({
      team: {
        ...item.team,
        sourceConnectionId: sourceConnectionId || null,
      },
      teamResources: item.teamResources
    }));
  }
}

export const teamsParserService = new TeamsParserService();

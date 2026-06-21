import { parseString as parseXML } from 'xml2js';
import { promisify } from 'util';
import type { InsertCSQ, InsertCSQSkill } from '@shared/schema';

const parseXMLAsync = promisify(parseXML) as (xml: string, options?: any) => Promise<any>;

export interface ParsedCSQData {
  csq: InsertCSQ;
  skills: InsertCSQSkill[];
  resourceGroups: any[];
}

export class CSQsParserService {
  async parseCSQsXml(xmlContent: string): Promise<ParsedCSQData[]> {
    try {
      const parsed = await parseXMLAsync(xmlContent, {
        explicitArray: false,
        ignoreAttrs: false,
        mergeAttrs: true,
      });

      console.log('Parsed CSQs XML structure:', JSON.stringify(parsed, null, 2));

      const csqs = this.extractCSQs(parsed, xmlContent);
      return csqs;
    } catch (error) {
      console.error('CSQs XML Parsing error details:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      throw new Error(`Failed to parse CSQs XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractCSQs(parsed: any, originalXmlContent: string): ParsedCSQData[] {
    const root = parsed.uccx_configuration || parsed.configuration || parsed;
    let csqsNode = root.csqs || root.CSQs || root.contact_service_queues;
    
    // Handle case where CSQs are directly at root level (UCCX API response)
    if (!csqsNode && root.csq) {
      csqsNode = { csq: root.csq };
    }
    
    if (!csqsNode || !csqsNode.csq) {
      return [];
    }

    const csqList = Array.isArray(csqsNode.csq) ? csqsNode.csq : [csqsNode.csq];
    
    return csqList.map((csq: any, index: number) => {
      const attrs = csq?.$ || {};
      const csqId = attrs.id || csq?.id || 'unknown';
      
      // Extract original XML for this specific CSQ
      const originalXml = this.extractOriginalCSQXml(originalXmlContent, csqId, index);
      
      // Extract all CSQ components
      const csqData: InsertCSQ = {
        csqId,
        name: attrs.name || csq?.name || 'Unknown CSQ',
        description: attrs.description || csq?.description || csq?.Description || '',
        enabled: true,
        // Extract core UCCX components
        queueType: csq?.queueType || csq?.QueueType,
        routingType: csq?.routingType || csq?.RoutingType,
        accountUserId: csq?.accountUserId || csq?.AccountUserId,
        queueAlgorithm: csq?.queueAlgorithm || csq?.QueueAlgorithm,
        resourcePoolType: csq?.resourcePoolType || csq?.ResourcePoolType,
        autoWork: csq?.autoWork === 'true' || csq?.autoWork === true,
        wrapupTime: csq?.wrapupTime ? parseInt(csq.wrapupTime) : undefined,
        serviceLevel: csq?.serviceLevel ? parseInt(csq.serviceLevel) : undefined,
        serviceLevelPercentage: csq?.serviceLevelPercentage ? parseInt(csq.serviceLevelPercentage) : undefined,
        // Extract email-specific fields (for EMAIL queue type)
        emailAuthType: csq?.emailAuthType || csq?.EmailAuthType,
        accountPassword: csq?.accountPassword || csq?.AccountPassword,
        channelProviderName: csq?.channelProvider?.name,
        channelProviderRefURL: csq?.channelProvider?.refURL,
        pollingInterval: csq?.pollingInterval ? parseInt(csq.pollingInterval) : undefined,
        folderName: csq?.folderName || csq?.FolderName,
        snapshotAge: csq?.snapshotAge ? parseInt(csq.snapshotAge) : undefined,
        settings: {},
        sourceConnectionId: null,
        isActive: true,
        metadata: {
          originalData: {
            csqId,
            name: attrs.name || csq?.name || 'Unknown CSQ',
            description: attrs.description || csq?.description || csq?.Description || '',
            enabled: true,
            settings: {},
            originalXml
          },
          originalXml,
          importSource: 'xml_file'
        }
      };

      // Extract skills or resource groups from poolSpecificInfo structure based on resourcePoolType
      const skills = this.extractSkillsFromCSQ(csq, csqId);
      const resourceGroups = this.extractResourceGroupsFromCSQ(csq, csqId);

      return {
        csq: csqData,
        skills,
        resourceGroups
      };
    });
  }

  private extractResourceGroupsFromCSQ(csq: any, csqId: string): any[] {
    const resourceGroups: any[] = [];

    try {
      // Extract resource groups from poolSpecificInfo/resourceGroup structure
      const poolSpecificInfo = csq?.poolSpecificInfo || csq?.PoolSpecificInfo;
      if (poolSpecificInfo?.resourceGroup?.resourceGroupNameUriPair) {
        const rgPair = poolSpecificInfo.resourceGroup.resourceGroupNameUriPair;
        const refURL = rgPair?.refURL;
        
        // Extract resource group ID from refURL (e.g., /adminapi/resourceGroup/7 -> 7)
        if (refURL) {
          const match = refURL.match(/\/resourceGroup\/(\d+)$/);
          if (match) {
            resourceGroups.push({
              csqId,
              resourceGroupId: match[1]
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error extracting resource groups for CSQ ${csqId}:`, error);
    }

    return resourceGroups;
  }

  private extractSkillsFromCSQ(csq: any, csqId: string): InsertCSQSkill[] {
    const skills: InsertCSQSkill[] = [];

    try {
      // Extract skills from poolSpecificInfo/skillGroup/skillCompetency structure
      const poolSpecificInfo = csq?.poolSpecificInfo || csq?.PoolSpecificInfo;
      if (poolSpecificInfo?.skillGroup?.skillCompetency) {
        const competencies = Array.isArray(poolSpecificInfo.skillGroup.skillCompetency) 
          ? poolSpecificInfo.skillGroup.skillCompetency 
          : [poolSpecificInfo.skillGroup.skillCompetency];

        competencies.forEach((competency: any) => {
          const skillNameUriPair = competency?.skillNameUriPair;
          if (skillNameUriPair) {
            const skillName = skillNameUriPair?.name || skillNameUriPair?.$?.name;
            const refURL = skillNameUriPair?.refURL;
            
            // Extract skill ID from refURL (e.g., /adminapi/skill/2 -> 2)
            let skillId = 'unknown';
            if (refURL) {
              const match = refURL.match(/\/skill\/(\d+)$/);
              if (match) {
                skillId = match[1];
              }
            }

            skills.push({
              csqId,
              skillId,
              competencyLevel: competency?.competencelevel ? parseInt(competency.competencelevel) : 5,
              weight: competency?.weight ? parseInt(competency.weight) : 1
            });
          }
        });
      }

      // Also check for legacy skills format
      if (csq?.skills) {
        const skillsList = Array.isArray(csq.skills) ? csq.skills : [csq.skills];
        skillsList.forEach((skill: any) => {
          skills.push({
            csqId,
            skillId: skill?.skillId || skill?.id || 'unknown',
            competencyLevel: skill?.competencyLevel || skill?.level || 5,
            weight: skill?.weight || 1
          });
        });
      }

    } catch (error) {
      console.error(`Error extracting skills for CSQ ${csqId}:`, error);
    }

    return skills;
  }

  private extractOriginalCSQXml(originalXmlContent: string, csqId: string, index: number): string {
    try {
      // Try to extract the specific CSQ XML block
      const csqRegex = new RegExp(`<csq[^>]*>.*?<\/csq>`, 'gs');
      const matches = originalXmlContent.match(csqRegex);
      
      if (matches && matches[index]) {
        return matches[index];
      }
      
      // Fallback: try to find CSQ by ID
      const idRegex = new RegExp(`<csq[^>]*>.*?<id>${csqId}<\/id>.*?<\/csq>`, 'gs');
      const idMatch = originalXmlContent.match(idRegex);
      
      if (idMatch && idMatch[0]) {
        return idMatch[0];
      }
      
      // Last fallback: return the whole content if single CSQ
      if (originalXmlContent.includes('<csq>') && !originalXmlContent.includes('<csqs>')) {
        return originalXmlContent;
      }
      
      return `<csq><id>${csqId}</id><name>Original XML not available</name></csq>`;
    } catch (error) {
      console.error('Error extracting original CSQ XML:', error);
      return `<csq><id>${csqId}</id><name>Original XML extraction failed</name></csq>`;
    }
  }

  // Method to generate updated XML with current skill/resource group names
  generateUpdatedXml(originalXml: string, currentSkills: any[], currentResourceGroups: any[]): string {
    try {
      // Parse the original XML
      const parser = new DOMParser();
      const doc = parser.parseFromString(originalXml, 'text/xml');
      
      // Update skill names in skillNameUriPair elements
      const skillNameUriPairs = doc.querySelectorAll('skillNameUriPair');
      skillNameUriPairs.forEach(pair => {
        const refURL = pair.querySelector('refURL')?.textContent;
        if (refURL) {
          const match = refURL.match(/\/skill\/(\d+)$/);
          if (match) {
            const skillId = match[1];
            const currentSkill = currentSkills.find(s => s.skillId === skillId);
            if (currentSkill) {
              pair.setAttribute('name', currentSkill.skillName);
            }
          }
        }
      });

      // Serialize back to XML string
      const serializer = new XMLSerializer();
      return serializer.serializeToString(doc);
    } catch (error) {
      console.error('Error generating updated XML:', error);
      return originalXml; // Return original if update fails
    }
  }
}

export const csqsParserService = new CSQsParserService();
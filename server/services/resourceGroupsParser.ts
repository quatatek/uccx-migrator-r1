import { parseStringPromise } from 'xml2js';
import type { InsertResourceGroup } from '@shared/schema';

interface ResourceGroupXmlData {
  resourceGroups?: {
    resourceGroup?: Array<{
      id?: [string];
      name?: [string];
      self?: [string];
    }>;
  };
}

export class ResourceGroupsParser {
  static async parseXml(xmlContent: string): Promise<InsertResourceGroup[]> {
    try {
      const parsed: ResourceGroupXmlData = await parseStringPromise(xmlContent, {
        explicitArray: true,
        mergeAttrs: false,
        normalize: true,
        normalizeTags: true,
        trim: true
      });

      const resourceGroups: InsertResourceGroup[] = [];

      if (parsed.resourcegroups?.resourcegroup) {
        for (const rg of parsed.resourcegroups.resourcegroup) {
          if (rg.id?.[0] && rg.name?.[0]) {
            resourceGroups.push({
              resourceGroupId: parseInt(rg.id[0]),
              name: rg.name[0],
              self: rg.self?.[0] || null,
              sourceConnectionId: null,
              isActive: true,
              metadata: {
                originalData: rg,
                importedFrom: 'xml'
              }
            });
          }
        }
      } else if (parsed.resourceGroups?.resourceGroup) {
        for (const rg of parsed.resourceGroups.resourceGroup) {
          if (rg.id?.[0] && rg.name?.[0]) {
            resourceGroups.push({
              resourceGroupId: parseInt(rg.id[0]),
              name: rg.name[0],
              self: rg.self?.[0] || null,
              sourceConnectionId: null,
              isActive: true,
              metadata: {
                originalData: rg,
                importedFrom: 'xml'
              }
            });
          }
        }
      }

      return resourceGroups;
    } catch (error) {
      console.error('Error parsing resource groups XML:', error);
      throw new Error(`Failed to parse resource groups XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static detectResourceGroupsXml(xmlContent: string): boolean {
    return xmlContent.includes('<resourceGroups>') || xmlContent.includes('<resourceGroup>');
  }
}
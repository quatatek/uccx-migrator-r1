import { parseString as parseXML } from 'xml2js';
import { promisify } from 'util';
import type { InsertTrigger } from '@shared/schema';

const parseXMLAsync = promisify(parseXML);

export interface ParsedTriggerData {
  trigger: InsertTrigger;
}

export class TriggersParserService {
  // Helper to get text value from xml2js parsed data (handles arrays)
  private getText(value: any): string | null {
    if (value === undefined || value === null) return null;
    if (Array.isArray(value)) {
      return value[0] || null;
    }
    return String(value);
  }

  // Helper to get number value from xml2js parsed data (handles arrays)
  private getNumber(value: any): number | null {
    const text = this.getText(value);
    if (!text) return null;
    const num = parseInt(text, 10);
    return isNaN(num) ? null : num;
  }

  // Helper to get boolean value from xml2js parsed data (handles arrays)
  private getBoolean(value: any): boolean {
    const text = this.getText(value);
    return text === 'true';
  }

  async parseTriggersXml(xmlContent: string): Promise<ParsedTriggerData[]> {
    try {
      const parsed = await parseXMLAsync(xmlContent);

      console.log('Parsed Triggers XML structure:', JSON.stringify(parsed, null, 2));

      const triggers = this.extractTriggers(parsed);
      return triggers;
    } catch (error) {
      console.error('Triggers XML Parsing error details:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      throw new Error(`Failed to parse triggers XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractTriggers(parsed: any): ParsedTriggerData[] {
    const root = parsed.triggers || parsed.Triggers || parsed;
    let triggersNode = root.trigger || root.Trigger;
    
    // Handle case where trigger is directly at root level (UCCX API single trigger response)
    if (!triggersNode && parsed.trigger) {
      triggersNode = parsed.trigger;
    } else if (!triggersNode && parsed.directoryNumber) {
      // If the root itself is a trigger
      triggersNode = parsed;
    }
    
    if (!triggersNode) {
      return [];
    }

    const triggerList = Array.isArray(triggersNode) ? triggersNode : [triggersNode];
    
    return triggerList.map((trig: any) => {
      const attrs = trig?.$ || {};
      
      // Extract directory number (primary identifier)
      const directoryNumber = this.getText(trig?.directoryNumber) || attrs.directoryNumber || 'unknown';
      
      // Extract application reference
      let applicationName = null;
      const applicationNode = Array.isArray(trig?.application) ? trig.application[0] : trig?.application;
      if (applicationNode) {
        const appAttrs = applicationNode?.$ || {};
        applicationName = this.getText(applicationNode?.name) || appAttrs.name;
      }
      
      // Extract call control group reference
      let callControlGroupName = null;
      let callControlGroupId = null;
      const ccgNode = Array.isArray(trig?.callControlGroup) ? trig.callControlGroup[0] : trig?.callControlGroup;
      if (ccgNode) {
        const ccgAttrs = ccgNode?.$ || {};
        callControlGroupName = this.getText(ccgNode?.name) || ccgAttrs.name;
        // Extract ID from refURL if available
        const refURL = this.getText(ccgNode?.refURL);
        if (refURL) {
          const match = refURL.match(/\/callControlGroup\/(\d+)$/);
          if (match) {
            callControlGroupId = match[1];
          }
        }
      }
      
      // Extract forward busy settings (store in metadata)
      const forwardBusyNode = Array.isArray(trig?.forwardBusy) ? trig.forwardBusy[0] : trig?.forwardBusy;
      const forwardBusySettings = forwardBusyNode ? {
        forwardBusyVoiceMail: this.getBoolean(forwardBusyNode?.forwardBusyVoiceMail),
        forwardBusyDestination: this.getText(forwardBusyNode?.forwardBusyDestination),
        forwardBusyCallingSearchSpace: this.getText(forwardBusyNode?.forwardBusyCallingSearchSpace),
      } : null;
      
      // Extract dialog group (store in metadata)
      const overrideMediaNode = Array.isArray(trig?.overrideMediaTermination) ? trig.overrideMediaTermination[0] : trig?.overrideMediaTermination;
      let dialogGroup = null;
      if (overrideMediaNode) {
        const dialogGroupNode = Array.isArray(overrideMediaNode?.dialogGroup) ? overrideMediaNode.dialogGroup[0] : overrideMediaNode?.dialogGroup;
        if (dialogGroupNode) {
          const dgAttrs = dialogGroupNode?.$ || {};
          dialogGroup = {
            name: this.getText(dialogGroupNode?.name) || dgAttrs.name,
            refURL: this.getText(dialogGroupNode?.refURL),
          };
        }
      }
      
      const trigger: InsertTrigger = {
        directoryNumber,
        locale: this.getText(trig?.locale),
        applicationName,
        deviceName: this.getText(trig?.deviceName),
        description: this.getText(trig?.description),
        callControlGroupName,
        callControlGroupId,
        triggerEnabled: this.getBoolean(trig?.triggerEnabled),
        maxNumOfSessions: this.getNumber(trig?.maxNumOfSessions),
        idleTimeout: this.getNumber(trig?.idleTimeout),
        alertingNameAscii: this.getText(trig?.alertingNameAscii),
        devicePool: this.getText(trig?.devicePool),
        location: this.getText(trig?.location),
        busyTrigger: this.getText(trig?.busyTrigger),
        partition: this.getText(trig?.partition),
        voiceMailProfile: this.getText(trig?.voiceMailProfile),
        callingSearchSpace: this.getText(trig?.callingSearchSpace),
        callingSearchSpaceForRedirect: this.getText(trig?.callingSearchSpaceForRedirect),
        aarGroup: this.getText(trig?.aarGroup),
        presenceGroup: this.getText(trig?.presenceGroup),
        display: this.getText(trig?.display),
        externalPhoneMaskNumber: this.getText(trig?.externalPhoneMaskNumber),
        sourceConnectionId: null,
        targetDirectoryNumber: null,
        targetConnectionId: null,
        isActive: true,
        metadata: {
          self: this.getText(trig?.self),
          forwardBusy: forwardBusySettings,
          dialogGroup,
          originalData: trig,
          rawXml: trig,
        },
      };

      return {
        trigger,
      };
    });
  }

  validateTriggers(triggers: ParsedTriggerData[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const seenDirectoryNumbers = new Set<string>();

    for (const trigData of triggers) {
      const { trigger } = trigData;

      // Check for required fields
      if (!trigger.directoryNumber) {
        errors.push('Directory number is required');
      }

      // Check for duplicate directory numbers
      if (seenDirectoryNumbers.has(trigger.directoryNumber)) {
        errors.push(`Duplicate directory number: ${trigger.directoryNumber}`);
      }
      seenDirectoryNumbers.add(trigger.directoryNumber);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  prepareTriggersForDatabase(
    triggers: ParsedTriggerData[], 
    sourceConnectionId?: string
  ): ParsedTriggerData[] {
    return triggers.map((item) => ({
      trigger: {
        ...item.trigger,
        sourceConnectionId: sourceConnectionId || null,
      },
    }));
  }
}

export const triggersParserService = new TriggersParserService();

import { parseString as parseXML } from 'xml2js';
import { promisify } from 'util';
import type { InsertApplication } from '@shared/schema';

const parseXMLAsync = promisify(parseXML);

export interface ParsedApplicationData {
  application: InsertApplication;
}

export class ApplicationsParserService {
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

  async parseApplicationsXml(xmlContent: string): Promise<ParsedApplicationData[]> {
    try {
      const parsed = await parseXMLAsync(xmlContent);

      console.log('Parsed Applications XML structure:', JSON.stringify(parsed, null, 2));

      const applications = this.extractApplications(parsed);
      return applications;
    } catch (error) {
      console.error('Applications XML Parsing error details:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      throw new Error(`Failed to parse applications XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractApplications(parsed: any): ParsedApplicationData[] {
    const root = parsed.applications || parsed.Applications || parsed;
    let applicationsNode = root.application || root.Application;
    
    // Handle case where application is directly at root level (UCCX API single application response)
    if (!applicationsNode && parsed.application) {
      applicationsNode = parsed.application;
    } else if (!applicationsNode && parsed.applicationName) {
      // If the root itself is an application
      applicationsNode = parsed;
    }
    
    if (!applicationsNode) {
      return [];
    }

    const applicationList = Array.isArray(applicationsNode) ? applicationsNode : [applicationsNode];
    
    return applicationList.map((app: any) => {
      const attrs = app?.$ || {};
      
      // Extract application name (primary identifier)
      const applicationName = this.getText(app?.applicationName) || attrs.applicationName || 'unknown';
      
      // Extract script path from ScriptApplication node
      let script = null;
      let defaultScript = null;
      const scriptAppNode = Array.isArray(app?.ScriptApplication) ? app.ScriptApplication[0] : app?.ScriptApplication;
      if (scriptAppNode) {
        script = this.getText(scriptAppNode?.script);
        defaultScript = this.getText(scriptAppNode?.defaultScript);
      }
      
      // Extract other fields
      const applicationId = this.getText(app?.id);
      const type = this.getText(app?.type);
      const description = this.getText(app?.description);
      const maxsession = this.getNumber(app?.maxsession);
      const enabled = this.getBoolean(app?.enabled);

      const application: InsertApplication = {
        applicationName,
        script,
        defaultScript,
        applicationId,
        type,
        description,
        maxsession,
        enabled,
        sourceConnectionId: null,
        targetApplicationName: null,
        targetConnectionId: null,
        isActive: true,
        metadata: {
          self: this.getText(app?.self),
          originalData: app,
          rawXml: app,
        },
      };

      return {
        application,
      };
    });
  }

  validateApplications(applications: ParsedApplicationData[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const seenNames = new Set<string>();

    for (const appData of applications) {
      const { application } = appData;

      // Check for required fields
      if (!application.applicationName) {
        errors.push('Application name is required');
      }

      // Check for duplicate application names
      if (seenNames.has(application.applicationName)) {
        errors.push(`Duplicate application name: ${application.applicationName}`);
      }
      seenNames.add(application.applicationName);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  prepareApplicationsForDatabase(
    applications: ParsedApplicationData[], 
    sourceConnectionId?: string
  ): ParsedApplicationData[] {
    return applications.map((item) => ({
      application: {
        ...item.application,
        sourceConnectionId: sourceConnectionId || null,
      },
    }));
  }
}

export const applicationsParserService = new ApplicationsParserService();

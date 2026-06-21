import { parseString as parseXML } from 'xml2js';
import { promisify } from 'util';
import type { InsertSkill } from '@shared/schema';

const parseXMLAsync = promisify(parseXML);

export interface SkillData {
  skillId: number;
  skillName: string;
  self?: string;
}

export class SkillsParserService {
  private extractString(value: any): string | null {
    if (!value) return null;
    if (Array.isArray(value)) return String(value[0] ?? '');
    if (typeof value === 'object') return String(value._ ?? value.$?.href ?? '');
    return String(value);
  }

  async parseSkillsXml(xmlContent: string): Promise<SkillData[]> {
    try {
      const parsed = await parseXMLAsync(xmlContent, { explicitArray: false });

      const skills = this.extractSkills(parsed);
      return skills;
    } catch (error) {
      console.error('Skills XML Parsing error details:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
      }
      throw new Error(`Failed to parse skills XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractSkills(parsed: any): SkillData[] {
    const skillsRoot = parsed.skills || parsed.Skills;
    
    if (!skillsRoot || !skillsRoot.skill) {
      return [];
    }

    const skillList = Array.isArray(skillsRoot.skill) ? skillsRoot.skill : [skillsRoot.skill];
    
    return skillList.map((skill: any) => {
      const attrs = skill?.$ || {};
      
      // Handle self element which can be an object with attributes or a string
      let selfHref = null;
      if (skill.self) {
        if (typeof skill.self === 'object' && skill.self.href) {
          selfHref = skill.self.href;
        } else if (typeof skill.self === 'string') {
          selfHref = skill.self;
        }
      }
      
      const skillIdRaw = this.extractString(skill.skillId) || this.extractString(attrs.skillId) || '0';
      const skillNameRaw = this.extractString(skill.skillName) || this.extractString(attrs.skillName) || 'Unknown Skill';
      return {
        skillId: parseInt(skillIdRaw) || 0,
        skillName: skillNameRaw,
        self: selfHref || attrs.self,
      };
    }).filter((skill: SkillData) => skill.skillId > 0); // Filter out invalid skills
  }

  validateSkills(skills: SkillData[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (skills.length === 0) {
      errors.push('No valid skills found in XML');
    }

    const skillIds = new Set<number>();
    skills.forEach((skill, index) => {
      if (!skill.skillName || skill.skillName.trim() === '') {
        errors.push(`Skill at index ${index} has empty name`);
      }
      
      if (skill.skillId <= 0) {
        errors.push(`Skill at index ${index} has invalid skillId: ${skill.skillId}`);
      }
      
      if (skillIds.has(skill.skillId)) {
        errors.push(`Duplicate skillId found: ${skill.skillId}`);
      } else {
        skillIds.add(skill.skillId);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  prepareSkillsForDatabase(skills: SkillData[], sourceConnectionId?: string): InsertSkill[] {
    return skills.map((skill) => ({
      skillId: skill.skillId.toString(),
      skillName: skill.skillName,
      description: null,
      sourceConnectionId: sourceConnectionId || null,
      isActive: true,
      metadata: {
        originalData: skill,
        importSource: 'xml_file',
        apiUrl: skill.self || null,
      },
    }));
  }
}

export const skillsParserService = new SkillsParserService();
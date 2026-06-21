import { Builder } from 'xml2js';

export class XmlConverter {
  private builder: Builder;

  constructor() {
    this.builder = new Builder({
      headless: true,
      renderOpts: { pretty: true, indent: '  ' }
    });
  }

  convertToXml(parsedObject: any, rootElement: string): string {
    try {
      if (!parsedObject) {
        return `<${rootElement}></${rootElement}>`;
      }

      const wrapped = { [rootElement]: parsedObject };
      return this.builder.buildObject(wrapped);
    } catch (error) {
      console.error('Error converting object to XML:', error);
      return `<!-- Error converting to XML: ${error instanceof Error ? error.message : 'Unknown error'} -->`;
    }
  }
}

export const xmlConverter = new XmlConverter();

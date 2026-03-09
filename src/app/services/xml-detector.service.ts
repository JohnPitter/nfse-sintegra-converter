import { Injectable } from '@angular/core';
import * as xml2js from 'xml2js';
import { XmlDocumentType } from '../models';

@Injectable({
  providedIn: 'root',
})
export class XmlDetectorService {
  async detectFromFile(file: File): Promise<{ type: XmlDocumentType; parsed: any }> {
    const xmlContent = await this.readFile(file);
    const parsed = await this.parseXml(xmlContent);
    const type = this.identifyType(parsed);
    return { type, parsed };
  }

  private readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
      reader.readAsText(file);
    });
  }

  private parseXml(xmlString: string): Promise<any> {
    return new Promise((resolve, reject) => {
      xml2js.parseString(
        xmlString,
        {
          explicitArray: false,
          mergeAttrs: true,
          normalize: true,
          normalizeTags: true,
          trim: true,
          tagNameProcessors: [xml2js.processors.stripPrefix],
        },
        (err, result) => {
          if (err) {
            reject(new Error('Erro ao processar XML: ' + err.message));
            return;
          }
          resolve(result);
        }
      );
    });
  }

  private identifyType(parsed: any): XmlDocumentType {
    if (parsed.nfeproc || parsed.nfe) {
      const nfe = parsed.nfeproc?.nfe || parsed.nfe;
      const infNfe = nfe?.infnfe;
      const modelo = infNfe?.ide?.mod;

      if (modelo === '65') return XmlDocumentType.NFCE;
      if (modelo === '55') return XmlDocumentType.NFE;

      return XmlDocumentType.NFE;
    }

    if (parsed.nfse || parsed.nfseproc || parsed.rps || parsed.loterps) {
      return XmlDocumentType.NFSE;
    }

    const rootKeys = Object.keys(parsed).map((k) => k.toLowerCase());
    const nfseIndicators = ['nfse', 'notafiscalservico', 'nfseproc', 'consultarnfse', 'listanfse'];
    if (rootKeys.some((key) => nfseIndicators.some((ind) => key.includes(ind)))) {
      return XmlDocumentType.NFSE;
    }

    return XmlDocumentType.UNKNOWN;
  }
}

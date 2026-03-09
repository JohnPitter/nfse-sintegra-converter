import { Injectable } from '@angular/core';
import * as xml2js from 'xml2js';

export enum XmlType {
  NFE = 'NFE',
  NFCE = 'NFCE',
  NFSE = 'NFSE',
  UNKNOWN = 'UNKNOWN'
}

@Injectable({
  providedIn: 'root'
})
export class XmlDetectorService {

  constructor() { }

  async detectXmlType(file: File): Promise<XmlType> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const xmlContent = e.target?.result as string;
        this.detectXmlTypeFromString(xmlContent)
          .then(resolve)
          .catch(reject);
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  }

  private async detectXmlTypeFromString(xmlString: string): Promise<XmlType> {
    return new Promise((resolve) => {
      xml2js.parseString(xmlString, { 
        explicitArray: false,
        mergeAttrs: true,
        normalize: true,
        normalizeTags: true,
        trim: true
      }, (err, result) => {
        if (err) {
          resolve(XmlType.UNKNOWN);
          return;
        }

        try {
          const xmlType = this.identifyXmlType(result);
          resolve(xmlType);
        } catch (error) {
          resolve(XmlType.UNKNOWN);
        }
      });
    });
  }

  private identifyXmlType(parsedXml: any): XmlType {
    // Check for NFe/NFCe structure
    if (parsedXml.nfeproc || parsedXml.nfe) {
      const nfeElement = parsedXml.nfeproc?.nfe || parsedXml.nfe;
      const infNfe = nfeElement?.infnfe;
      
      if (infNfe?.ide?.mod) {
        const modelo = infNfe.ide.mod;
        if (modelo === '55') {
          return XmlType.NFE;
        } else if (modelo === '65') {
          return XmlType.NFCE;
        }
      }
    }

    // Check for NFSe structure
    if (parsedXml.nfse || parsedXml.nfseproc) {
      return XmlType.NFSE;
    }

    // Check for other common NFSe structures
    if (parsedXml.rps || parsedXml.lote || parsedXml.loterps) {
      return XmlType.NFSE;
    }

    // Check for specific NFSe elements
    if (parsedXml.servico || parsedXml.prestadorservico || parsedXml.tomadorservico) {
      return XmlType.NFSE;
    }

    // Check root element names that might indicate NFSe
    const rootKeys = Object.keys(parsedXml).map(key => key.toLowerCase());
    const nfseIndicators = ['nfse', 'notafiscalservico', 'nfseproc', 'consultarnfse', 'listanfse'];
    
    if (rootKeys.some(key => nfseIndicators.some(indicator => key.includes(indicator)))) {
      return XmlType.NFSE;
    }

    return XmlType.UNKNOWN;
  }
}
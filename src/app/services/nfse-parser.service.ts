import { Injectable } from '@angular/core';
import * as xml2js from 'xml2js';

export interface NFSeData {
  numeroNota: string;
  dataEmissao: string;
  cnpjPrestador: string;
  razaoSocialPrestador: string;
  cnpjTomador: string;
  razaoSocialTomador: string;
  valorServicos: number;
  valorIss: number;
  codigoServico: string;
  descricaoServico: string;
}

@Injectable({
  providedIn: 'root'
})
export class NfseParserService {

  constructor() { }

  async parseXmlFile(file: File): Promise<NFSeData[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const xmlContent = e.target?.result as string;
        this.parseXmlString(xmlContent)
          .then(resolve)
          .catch(reject);
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  }

  private async parseXmlString(xmlString: string): Promise<NFSeData[]> {
    return new Promise((resolve, reject) => {
      xml2js.parseString(xmlString, { 
        explicitArray: false,
        mergeAttrs: true,
        normalize: true,
        normalizeTags: true,
        trim: true
      }, (err, result) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          const nfseData = this.extractNfseData(result);
          resolve(nfseData);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private extractNfseData(parsedXml: any): NFSeData[] {
    const nfseList: NFSeData[] = [];
    
    if (parsedXml.nfse) {
      const nfses = Array.isArray(parsedXml.nfse) ? parsedXml.nfse : [parsedXml.nfse];
      
      nfses.forEach((nfse: any) => {
        const infNfse = nfse.infnfse || nfse.infnfse;
        if (infNfse) {
          const nfseData: NFSeData = {
            numeroNota: infNfse.numero || '',
            dataEmissao: infNfse.dataemissao || '',
            cnpjPrestador: infNfse.prestadorservico?.cnpj || '',
            razaoSocialPrestador: infNfse.prestadorservico?.razaosocial || '',
            cnpjTomador: infNfse.tomadorservico?.cnpj || '',
            razaoSocialTomador: infNfse.tomadorservico?.razaosocial || '',
            valorServicos: parseFloat(infNfse.valorservicos || '0'),
            valorIss: parseFloat(infNfse.valoriss || '0'),
            codigoServico: infNfse.codigoservico || '',
            descricaoServico: infNfse.descricaoservico || ''
          };
          nfseList.push(nfseData);
        }
      });
    }

    return nfseList;
  }
}
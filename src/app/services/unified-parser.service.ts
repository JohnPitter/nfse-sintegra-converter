import { Injectable } from '@angular/core';
import { XmlDetectorService, XmlType } from './xml-detector.service';
import { NfseParserService, NFSeData } from './nfse-parser.service';
import { NfeParserService, NFEData } from './nfe-parser.service';
import { NfceParserService, NFCEData } from './nfce-parser.service';

export type UnifiedData = NFSeData | NFEData | NFCEData;

export interface ParseResult {
  type: XmlType;
  data: UnifiedData[];
}

@Injectable({
  providedIn: 'root'
})
export class UnifiedParserService {

  constructor(
    private xmlDetector: XmlDetectorService,
    private nfseParser: NfseParserService,
    private nfeParser: NfeParserService,
    private nfceParser: NfceParserService
  ) { }

  async parseXmlFile(file: File): Promise<ParseResult> {
    // First detect the XML type
    const xmlType = await this.xmlDetector.detectXmlType(file);
    
    let data: UnifiedData[] = [];

    switch (xmlType) {
      case XmlType.NFE:
        data = await this.nfeParser.parseXmlFile(file);
        break;
      case XmlType.NFCE:
        data = await this.nfceParser.parseXmlFile(file);
        break;
      case XmlType.NFSE:
        data = await this.nfseParser.parseXmlFile(file);
        break;
      default:
        throw new Error(`Tipo de XML não suportado: ${xmlType}. Tipos suportados: NFe, NFCe, NFSe`);
    }

    return {
      type: xmlType,
      data: data
    };
  }

  getXmlTypeName(type: XmlType): string {
    switch (type) {
      case XmlType.NFE:
        return 'Nota Fiscal Eletrônica (NFe)';
      case XmlType.NFCE:
        return 'Nota Fiscal de Consumidor Eletrônica (NFCe)';
      case XmlType.NFSE:
        return 'Nota Fiscal de Serviços Eletrônica (NFSe)';
      default:
        return 'Tipo desconhecido';
    }
  }
}
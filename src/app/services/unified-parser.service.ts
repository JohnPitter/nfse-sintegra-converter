import { Injectable } from '@angular/core';
import { XmlDetectorService } from './xml-detector.service';
import { NfeParserService } from './nfe-parser.service';
import { NfseParserService } from './nfse-parser.service';
import { XmlDocumentType, ParseResult, ParsedDocument } from '../models';

@Injectable({
  providedIn: 'root',
})
export class UnifiedParserService {
  constructor(
    private xmlDetector: XmlDetectorService,
    private nfeParser: NfeParserService,
    private nfseParser: NfseParserService
  ) {}

  async parseFiles(files: File[]): Promise<ParseResult> {
    const allDocuments: ParsedDocument[] = [];
    const allErrors: string[] = [];
    let detectedType = XmlDocumentType.UNKNOWN;

    for (const file of files) {
      try {
        const { type, parsed } = await this.xmlDetector.detectFromFile(file);

        if (detectedType === XmlDocumentType.UNKNOWN) {
          detectedType = type;
        }

        switch (type) {
          case XmlDocumentType.NFE:
          case XmlDocumentType.NFCE: {
            const docs = this.nfeParser.parse(parsed, type);
            allDocuments.push(...docs);
            break;
          }
          case XmlDocumentType.NFSE: {
            const docs = this.nfseParser.parse(parsed);
            allDocuments.push(...docs);
            break;
          }
          default:
            allErrors.push(`Arquivo "${file.name}": tipo XML nao reconhecido`);
        }
      } catch (error) {
        allErrors.push(`Arquivo "${file.name}": ${(error as Error).message}`);
      }
    }

    return {
      type: detectedType,
      documents: allDocuments,
      errors: allErrors,
    };
  }

  getTypeName(type: XmlDocumentType): string {
    switch (type) {
      case XmlDocumentType.NFE:
        return 'Nota Fiscal Eletronica (NFe - Modelo 55)';
      case XmlDocumentType.NFCE:
        return 'Nota Fiscal de Consumidor Eletronica (NFCe - Modelo 65)';
      case XmlDocumentType.NFSE:
        return 'Nota Fiscal de Servicos Eletronica (NFSe)';
      default:
        return 'Tipo desconhecido';
    }
  }
}

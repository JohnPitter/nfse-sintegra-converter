import { Injectable } from '@angular/core';
import * as xml2js from 'xml2js';

export interface NFCEData {
  numeroNota: string;
  serie: string;
  dataEmissao: string;
  cnpjEmitente: string;
  razaoSocialEmitente: string;
  cpfConsumidor?: string;
  nomeConsumidor?: string;
  valorTotalNota: number;
  valorProdutos: number;
  valorIcms: number;
  valorPis: number;
  valorCofins: number;
  valorDesconto: number;
  valorOutros: number;
  cfop: string;
  naturezaOperacao: string;
  codigoMunicipio: string;
  uf: string;
  itens: NFCEItem[];
}

export interface NFCEItem {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  valorDesconto: number;
  valorIcms: number;
  valorPis: number;
  valorCofins: number;
}

@Injectable({
  providedIn: 'root'
})
export class NfceParserService {

  constructor() { }

  async parseXmlFile(file: File): Promise<NFCEData[]> {
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

  private async parseXmlString(xmlString: string): Promise<NFCEData[]> {
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
          const nfceData = this.extractNfceData(result);
          resolve(nfceData);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private extractNfceData(parsedXml: any): NFCEData[] {
    const nfceList: NFCEData[] = [];
    
    // Handle nfeProc (processed NFCe) or NFe directly
    let nfceElement = parsedXml.nfeproc?.nfe || parsedXml.nfe;
    
    if (!nfceElement) {
      throw new Error('Estrutura NFCe não encontrada no XML');
    }

    // Handle array or single element
    const nfces = Array.isArray(nfceElement) ? nfceElement : [nfceElement];
    
    nfces.forEach((nfce: any) => {
      const infNfe = nfce.infnfe;
      if (infNfe) {
        // Verify if it's actually an NFCe (model 65)
        if (infNfe.ide?.mod !== '65') {
          throw new Error('O XML fornecido não é uma NFCe (modelo 65)');
        }

        const nfceData: NFCEData = {
          numeroNota: infNfe.ide?.nnf || '',
          serie: infNfe.ide?.serie || '',
          dataEmissao: infNfe.ide?.dhemi || infNfe.ide?.demi || '',
          cnpjEmitente: infNfe.emit?.cnpj || '',
          razaoSocialEmitente: infNfe.emit?.xnome || '',
          cpfConsumidor: infNfe.dest?.cpf || '',
          nomeConsumidor: infNfe.dest?.xnome || '',
          valorTotalNota: parseFloat(infNfe.total?.icmstot?.vnf || '0'),
          valorProdutos: parseFloat(infNfe.total?.icmstot?.vprod || '0'),
          valorIcms: parseFloat(infNfe.total?.icmstot?.vicms || '0'),
          valorPis: parseFloat(infNfe.total?.icmstot?.vpis || '0'),
          valorCofins: parseFloat(infNfe.total?.icmstot?.vcofins || '0'),
          valorDesconto: parseFloat(infNfe.total?.icmstot?.vdesc || '0'),
          valorOutros: parseFloat(infNfe.total?.icmstot?.voutro || '0'),
          cfop: this.extractMainCfop(infNfe.det),
          naturezaOperacao: infNfe.ide?.natop || '',
          codigoMunicipio: infNfe.ide?.cmunfg || '',
          uf: infNfe.emit?.enderemit?.uf || '',
          itens: this.extractItems(infNfe.det)
        };
        nfceList.push(nfceData);
      }
    });

    return nfceList;
  }

  private extractMainCfop(detalhes: any): string {
    if (!detalhes) return '';
    
    const items = Array.isArray(detalhes) ? detalhes : [detalhes];
    
    // Return the CFOP from the first item
    return items[0]?.prod?.cfop || '';
  }

  private extractItems(detalhes: any): NFCEItem[] {
    if (!detalhes) return [];
    
    const items = Array.isArray(detalhes) ? detalhes : [detalhes];
    
    return items.map((det: any) => ({
      codigo: det.prod?.cprod || '',
      descricao: det.prod?.xprod || '',
      ncm: det.prod?.ncm || '',
      cfop: det.prod?.cfop || '',
      unidade: det.prod?.ucom || '',
      quantidade: parseFloat(det.prod?.qcom || '0'),
      valorUnitario: parseFloat(det.prod?.vuncom || '0'),
      valorTotal: parseFloat(det.prod?.vprod || '0'),
      valorDesconto: parseFloat(det.prod?.vdesc || '0'),
      valorIcms: this.extractIcmsValue(det.imposto),
      valorPis: this.extractPisValue(det.imposto),
      valorCofins: this.extractCofinsValue(det.imposto)
    }));
  }

  private extractIcmsValue(imposto: any): number {
    if (!imposto?.icms) return 0;
    
    const icms = imposto.icms;
    
    // Check various ICMS scenarios (NFCe typically uses Simples Nacional)
    return parseFloat(
      icms.icms00?.vicms || 
      icms.icms10?.vicms || 
      icms.icms20?.vicms || 
      icms.icms30?.vicms || 
      icms.icms40?.vicms || 
      icms.icms51?.vicms || 
      icms.icms60?.vicms || 
      icms.icms70?.vicms || 
      icms.icms90?.vicms ||
      icms.icmssn101?.vicms ||
      icms.icmssn102?.vicms ||
      icms.icmssn103?.vicms ||
      icms.icmssn201?.vicms ||
      icms.icmssn202?.vicms ||
      icms.icmssn203?.vicms ||
      icms.icmssn300?.vicms ||
      icms.icmssn400?.vicms ||
      icms.icmssn500?.vicms ||
      '0'
    );
  }

  private extractPisValue(imposto: any): number {
    if (!imposto?.pis) return 0;
    
    return parseFloat(
      imposto.pis.pisaliq?.vpis || 
      imposto.pis.pisqtde?.vpis || 
      imposto.pis.pisnt?.vpis || 
      imposto.pis.pisoutr?.vpis || 
      '0'
    );
  }

  private extractCofinsValue(imposto: any): number {
    if (!imposto?.cofins) return 0;
    
    return parseFloat(
      imposto.cofins.cofinsaliq?.vcofins || 
      imposto.cofins.cofinsqtde?.vcofins || 
      imposto.cofins.cofinsnt?.vcofins || 
      imposto.cofins.cofinsoutr?.vcofins || 
      '0'
    );
  }
}
import { Injectable } from '@angular/core';
import { XmlDocumentType, NFeDocument, DocumentItem } from '../models';

@Injectable({
  providedIn: 'root',
})
export class NfeParserService {
  parse(parsed: any, tipo: XmlDocumentType.NFE | XmlDocumentType.NFCE): NFeDocument[] {
    const nfeElement = parsed.nfeproc?.nfe || parsed.nfe;
    if (!nfeElement) {
      throw new Error('Estrutura NFe/NFCe nao encontrada no XML');
    }

    const nfes = Array.isArray(nfeElement) ? nfeElement : [nfeElement];
    return nfes.map((nfe) => this.extractDocument(nfe, tipo)).filter(Boolean) as NFeDocument[];
  }

  private extractDocument(
    nfe: any,
    tipo: XmlDocumentType.NFE | XmlDocumentType.NFCE
  ): NFeDocument | null {
    const inf = nfe.infnfe;
    if (!inf) return null;

    const ide = inf.ide || {};
    const emit = inf.emit || {};
    const dest = inf.dest || {};
    const total = inf.total?.icmstot || {};
    const enderEmit = emit.enderemit || {};

    return {
      tipo,
      numeroNota: this.str(ide.nnf),
      serie: this.str(ide.serie),
      modelo: this.str(ide.mod) || (tipo === XmlDocumentType.NFE ? '55' : '65'),
      dataEmissao: this.str(ide.dhemi || ide.demi),
      cnpjEmitente: this.str(emit.cnpj),
      ieEmitente: this.str(emit.ie),
      razaoSocialEmitente: this.str(emit.xnome),
      logradouroEmitente: this.str(enderEmit.xlgr),
      numeroEnderecoEmitente: this.str(enderEmit.nro),
      bairroEmitente: this.str(enderEmit.xbairro),
      cepEmitente: this.str(enderEmit.cep),
      municipioEmitente: this.str(enderEmit.xmun),
      codigoMunicipioEmitente: this.str(enderEmit.cmun),
      ufEmitente: this.str(enderEmit.uf),
      telefoneEmitente: this.str(enderEmit.fone),
      cnpjDestinatario: this.str(dest.cnpj || dest.cpf),
      ieDestinatario: this.str(dest.ie),
      razaoSocialDestinatario: this.str(dest.xnome),
      ufDestinatario: this.str(dest.enderest?.uf || enderEmit.uf),
      valorTotalNota: this.num(total.vnf),
      valorProdutos: this.num(total.vprod),
      baseCalculoIcms: this.num(total.vbc),
      valorIcms: this.num(total.vicms),
      valorIpi: this.num(total.vipi),
      valorPis: this.num(total.vpis),
      valorCofins: this.num(total.vcofins),
      valorFrete: this.num(total.vfrete),
      valorDesconto: this.num(total.vdesc),
      valorOutros: this.num(total.voutro),
      naturezaOperacao: this.str(ide.natop),
      situacao: 'N',
      itens: this.extractItems(inf.det),
    };
  }

  private extractItems(det: any): DocumentItem[] {
    if (!det) return [];
    const items = Array.isArray(det) ? det : [det];

    return items.map((d, index) => {
      const prod = d.prod || {};
      const imposto = d.imposto || {};

      return {
        numeroItem: parseInt(d.nitem || String(index + 1)),
        codigoProduto: this.str(prod.cprod),
        descricao: this.str(prod.xprod),
        ncm: this.str(prod.ncm),
        cfop: this.str(prod.cfop),
        cst: this.extractCst(imposto),
        unidade: this.str(prod.ucom),
        quantidade: this.num(prod.qcom),
        valorUnitario: this.num(prod.vuncom),
        valorTotal: this.num(prod.vprod),
        valorDesconto: this.num(prod.vdesc),
        baseCalculoIcms: this.extractIcmsField(imposto, 'vbc'),
        baseCalculoIcmsSt: this.extractIcmsField(imposto, 'vbcst'),
        valorIcms: this.extractIcmsField(imposto, 'vicms'),
        valorIpi: this.extractIpiValue(imposto),
        valorPis: this.extractPisValue(imposto),
        valorCofins: this.extractCofinsValue(imposto),
        aliquotaIcms: this.extractIcmsField(imposto, 'picms'),
        aliquotaIpi: this.extractIpiRate(imposto),
      };
    });
  }

  private extractCst(imposto: any): string {
    const icms = imposto.icms;
    if (!icms) return '000';

    const icmsTypes = [
      'icms00', 'icms10', 'icms20', 'icms30', 'icms40', 'icms51',
      'icms60', 'icms70', 'icms90',
      'icmssn101', 'icmssn102', 'icmssn103', 'icmssn201',
      'icmssn202', 'icmssn203', 'icmssn300', 'icmssn400', 'icmssn500', 'icmssn900',
    ];

    for (const type of icmsTypes) {
      if (icms[type]) {
        const orig = this.str(icms[type].orig);
        const csosn = this.str(icms[type].csosn);
        if (csosn) {
          // CSOSN (Simples Nacional) -> CST mapping for SINTEGRA
          const cstEquiv = this.mapCsosnToCst(csosn);
          return orig + cstEquiv;
        }
        const cst = this.str(icms[type].cst);
        return orig + cst;
      }
    }
    return '000';
  }

  // Maps CSOSN (Simples Nacional) codes to equivalent CST codes (2 digits)
  private mapCsosnToCst(csosn: string): string {
    const map: Record<string, string> = {
      '101': '00', // Tributada com permissão de crédito
      '102': '41', // Tributada sem permissão de crédito -> não tributada
      '103': '40', // Isenção do ICMS para faixa de receita bruta
      '201': '10', // Tributada com permissão de crédito e com ST
      '202': '30', // Tributada sem permissão de crédito e com ST
      '203': '30', // Isenção do ICMS para faixa de receita bruta com ST
      '300': '40', // Imune
      '400': '41', // Não tributada pelo Simples Nacional
      '500': '60', // ICMS cobrado anteriormente por ST
      '900': '90', // Outros
    };
    return map[csosn] || '90';
  }

  private extractIcmsField(imposto: any, field: string): number {
    const icms = imposto.icms;
    if (!icms) return 0;

    const icmsTypes = [
      'icms00', 'icms10', 'icms20', 'icms30', 'icms40', 'icms51',
      'icms60', 'icms70', 'icms90',
      'icmssn101', 'icmssn102', 'icmssn103', 'icmssn201',
      'icmssn202', 'icmssn203', 'icmssn300', 'icmssn400', 'icmssn500', 'icmssn900',
    ];

    for (const type of icmsTypes) {
      if (icms[type] && icms[type][field] !== undefined) {
        return this.num(icms[type][field]);
      }
    }
    return 0;
  }

  private extractIpiValue(imposto: any): number {
    if (!imposto.ipi) return 0;
    return this.num(imposto.ipi.ipitrib?.vipi || imposto.ipi.ipint?.vipi);
  }

  private extractIpiRate(imposto: any): number {
    if (!imposto.ipi) return 0;
    return this.num(imposto.ipi.ipitrib?.pipi);
  }

  private extractPisValue(imposto: any): number {
    if (!imposto.pis) return 0;
    const pis = imposto.pis;
    return this.num(
      pis.pisaliq?.vpis || pis.pisqtde?.vpis || pis.pisnt?.vpis || pis.pisoutr?.vpis
    );
  }

  private extractCofinsValue(imposto: any): number {
    if (!imposto.cofins) return 0;
    const cofins = imposto.cofins;
    return this.num(
      cofins.cofinsaliq?.vcofins ||
        cofins.cofinsqtde?.vcofins ||
        cofins.cofinsnt?.vcofins ||
        cofins.cofinsoutr?.vcofins
    );
  }

  private str(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private num(value: any): number {
    if (value === null || value === undefined) return 0;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? 0 : parsed;
  }
}

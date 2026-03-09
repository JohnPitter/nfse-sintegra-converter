import { Injectable } from '@angular/core';
import { SintegraFormatterService } from './sintegra-formatter.service';
import {
  SintegraConfig,
  SintegraGenerationResult,
  SINTEGRA_LINE_ENDING,
  ParsedDocument,
  NFeDocument,
  NFSeDocument,
  DocumentItem,
  isNFeDocument,
  isNFSeDocument,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class SintegraGeneratorService {
  constructor(private fmt: SintegraFormatterService) {}

  generateFile(docs: ParsedDocument[], config: SintegraConfig): SintegraGenerationResult {
    const validationErrors = this.validateConfig(config);
    if (validationErrors.length > 0) {
      return {
        content: '',
        totalRecords: 0,
        registerCounts: new Map(),
        validationErrors,
      };
    }

    const records: string[] = [];

    records.push(this.generateRegister10(config));
    records.push(this.generateRegister11(config));

    const productCodes = new Set<string>();

    for (const doc of docs) {
      if (isNFeDocument(doc)) {
        records.push(...this.generateRegister50FromNFe(doc, config));
        records.push(...this.generateRegister54FromNFe(doc));
        doc.itens.forEach((item) => productCodes.add(item.codigoProduto));
      } else if (isNFSeDocument(doc)) {
        records.push(...this.generateRegister50FromNFSe(doc, config));
      }
    }

    const nfeDocs = docs.filter(isNFeDocument);
    if (productCodes.size > 0) {
      records.push(...this.generateRegister75(nfeDocs, config));
    }

    records.push(...this.generateRegister90(records, config));

    const registerCounts = this.countRegisters(records);

    return {
      content: records.join(SINTEGRA_LINE_ENDING),
      totalRecords: records.length,
      registerCounts,
      validationErrors: [],
    };
  }

  private validateConfig(config: SintegraConfig): string[] {
    const errors: string[] = [];
    if (!config.cnpj || !this.fmt.validateCNPJ(config.cnpj)) {
      errors.push('CNPJ invalido ou nao informado');
    }
    if (!config.razaoSocial) {
      errors.push('Razao Social e obrigatoria');
    }
    if (!config.uf || config.uf.length !== 2) {
      errors.push('UF invalida');
    }
    if (!config.municipio) {
      errors.push('Municipio e obrigatorio');
    }
    return errors;
  }

  // ========== REGISTRO 10 - Identificacao do Estabelecimento ==========
  // tipo(2) + cnpj(14) + ie(14) + nome(35) + municipio(30) + uf(2) + fax(10) + dt_ini(8) + dt_fim(8) + cod_estrutura(1) + cod_natureza(1) + cod_finalidade(1) = 126
  private generateRegister10(config: SintegraConfig): string {
    const dtIni = config.dtInicial || this.fmt.formatDate(this.fmt.getFirstDayOfMonth());
    const dtFim = config.dtFinal || this.fmt.formatDate(this.fmt.getLastDayOfMonth());

    const record =
      '10' +
      this.fmt.formatCNPJ(config.cnpj) +
      this.fmt.formatAlpha(config.inscricaoEstadual || 'ISENTO', 14) +
      this.fmt.formatAlpha(config.razaoSocial, 35) +
      this.fmt.formatAlpha(config.municipio, 30) +
      this.fmt.formatAlpha(config.uf, 2) +
      this.fmt.formatNumeric(config.fax, 10) +
      this.fmt.formatNumeric(dtIni, 8) +
      this.fmt.formatNumeric(dtFim, 8) +
      config.codEstrutura +
      config.codNatureza +
      config.codFinalidade;

    return this.fmt.assertLength(record, '10');
  }

  // ========== REGISTRO 11 - Dados Complementares ==========
  // tipo(2) + logradouro(34) + numero(5) + complemento(22) + bairro(15) + cep(8) + contato(28) + telefone(12) = 126
  private generateRegister11(config: SintegraConfig): string {
    const record =
      '11' +
      this.fmt.formatAlpha(config.logradouro, 34) +
      this.fmt.formatNumeric(config.numero, 5) +
      this.fmt.formatAlpha(config.complemento, 22) +
      this.fmt.formatAlpha(config.bairro, 15) +
      this.fmt.formatNumeric(config.cep, 8) +
      this.fmt.formatAlpha(config.contato, 28) +
      this.fmt.formatNumeric(config.telefone, 12);

    return this.fmt.assertLength(record, '11');
  }

  // ========== REGISTRO 50 - Totais de Nota Fiscal ==========
  // tipo(2) + cnpj(14) + ie(14) + data(8) + uf(2) + modelo(2) + serie(3) + numero(6) + cfop(4) + emitente(1) + vl_total(13) + bc_icms(13) + vl_icms(13) + isenta(13) + outras(13) + aliquota(4) + situacao(1) = 126
  private generateRegister50FromNFe(doc: NFeDocument, config: SintegraConfig): string[] {
    const records: string[] = [];

    // Group items by CFOP + aliquota for proper register 50 generation
    const groups = this.groupItemsByCfopAliquota(doc.itens);

    for (const group of groups) {
      const vlTotal = group.items.reduce((sum, i) => sum + i.valorTotal, 0);
      const bcIcms = group.items.reduce((sum, i) => sum + i.baseCalculoIcms, 0);
      const vlIcms = group.items.reduce((sum, i) => sum + i.valorIcms, 0);
      const isenta = group.items
        .filter((i) => this.isIsentoOuNaoTributado(i.cst))
        .reduce((sum, i) => sum + i.valorTotal, 0);
      const outras = group.items
        .filter((i) => this.isOutras(i.cst))
        .reduce((sum, i) => sum + i.valorTotal, 0);

      const cnpjContraparte = this.isSaida(group.cfop)
        ? doc.cnpjDestinatario || doc.cnpjEmitente
        : doc.cnpjEmitente;
      const ieContraparte = this.isSaida(group.cfop)
        ? doc.ieDestinatario || 'ISENTO'
        : doc.ieEmitente || 'ISENTO';
      const ufContraparte = this.isSaida(group.cfop)
        ? doc.ufDestinatario || doc.ufEmitente
        : doc.ufEmitente;

      const record =
        '50' +
        this.fmt.formatCNPJ(cnpjContraparte) +
        this.fmt.formatAlpha(ieContraparte, 14) +
        this.fmt.formatDate(doc.dataEmissao) +
        this.fmt.formatAlpha(ufContraparte, 2) +
        this.fmt.formatNumeric(doc.modelo, 2) +
        this.fmt.formatAlpha(doc.serie, 3) +
        this.fmt.formatNumeric(doc.numeroNota, 6) +
        this.fmt.formatNumeric(group.cfop, 4) +
        'P' +
        this.fmt.formatMoney(vlTotal, 13) +
        this.fmt.formatMoney(bcIcms, 13) +
        this.fmt.formatMoney(vlIcms, 13) +
        this.fmt.formatMoney(isenta, 13) +
        this.fmt.formatMoney(outras, 13) +
        this.fmt.formatNumeric(Math.round(group.aliquota * 100).toString(), 4) +
        doc.situacao;

      records.push(this.fmt.assertLength(record, '50'));
    }

    // If no items or no groups, generate single record with totals
    if (records.length === 0) {
      const cfop = doc.itens.length > 0 ? doc.itens[0].cfop : '5102';
      const record =
        '50' +
        this.fmt.formatCNPJ(doc.cnpjEmitente) +
        this.fmt.formatAlpha(doc.ieEmitente || 'ISENTO', 14) +
        this.fmt.formatDate(doc.dataEmissao) +
        this.fmt.formatAlpha(doc.ufEmitente, 2) +
        this.fmt.formatNumeric(doc.modelo, 2) +
        this.fmt.formatAlpha(doc.serie, 3) +
        this.fmt.formatNumeric(doc.numeroNota, 6) +
        this.fmt.formatNumeric(cfop, 4) +
        'P' +
        this.fmt.formatMoney(doc.valorTotalNota, 13) +
        this.fmt.formatMoney(doc.baseCalculoIcms, 13) +
        this.fmt.formatMoney(doc.valorIcms, 13) +
        this.fmt.formatMoney(0, 13) +
        this.fmt.formatMoney(doc.valorOutros, 13) +
        this.fmt.formatNumeric('0000', 4) +
        doc.situacao;

      records.push(this.fmt.assertLength(record, '50'));
    }

    return records;
  }

  private generateRegister50FromNFSe(doc: NFSeDocument, config: SintegraConfig): string[] {
    // NFSe maps to SINTEGRA with model 99 (outros) or configurable
    // ISS services typically don't have ICMS, so base/icms = 0
    const record =
      '50' +
      this.fmt.formatCNPJ(doc.cnpjPrestador) +
      this.fmt.formatAlpha(doc.iePrestador || 'ISENTO', 14) +
      this.fmt.formatDate(doc.dataEmissao) +
      this.fmt.formatAlpha(doc.ufPrestacao || config.uf, 2) +
      '99' + // Modelo 99 - outros documentos
      '000' + // Serie
      this.fmt.formatNumeric(doc.numeroNota, 6) +
      '1933' + // CFOP para servicos
      'P' +
      this.fmt.formatMoney(doc.valorServicos, 13) +
      this.fmt.formatMoney(0, 13) + // bc_icms = 0 (servico ISS)
      this.fmt.formatMoney(0, 13) + // vl_icms = 0
      this.fmt.formatMoney(doc.valorServicos, 13) + // isenta/nao tributada (ISS, nao ICMS)
      this.fmt.formatMoney(0, 13) + // outras
      '0000' + // aliquota ICMS = 0
      'N'; // situacao normal

    return [this.fmt.assertLength(record, '50')];
  }

  // ========== REGISTRO 54 - Itens de Nota Fiscal ==========
  // tipo(2) + cnpj(14) + modelo(2) + serie(3) + numero(6) + cfop(4) + cst(3) + num_item(3) + cod_produto(14) + quantidade(11,8v3) + vl_produto(12,10v2) + desconto(12,10v2) + bc_icms(12,10v2) + bc_icms_st(12,10v2) + vl_ipi(12,10v2) + aliquota(4,2v2) = 126
  private generateRegister54FromNFe(doc: NFeDocument): string[] {
    return doc.itens.map((item) => {
      const record =
        '54' +
        this.fmt.formatCNPJ(doc.cnpjEmitente) +
        this.fmt.formatNumeric(doc.modelo, 2) +
        this.fmt.formatAlpha(doc.serie, 3) +
        this.fmt.formatNumeric(doc.numeroNota, 6) +
        this.fmt.formatNumeric(item.cfop, 4) +
        this.fmt.formatAlpha(item.cst, 3) +
        this.fmt.formatNumeric(item.numeroItem.toString(), 3) +
        this.fmt.formatAlpha(item.codigoProduto, 14) +
        this.fmt.formatQuantity(item.quantidade, 11, 3) +
        this.fmt.formatMoney(item.valorTotal, 12) +
        this.fmt.formatMoney(item.valorDesconto, 12) +
        this.fmt.formatMoney(item.baseCalculoIcms, 12) +
        this.fmt.formatMoney(item.baseCalculoIcmsSt, 12) +
        this.fmt.formatMoney(item.valorIpi, 12) +
        this.fmt.formatNumeric(Math.round(item.aliquotaIcms * 100).toString(), 4);

      return this.fmt.assertLength(record, '54');
    });
  }

  // ========== REGISTRO 75 - Tabela de Codigo de Produto/Servico ==========
  // tipo(2) + dt_ini(8) + dt_fim(8) + cod_produto(14) + cod_ncm(8) + descricao(53) + unidade(6) + aliq_ipi(5,3v2) + aliq_icms(4,2v2) + reducao_bc(5,3v2) + bc_icms_st(13,11v2) = 126
  private generateRegister75(nfeDocs: NFeDocument[], config: SintegraConfig): string[] {
    const dtIni = config.dtInicial || this.fmt.formatDate(this.fmt.getFirstDayOfMonth());
    const dtFim = config.dtFinal || this.fmt.formatDate(this.fmt.getLastDayOfMonth());

    const productMap = new Map<
      string,
      { item: DocumentItem; aliquotaIcms: number }
    >();

    for (const doc of nfeDocs) {
      for (const item of doc.itens) {
        if (!productMap.has(item.codigoProduto)) {
          productMap.set(item.codigoProduto, {
            item,
            aliquotaIcms: item.aliquotaIcms,
          });
        }
      }
    }

    return Array.from(productMap.values()).map(({ item }) => {
      const record =
        '75' +
        this.fmt.formatNumeric(dtIni, 8) +
        this.fmt.formatNumeric(dtFim, 8) +
        this.fmt.formatAlpha(item.codigoProduto, 14) +
        this.fmt.formatAlpha(item.ncm, 8) +
        this.fmt.formatAlpha(item.descricao, 53) +
        this.fmt.formatAlpha(item.unidade, 6) +
        this.fmt.formatNumeric(Math.round(item.aliquotaIpi * 100).toString(), 5) +
        this.fmt.formatNumeric(Math.round(item.aliquotaIcms * 100).toString(), 4) +
        this.fmt.formatNumeric('0', 5) + // reducao base ICMS
        this.fmt.formatMoney(item.baseCalculoIcmsSt, 13);

      return this.fmt.assertLength(record, '75');
    });
  }

  // ========== REGISTRO 90 - Totalizacao ==========
  // tipo(2) + cnpj(14) + ie(14) + [tipo_reg(2) + qtd(8)]* + brancos + num_reg90(1) at pos 126
  private generateRegister90(existingRecords: string[], config: SintegraConfig): string[] {
    // Count records by type (exclude 10, 11, and 90)
    const counts = new Map<string, number>();
    for (const record of existingRecords) {
      const tipo = record.substring(0, 2);
      if (tipo !== '10' && tipo !== '11') {
        counts.set(tipo, (counts.get(tipo) || 0) + 1);
      }
    }

    // Total including all records + reg90 itself
    const totalRecords = existingRecords.length + 1; // +1 for the reg90 we're adding

    const cnpj = this.fmt.formatCNPJ(config.cnpj);
    const ie = this.fmt.formatAlpha(config.inscricaoEstadual || 'ISENTO', 14);

    // Build type counts string: [tipo(2) + qtd(8)] for each type
    let typeCounts = '';
    const sortedTypes = Array.from(counts.keys()).sort();
    for (const tipo of sortedTypes) {
      typeCounts += tipo + this.fmt.formatNumeric(counts.get(tipo)!.toString(), 8);
    }
    // Add grand total with type "99"
    typeCounts += '99' + this.fmt.formatNumeric(totalRecords.toString(), 8);

    const header = '90' + cnpj + ie; // 2 + 14 + 14 = 30 chars
    const availableSpace = 126 - 30 - 1; // -1 for num_reg90 at pos 126

    // If typeCounts fits in one record
    if (typeCounts.length <= availableSpace) {
      const padding = ''.padEnd(availableSpace - typeCounts.length, ' ');
      const record = header + typeCounts + padding + '1';
      return [this.fmt.assertLength(record, '90')];
    }

    // Split across multiple reg90 records
    const records: string[] = [];
    let remaining = typeCounts;
    while (remaining.length > 0) {
      const chunk = remaining.substring(0, availableSpace);
      remaining = remaining.substring(availableSpace);
      const padding = ''.padEnd(availableSpace - chunk.length, ' ');
      records.push(header + chunk + padding + '0'); // placeholder for count
    }

    // Set the num_reg90 field (number of reg90 records) in each record
    const numReg90 = records.length.toString();
    return records.map((r) => {
      const fixed = r.substring(0, 125) + numReg90;
      return this.fmt.assertLength(fixed, '90');
    });
  }

  // ========== Helpers ==========

  private groupItemsByCfopAliquota(
    items: DocumentItem[]
  ): { cfop: string; aliquota: number; items: DocumentItem[] }[] {
    const groups = new Map<string, { cfop: string; aliquota: number; items: DocumentItem[] }>();

    for (const item of items) {
      const key = `${item.cfop}-${item.aliquotaIcms}`;
      if (!groups.has(key)) {
        groups.set(key, { cfop: item.cfop, aliquota: item.aliquotaIcms, items: [] });
      }
      groups.get(key)!.items.push(item);
    }

    return Array.from(groups.values());
  }

  private isSaida(cfop: string): boolean {
    const firstDigit = cfop.charAt(0);
    return firstDigit === '5' || firstDigit === '6' || firstDigit === '7';
  }

  private isIsentoOuNaoTributado(cst: string): boolean {
    const lastTwo = cst.substring(cst.length - 2);
    return ['30', '40', '41', '50'].includes(lastTwo);
  }

  private isOutras(cst: string): boolean {
    const lastTwo = cst.substring(cst.length - 2);
    return ['51', '60', '90'].includes(lastTwo);
  }

  private countRegisters(records: string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const record of records) {
      const tipo = record.substring(0, 2);
      counts.set(tipo, (counts.get(tipo) || 0) + 1);
    }
    return counts;
  }

  generateDefaultConfig(docs: ParsedDocument[]): SintegraConfig {
    const config: SintegraConfig = {
      cnpj: '',
      inscricaoEstadual: '',
      razaoSocial: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cep: '',
      municipio: '',
      uf: 'MG',
      fax: '',
      contato: '',
      telefone: '',
      dtInicial: this.fmt.formatDate(this.fmt.getFirstDayOfMonth()),
      dtFinal: this.fmt.formatDate(this.fmt.getLastDayOfMonth()),
      codEstrutura: '3',
      codNatureza: '3',
      codFinalidade: '1',
    };

    if (docs.length === 0) return config;

    const first = docs[0];
    if (isNFeDocument(first)) {
      config.cnpj = first.cnpjEmitente;
      config.inscricaoEstadual = first.ieEmitente || 'ISENTO';
      config.razaoSocial = first.razaoSocialEmitente;
      config.logradouro = first.logradouroEmitente;
      config.numero = first.numeroEnderecoEmitente;
      config.bairro = first.bairroEmitente;
      config.cep = first.cepEmitente;
      config.municipio = first.municipioEmitente;
      config.uf = first.ufEmitente || 'MG';
      config.telefone = first.telefoneEmitente;
    } else if (isNFSeDocument(first)) {
      config.cnpj = first.cnpjPrestador;
      config.inscricaoEstadual = first.iePrestador || 'ISENTO';
      config.razaoSocial = first.razaoSocialPrestador;
      config.uf = first.ufPrestacao || 'MG';
    }

    return config;
  }
}

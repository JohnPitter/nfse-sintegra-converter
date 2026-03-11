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
    const nfceDocs: NFeDocument[] = [];

    for (const doc of docs) {
      if (isNFeDocument(doc)) {
        if (doc.modelo === '65') {
          // NFCe (modelo 65) -> Registro 61/61R (NOT Registro 50/54)
          nfceDocs.push(doc);
        } else {
          // NFe (modelo 55 etc) -> Registro 50/54
          records.push(...this.generateRegister50FromNFe(doc, config));
          records.push(...this.generateRegister54FromNFe(doc));
        }
        doc.itens.forEach((item) => productCodes.add(item.codigoProduto));
      } else if (isNFSeDocument(doc)) {
        records.push(...this.generateRegister50FromNFSe(doc, config));
      }
    }

    // Generate Registro 61 (daily summary) and 61R (monthly item summary) for NFCe
    if (nfceDocs.length > 0) {
      records.push(...this.generateRegister61FromNFCe(nfceDocs));
      records.push(...this.generateRegister61RFromNFCe(nfceDocs, config));
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
    const contato = config.contato || config.razaoSocial || 'NAO INFORMADO';
    const record =
      '11' +
      this.fmt.formatAlpha(config.logradouro, 34) +
      this.fmt.formatNumeric(config.numero, 5) +
      this.fmt.formatAlpha(config.complemento, 22) +
      this.fmt.formatAlpha(config.bairro, 15) +
      this.fmt.formatNumeric(config.cep, 8) +
      this.fmt.formatAlpha(contato, 28) +
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
    // CNPJ must match the one used in Register 50 for the same document
    const cfop = doc.itens.length > 0 ? doc.itens[0].cfop : '5102';
    const cnpjReg54 = this.isSaida(cfop)
      ? doc.cnpjDestinatario || doc.cnpjEmitente
      : doc.cnpjEmitente;

    return doc.itens.map((item) => {
      const record =
        '54' +
        this.fmt.formatCNPJ(cnpjReg54) +
        this.fmt.formatNumeric(doc.modelo, 2) +
        this.fmt.formatAlpha(doc.serie, 3) +
        this.fmt.formatNumeric(doc.numeroNota, 6) +
        this.fmt.formatNumeric(item.cfop, 4) +
        this.fmt.formatNumeric(item.cst, 3) +
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

  // ========== REGISTRO 61 - Resumo Diario (ECF/NFCe modelo 65) ==========
  // tipo(2) + brancos(14) + brancos(14) + data(8) + modelo(2) + serie(3) + subserie(2) + numInicial(6) + numFinal(6) + vlTotal(13) + bcIcms(13) + vlIcms(12) + isenta(13) + outras(13) + aliquota(4) + branco(1) = 126
  private generateRegister61FromNFCe(nfceDocs: NFeDocument[]): string[] {
    // Group by date + serie + aliquota
    const groups = new Map<string, {
      data: string;
      serie: string;
      aliquota: number;
      numeros: number[];
      vlTotal: number;
      bcIcms: number;
      vlIcms: number;
      isenta: number;
      outras: number;
    }>();

    for (const doc of nfceDocs) {
      const data = this.fmt.formatDate(doc.dataEmissao);
      // Derive dominant aliquota from items
      const aliquotaGroups = this.groupItemsByAliquota(doc);

      for (const ag of aliquotaGroups) {
        const key = `${data}-${doc.serie}-${ag.aliquota}`;
        if (!groups.has(key)) {
          groups.set(key, {
            data,
            serie: doc.serie,
            aliquota: ag.aliquota,
            numeros: [],
            vlTotal: 0,
            bcIcms: 0,
            vlIcms: 0,
            isenta: 0,
            outras: 0,
          });
        }
        const g = groups.get(key)!;
        g.numeros.push(parseInt(doc.numeroNota) || 0);
        g.vlTotal += ag.vlTotal;
        g.bcIcms += ag.bcIcms;
        g.vlIcms += ag.vlIcms;
        g.isenta += ag.isenta;
        g.outras += ag.outras;
      }
    }

    const records: string[] = [];
    for (const g of groups.values()) {
      const numInicial = Math.min(...g.numeros);
      const numFinal = Math.max(...g.numeros);

      const record =
        '61' +
        ''.padEnd(14, ' ') + // CNPJ blank for modelo 65
        ''.padEnd(14, ' ') + // IE blank for modelo 65
        this.fmt.formatNumeric(g.data, 8) +
        '65' + // modelo
        this.fmt.formatAlpha(g.serie, 3) +
        ''.padEnd(2, ' ') + // subserie blank
        this.fmt.formatNumeric(numInicial.toString(), 6) +
        this.fmt.formatNumeric(numFinal.toString(), 6) +
        this.fmt.formatMoney(g.vlTotal, 13) +
        this.fmt.formatMoney(g.bcIcms, 13) +
        this.fmt.formatMoney(g.vlIcms, 12) +
        this.fmt.formatMoney(g.isenta, 13) +
        this.fmt.formatMoney(g.outras, 13) +
        this.fmt.formatNumeric(Math.round(g.aliquota * 100).toString(), 4) +
        ' '; // branco final

      records.push(this.fmt.assertLength(record, '61'));
    }

    return records;
  }

  private groupItemsByAliquota(doc: NFeDocument): {
    aliquota: number;
    vlTotal: number;
    bcIcms: number;
    vlIcms: number;
    isenta: number;
    outras: number;
  }[] {
    const map = new Map<number, {
      aliquota: number;
      vlTotal: number;
      bcIcms: number;
      vlIcms: number;
      isenta: number;
      outras: number;
    }>();

    for (const item of doc.itens) {
      const aliq = item.aliquotaIcms;
      if (!map.has(aliq)) {
        map.set(aliq, { aliquota: aliq, vlTotal: 0, bcIcms: 0, vlIcms: 0, isenta: 0, outras: 0 });
      }
      const g = map.get(aliq)!;
      g.vlTotal += item.valorTotal;
      g.bcIcms += item.baseCalculoIcms;
      g.vlIcms += item.valorIcms;
      if (this.isIsentoOuNaoTributado(item.cst)) {
        g.isenta += item.valorTotal;
      } else if (this.isOutras(item.cst)) {
        g.outras += item.valorTotal;
      }
    }

    return Array.from(map.values());
  }

  // ========== REGISTRO 61R - Resumo Mensal por Item (NFCe modelo 65) ==========
  // tipo(2) + subtipo(1,"R") + mesAno(6,MMAAAA) + codProduto(14) + quantidade(13,10v3) + vlBruto(16,14v2) + bcIcms(16,14v2) + aliquota(4,2v2) + brancos(54) = 126
  private generateRegister61RFromNFCe(nfceDocs: NFeDocument[], _config: SintegraConfig): string[] {
    // Group items by month + product + aliquota
    const groups = new Map<string, {
      mesAno: string; // MMAAAA
      codProduto: string;
      aliquota: number;
      quantidade: number;
      vlBruto: number;
      bcIcms: number;
    }>();

    for (const doc of nfceDocs) {
      const dateStr = this.fmt.formatDate(doc.dataEmissao); // YYYYMMDD
      if (dateStr === '00000000') continue;
      const mesAno = dateStr.substring(4, 6) + dateStr.substring(0, 4); // MMAAAA

      for (const item of doc.itens) {
        const key = `${mesAno}-${item.codigoProduto}-${item.aliquotaIcms}`;
        if (!groups.has(key)) {
          groups.set(key, {
            mesAno,
            codProduto: item.codigoProduto,
            aliquota: item.aliquotaIcms,
            quantidade: 0,
            vlBruto: 0,
            bcIcms: 0,
          });
        }
        const g = groups.get(key)!;
        g.quantidade += item.quantidade;
        g.vlBruto += item.valorTotal;
        g.bcIcms += item.baseCalculoIcms;
      }
    }

    const records: string[] = [];
    for (const g of groups.values()) {
      const record =
        '61' +
        'R' +
        this.fmt.formatNumeric(g.mesAno, 6) +
        this.fmt.formatAlpha(g.codProduto, 14) +
        this.fmt.formatQuantity(g.quantidade, 13, 3) +
        this.fmt.formatMoney(g.vlBruto, 16) +
        this.fmt.formatMoney(g.bcIcms, 16) +
        this.fmt.formatNumeric(Math.round(g.aliquota * 100).toString(), 4) +
        ''.padEnd(54, ' ');

      records.push(this.fmt.assertLength(record, '61'));
    }

    return records;
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
    // Count records by type, EXCLUDING types 10 and 11 from individual counts
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
    // Derive period dates from document dates
    const { dtInicial, dtFinal } = this.derivePeriodFromDocs(docs);

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
      dtInicial,
      dtFinal,
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

  private derivePeriodFromDocs(docs: ParsedDocument[]): { dtInicial: string; dtFinal: string } {
    const dates: Date[] = [];

    for (const doc of docs) {
      if (!doc.dataEmissao) continue;
      const dateStr = this.fmt.formatDate(doc.dataEmissao);
      if (dateStr === '00000000') continue;
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      dates.push(new Date(year, month, day));
    }

    if (dates.length === 0) {
      return {
        dtInicial: this.fmt.formatDate(this.fmt.getFirstDayOfMonth()),
        dtFinal: this.fmt.formatDate(this.fmt.getLastDayOfMonth()),
      };
    }

    const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));

    // Period must be first day to last day of the month range
    const firstDay = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const lastDay = new Date(latest.getFullYear(), latest.getMonth() + 1, 0);

    return {
      dtInicial: this.fmt.formatDate(firstDay),
      dtFinal: this.fmt.formatDate(lastDay),
    };
  }
}

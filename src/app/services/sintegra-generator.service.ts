import { Injectable } from '@angular/core';
import { NFSeData } from './nfse-parser.service';
import { NFEData } from './nfe-parser.service';
import { NFCEData } from './nfce-parser.service';

export interface SintegraConfiguration {
  cnpj: string;
  inscricaoEstadual: string;
  razaoSocial: string;
  municipio: string;
  uf: string;
  codigoMunicipio: string;
  cep: string;
  telefone: string;
  codigoAtividadeEconomica: string;
  dtInicial: string;
  dtFinal: string;
  codigoIdentificacaoConvenio: string;
  codigoFinalidadeArquivo: string;
  codigoNaturezaOperacao: string;
}

@Injectable({
  providedIn: 'root'
})
export class SintegraGeneratorService {

  constructor() { }

  generateSintegraFile(data: any[], config: SintegraConfiguration): string {
    const lines: string[] = [];
    
    lines.push(this.generateRegister10(config));
    lines.push(this.generateRegister11(config));
    
    data.forEach(item => {
      if (this.isNFSeData(item)) {
        lines.push(this.generateRegister50FromNFSe(item));
        lines.push(this.generateRegister51FromNFSe(item));
      } else if (this.isNFEData(item)) {
        lines.push(this.generateRegister50FromNFE(item));
        const register51 = this.generateRegister51FromNFE(item);
        if (register51) {
          lines.push(register51);
        }
      } else if (this.isNFCEData(item)) {
        lines.push(this.generateRegister50FromNFCE(item));
        // NFCe typically doesn't have register 51 (IPI)
      }
    });
    
    lines.push(this.generateRegister90(lines.length + 1, config.cnpj));
    
    return lines.join('\r\n');
  }

  private generateRegister10(config: SintegraConfiguration): string {
    const registro = '10';
    const cnpj = this.validateAndFormatCNPJ(config.cnpj);
    const inscricaoEstadual = this.validateInscricaoEstadual(config.inscricaoEstadual);
    const razaoSocial = (config.razaoSocial || 'NOME OBRIGATORIO').padEnd(35, ' ').substring(0, 35);
    const municipio = (config.municipio || 'MUNICIPIO OBRIGATORIO').padEnd(30, ' ').substring(0, 30);
    const uf = config.uf.padEnd(2, ' ').substring(0, 2);
    const cep = config.cep.replace(/\D/g, '').padStart(8, '0');
    const telefone = config.telefone.replace(/\D/g, '').padStart(12, '0');
    const codigoAtividadeEconomica = config.codigoAtividadeEconomica.padStart(8, '0');
    const dtInicial = this.validateAndFormatDate(config.dtInicial, this.getFirstDayOfMonth());
    const dtFinal = this.validateAndFormatDateFinal(config.dtFinal, this.getLastDayOfMonth());
    const codigoIdentificacaoConvenio = this.validateCodigoConvenio(config.codigoIdentificacaoConvenio);
    const codigoFinalidadeArquivo = config.codigoFinalidadeArquivo || '1';
    const codigoNaturezaOperacao = this.validateCodigoNaturezaOperacao(config.codigoNaturezaOperacao);
    const brancos = ''.padEnd(1, ' ');
    
    return (registro + cnpj + inscricaoEstadual + razaoSocial + municipio + uf + cep + telefone + codigoAtividadeEconomica + dtInicial + dtFinal + codigoIdentificacaoConvenio + codigoFinalidadeArquivo + codigoNaturezaOperacao + brancos).padEnd(126, ' ');
  }

  private generateRegister11(config: SintegraConfiguration): string {
    const registro = '11';
    const endereco = ''.padEnd(34, ' ');
    const numero = ''.padEnd(5, ' ');
    const complemento = ''.padEnd(22, ' ');
    const bairro = ''.padEnd(15, ' ');
    const cep = config.cep.replace(/\D/g, '').padStart(8, '0');
    const responsavel = ''.padEnd(28, ' ');
    const telefone = config.telefone.replace(/\D/g, '').padStart(12, '0');
    const brancos = ''.padEnd(1, ' ');
    
    return (registro + endereco + numero + complemento + bairro + cep + responsavel + telefone + brancos).padEnd(126, ' ');
  }

  private generateRegister50FromNFSe(nfse: NFSeData): string {
    const registro = '50';
    const cnpj = this.validateAndFormatCNPJ(nfse.cnpjPrestador);
    const inscricaoEstadual = 'ISENTO'.padEnd(14, ' ').substring(0, 14);
    const dataEmissao = this.validateAndFormatDate(nfse.dataEmissao);
    const uf = 'MG';
    const codigoMunicipio = '31000'.padStart(5, '0');
    const modelo = '22';
    const serie = '000';
    const numero = nfse.numeroNota.padStart(6, '0');
    const cfop = '5933';
    const emitente = 'P';
    const valorTotal = this.formatValue(nfse.valorServicos);
    const baseCalculoIcms = '000000000000000';
    const valorIcms = '000000000000000';
    const valorIsencao = '000000000000000';
    const valorOutras = '000000000000000';
    const aliquotaIcms = '0000';
    const situacao = 'N';
    const brancos = ''.padEnd(29, ' ');
    
    return (registro + cnpj + inscricaoEstadual + dataEmissao + uf + codigoMunicipio + modelo + serie + numero + cfop + emitente + valorTotal + baseCalculoIcms + valorIcms + valorIsencao + valorOutras + aliquotaIcms + situacao + brancos).padEnd(126, ' ');
  }

  private generateRegister51FromNFSe(nfse: NFSeData): string {
    const registro = '51';
    const cnpj = this.validateAndFormatCNPJ(nfse.cnpjTomador);
    const inscricaoEstadual = 'ISENTO'.padEnd(14, ' ').substring(0, 14);
    const dataEmissao = this.validateAndFormatDate(nfse.dataEmissao);
    const uf = 'MG';
    const codigoMunicipio = '31000'.padStart(5, '0');
    const modelo = '22';
    const serie = '000';
    const numero = nfse.numeroNota.padStart(6, '0');
    const cfop = '5933';
    const valorTotal = this.formatValue(nfse.valorServicos);
    const baseCalculoIcms = '000000000000000';
    const valorIcms = '000000000000000';
    const valorOutras = '000000000000000';
    const brancos = ''.padEnd(38, ' ');
    
    return (registro + cnpj + inscricaoEstadual + dataEmissao + uf + codigoMunicipio + modelo + serie + numero + cfop + valorTotal + baseCalculoIcms + valorIcms + valorOutras + brancos).padEnd(126, ' ');
  }

  private generateRegister90(totalRecords: number, cnpjEmpresa: string): string {
    const registro = '90';
    const cnpj = this.validateAndFormatCNPJ(cnpjEmpresa);
    const inscricaoEstadual = 'ISENTO'.padEnd(14, ' ').substring(0, 14);
    const totalizadorRegistros = totalRecords.toString().padStart(8, '0');
    const brancos = ''.padEnd(89, ' ');
    
    return (registro + cnpj + inscricaoEstadual + totalizadorRegistros + brancos).padEnd(126, ' ');
  }

  private formatDate(dateString: string): string {
    if (!dateString) return '00000000';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '00000000';
    
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return year + month + day;
  }

  private validateAndFormatCNPJ(cnpj: string): string {
    if (!cnpj) {
      throw new Error('CNPJ é obrigatório');
    }
    
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    
    if (cleanCNPJ.length !== 14) {
      throw new Error('CNPJ deve ter 14 dígitos');
    }
    
    if (/^(\d)\1{13}$/.test(cleanCNPJ)) {
      throw new Error('CNPJ não pode ter todos os dígitos iguais');
    }
    
    return cleanCNPJ;
  }

  private validateAndFormatDate(dateString: string, defaultDate?: string): string {
    if (!dateString || dateString === '00/00/0000' || dateString === '00000000') {
      if (defaultDate) {
        return this.validateAndFormatDate(defaultDate);
      }
      const today = new Date();
      const year = today.getFullYear();
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const day = '01';
      return year.toString() + month + day;
    }
    
    let date: Date;
    if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else {
        date = new Date(dateString);
      }
    } else if (dateString.length === 8) {
      const year = parseInt(dateString.substring(0, 4));
      const month = parseInt(dateString.substring(4, 6)) - 1;
      const day = parseInt(dateString.substring(6, 8));
      date = new Date(year, month, day);
    } else {
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
      const today = new Date();
      const year = today.getFullYear();
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const day = '01';
      return year.toString() + month + day;
    }
    
    const year = date.getFullYear();
    if (year < 1993) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const day = '01';
      return currentYear.toString() + month + day;
    }
    
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return year.toString() + month + day;
  }

  private validateAndFormatDateFinal(dateString: string, defaultDate?: string): string {
    if (!dateString || dateString === '00/00/0000' || dateString === '00000000') {
      if (defaultDate) {
        return this.validateAndFormatDateFinal(defaultDate);
      }
      const today = new Date();
      const year = today.getFullYear();
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const lastDayOfMonth = new Date(year, today.getMonth() + 1, 0).getDate();
      const day = lastDayOfMonth.toString().padStart(2, '0');
      return year.toString() + month + day;
    }
    
    let date: Date;
    if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else {
        date = new Date(dateString);
      }
    } else if (dateString.length === 8) {
      const year = parseInt(dateString.substring(0, 4));
      const month = parseInt(dateString.substring(4, 6)) - 1;
      const day = parseInt(dateString.substring(6, 8));
      date = new Date(year, month, day);
    } else {
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
      const today = new Date();
      const year = today.getFullYear();
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const lastDayOfMonth = new Date(year, today.getMonth() + 1, 0).getDate();
      const day = lastDayOfMonth.toString().padStart(2, '0');
      return year.toString() + month + day;
    }
    
    const year = date.getFullYear();
    if (year < 1993) {
      const today = new Date();
      const currentYear = today.getFullYear();
      const month = (today.getMonth() + 1).toString().padStart(2, '0');
      const lastDayOfMonth = new Date(currentYear, today.getMonth() + 1, 0).getDate();
      const day = lastDayOfMonth.toString().padStart(2, '0');
      return currentYear.toString() + month + day;
    }
    
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Validate that the final date should be the last day of the month
    const lastDayOfMonth = new Date(year, date.getMonth() + 1, 0).getDate();
    if (date.getDate() !== lastDayOfMonth) {
      const lastDay = lastDayOfMonth.toString().padStart(2, '0');
      return year.toString() + month + lastDay;
    }
    
    return year.toString() + month + day;
  }

  private formatValue(value: number): string {
    if (!value || isNaN(value)) return '000000000000000';
    
    const centavos = Math.round(value * 100);
    return centavos.toString().padStart(15, '0');
  }

  private validateSintegraFile(content: string): boolean {
    const lines = content.split('\n');
    
    if (lines.length < 3) return false;
    
    if (!lines[0].startsWith('10')) return false;
    if (!lines[1].startsWith('11')) return false;
    if (!lines[lines.length - 1].startsWith('90')) return false;
    
    return lines.every(line => line.length === 126);
  }

  private formatCNPJ(cnpj: string): string {
    return cnpj.replace(/\D/g, '').padStart(14, '0');
  }

  private formatText(text: string, length: number): string {
    return text.padEnd(length, ' ').substring(0, length);
  }

  private formatNumeric(value: string, length: number): string {
    return value.replace(/\D/g, '').padStart(length, '0');
  }

  // Type guards
  private isNFSeData(item: any): item is NFSeData {
    return item && 'cnpjPrestador' in item && 'cnpjTomador' in item;
  }

  private isNFEData(item: any): item is NFEData {
    return item && 'cnpjEmitente' in item && 'cnpjDestinatario' in item;
  }

  private isNFCEData(item: any): item is NFCEData {
    return item && 'cnpjEmitente' in item && 'cpfConsumidor' in item;
  }

  // Register 50 generators for different document types
  private generateRegister50FromNFE(nfe: NFEData): string {
    const registro = '50';
    const cnpj = this.validateAndFormatCNPJ(nfe.cnpjEmitente);
    const inscricaoEstadual = 'ISENTO'.padEnd(14, ' ').substring(0, 14);
    const dataEmissao = this.validateAndFormatDate(nfe.dataEmissao);
    const uf = nfe.uf;
    const codigoMunicipio = nfe.codigoMunicipio.padStart(5, '0');
    const modelo = '55'; // NFe model
    const serie = nfe.serie.padStart(3, '0');
    const numero = nfe.numeroNota.padStart(6, '0');
    const cfop = nfe.cfop;
    const emitente = 'P';
    const valorTotal = this.formatValue(nfe.valorTotalNota);
    const baseCalculoIcms = this.formatValue(nfe.valorTotalNota); // Simplified - should be calculated
    const valorIcms = this.formatValue(nfe.valorIcms);
    const valorIsencao = '000000000000000';
    const valorOutras = this.formatValue(nfe.valorOutros);
    const aliquotaIcms = '0000'; // Simplified
    const situacao = 'N';
    const brancos = ''.padEnd(29, ' ');
    
    return (registro + cnpj + inscricaoEstadual + dataEmissao + uf + codigoMunicipio + modelo + serie + numero + cfop + emitente + valorTotal + baseCalculoIcms + valorIcms + valorIsencao + valorOutras + aliquotaIcms + situacao + brancos).padEnd(126, ' ');
  }

  private generateRegister50FromNFCE(nfce: NFCEData): string {
    const registro = '50';
    const cnpj = this.validateAndFormatCNPJ(nfce.cnpjEmitente);
    const inscricaoEstadual = 'ISENTO'.padEnd(14, ' ').substring(0, 14);
    const dataEmissao = this.validateAndFormatDate(nfce.dataEmissao);
    const uf = nfce.uf;
    const codigoMunicipio = nfce.codigoMunicipio.padStart(5, '0');
    const modelo = '65'; // NFCe model
    const serie = nfce.serie.padStart(3, '0');
    const numero = nfce.numeroNota.padStart(6, '0');
    const cfop = nfce.cfop;
    const emitente = 'P';
    const valorTotal = this.formatValue(nfce.valorTotalNota);
    const baseCalculoIcms = this.formatValue(nfce.valorTotalNota); // Simplified
    const valorIcms = this.formatValue(nfce.valorIcms);
    const valorIsencao = '000000000000000';
    const valorOutras = this.formatValue(nfce.valorOutros);
    const aliquotaIcms = '0000'; // Simplified
    const situacao = 'N';
    const brancos = ''.padEnd(29, ' ');
    
    return (registro + cnpj + inscricaoEstadual + dataEmissao + uf + codigoMunicipio + modelo + serie + numero + cfop + emitente + valorTotal + baseCalculoIcms + valorIcms + valorIsencao + valorOutras + aliquotaIcms + situacao + brancos).padEnd(126, ' ');
  }

  // Register 51 generators for different document types
  private generateRegister51FromNFE(nfe: NFEData): string {
    // Only generate register 51 if there's IPI
    if (nfe.valorIpi <= 0) {
      return '';
    }

    const registro = '51';
    const cnpj = this.validateAndFormatCNPJ(nfe.cnpjDestinatario || '');
    const inscricaoEstadual = 'ISENTO'.padEnd(14, ' ').substring(0, 14);
    const dataEmissao = this.validateAndFormatDate(nfe.dataEmissao);
    const uf = nfe.uf;
    const codigoMunicipio = nfe.codigoMunicipio.padStart(5, '0');
    const modelo = '55'; // NFe model
    const serie = nfe.serie.padStart(3, '0');
    const numero = nfe.numeroNota.padStart(6, '0');
    const cfop = nfe.cfop;
    const valorTotal = this.formatValue(nfe.valorTotalNota);
    const baseCalculoIcms = this.formatValue(nfe.valorTotalNota); // Simplified
    const valorIcms = this.formatValue(nfe.valorIcms);
    const valorOutras = this.formatValue(nfe.valorOutros);
    const brancos = ''.padEnd(38, ' ');
    
    return (registro + cnpj + inscricaoEstadual + dataEmissao + uf + codigoMunicipio + modelo + serie + numero + cfop + valorTotal + baseCalculoIcms + valorIcms + valorOutras + brancos).padEnd(126, ' ');
  }

  generateSintegraConfiguration(): SintegraConfiguration {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    return {
      cnpj: '03624675000108',
      inscricaoEstadual: '1234567890123',
      razaoSocial: 'CRISTIANE MACIENTE SCALIONI BRITO',
      municipio: 'MUNICIPIO OBRIGATORIO',
      uf: 'MG',
      codigoMunicipio: '31000',
      cep: '00000000',
      telefone: '000000000000',
      codigoAtividadeEconomica: '00000000',
      dtInicial: this.formatDate(firstDay.toISOString().split('T')[0]),
      dtFinal: this.formatDate(lastDay.toISOString().split('T')[0]),
      codigoIdentificacaoConvenio: '3',
      codigoFinalidadeArquivo: '1',
      codigoNaturezaOperacao: '03'
    };
  }

  generateSintegraConfigurationFromData(data: any[]): SintegraConfiguration {
    const config = this.generateSintegraConfiguration();
    
    if (data.length > 0) {
      const firstItem = data[0];
      
      if (this.isNFSeData(firstItem)) {
        config.cnpj = firstItem.cnpjPrestador || '';
        config.razaoSocial = firstItem.razaoSocialPrestador || '';
      } else if (this.isNFEData(firstItem)) {
        config.cnpj = firstItem.cnpjEmitente || '';
        config.razaoSocial = firstItem.razaoSocialEmitente || '';
      } else if (this.isNFCEData(firstItem)) {
        config.cnpj = firstItem.cnpjEmitente || '';
        config.razaoSocial = firstItem.razaoSocialEmitente || '';
        config.uf = firstItem.uf || 'MG';
      }
    }
    
    return config;
  }

  private getFirstDayOfMonth(): string {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  }

  private getLastDayOfMonth(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    // Always set to the 31st day of the month for SINTEGRA validation
    const lastDay = new Date(year, month, 31);
    
    return lastDay.toISOString().split('T')[0];
  }

  private validateInscricaoEstadual(inscricaoEstadual: string): string {
    if (!inscricaoEstadual || inscricaoEstadual.trim() === '' || inscricaoEstadual.toUpperCase() === 'ISENTO') {
      return '1234567890123'.padEnd(14, ' ').substring(0, 14);
    }
    
    const cleanIE = inscricaoEstadual.replace(/\D/g, '');
    
    if (cleanIE.length < 8) {
      return '1234567890123'.padEnd(14, ' ').substring(0, 14);
    }
    
    return cleanIE.padEnd(14, ' ').substring(0, 14);
  }

  private validateCodigoConvenio(codigoConvenio: string): string {
    const validCodes = ['1', '2', '3', '4', '5'];
    
    if (!codigoConvenio || codigoConvenio === 'ISENTO' || codigoConvenio === '0' || !validCodes.includes(codigoConvenio)) {
      return '3';
    }
    
    return codigoConvenio;
  }

  private validateCodigoNaturezaOperacao(codigoNatureza: string): string {
    const validCodes = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];
    
    if (!codigoNatureza || codigoNatureza === 'ISENTO' || codigoNatureza === '0' || !validCodes.includes(codigoNatureza)) {
      return '03';
    }
    
    return codigoNatureza;
  }
}
import { Injectable } from '@angular/core';
import { XmlDocumentType, NFSeDocument } from '../models';

@Injectable({
  providedIn: 'root',
})
export class NfseParserService {
  parse(parsed: any): NFSeDocument[] {
    const documents: NFSeDocument[] = [];

    const nfseRoot = parsed.nfse || parsed.nfseproc;
    if (nfseRoot) {
      const nfses = Array.isArray(nfseRoot) ? nfseRoot : [nfseRoot];
      for (const nfse of nfses) {
        const doc = this.extractFromNfse(nfse);
        if (doc) documents.push(doc);
      }
    }

    if (parsed.rps || parsed.loterps) {
      const rpsList = parsed.loterps?.listarps?.rps || parsed.rps;
      if (rpsList) {
        const rpsArray = Array.isArray(rpsList) ? rpsList : [rpsList];
        for (const rps of rpsArray) {
          const doc = this.extractFromRps(rps);
          if (doc) documents.push(doc);
        }
      }
    }

    return documents;
  }

  private extractFromNfse(nfse: any): NFSeDocument | null {
    const inf = nfse.infnfse || nfse;
    if (!inf) return null;

    const prestador = inf.prestadorservico || inf.prestador || {};
    const tomador = inf.tomadorservico || inf.tomador || {};
    const servico = inf.servico || inf.declaracaoprestacaoservico?.servico || {};

    return {
      tipo: XmlDocumentType.NFSE,
      numeroNota: this.str(inf.numero || inf.numeronfse),
      dataEmissao: this.str(inf.dataemissao || inf.competencia),
      cnpjPrestador: this.str(
        prestador.cnpj ||
          prestador.identificacaoprestador?.cnpj ||
          prestador.identificacaoprestador?.cpfcnpj?.cnpj
      ),
      iePrestador: this.str(prestador.ie || 'ISENTO'),
      razaoSocialPrestador: this.str(prestador.razaosocial || prestador.nomefantasia),
      cnpjTomador: this.str(
        tomador.cnpj ||
          tomador.identificacaotomador?.cnpj ||
          tomador.identificacaotomador?.cpfcnpj?.cnpj
      ),
      razaoSocialTomador: this.str(tomador.razaosocial || tomador.nomefantasia),
      valorServicos: this.num(
        inf.valorservicos || servico.valores?.valorservicos || inf.valortotalservicos
      ),
      valorIss: this.num(inf.valoriss || servico.valores?.valoriss),
      aliquotaIss: this.num(inf.aliquota || servico.valores?.aliquota),
      codigoServico: this.str(
        inf.codigoservico || servico.itemlistaservico || servico.codigotributacaomunicipio
      ),
      descricaoServico: this.str(inf.descricaoservico || servico.discriminacao),
      municipioPrestacao: this.str(
        inf.municipioprestacao || servico.codigomunicipio || prestador.endereco?.codigomunicipio
      ),
      ufPrestacao: this.str(inf.uf || prestador.endereco?.uf || 'MG'),
    };
  }

  private extractFromRps(rps: any): NFSeDocument | null {
    const inf = rps.infrps || rps;
    if (!inf) return null;

    const prestador = inf.prestador || {};
    const tomador = inf.tomador || {};
    const servico = inf.servico || {};

    return {
      tipo: XmlDocumentType.NFSE,
      numeroNota: this.str(inf.identificacaorps?.numero || inf.numero),
      dataEmissao: this.str(inf.dataemissao || inf.competencia),
      cnpjPrestador: this.str(
        prestador.cnpj || prestador.cpfcnpj?.cnpj
      ),
      iePrestador: 'ISENTO',
      razaoSocialPrestador: this.str(prestador.razaosocial),
      cnpjTomador: this.str(
        tomador.cnpj || tomador.identificacaotomador?.cpfcnpj?.cnpj
      ),
      razaoSocialTomador: this.str(tomador.razaosocial),
      valorServicos: this.num(servico.valores?.valorservicos),
      valorIss: this.num(servico.valores?.valoriss),
      aliquotaIss: this.num(servico.valores?.aliquota),
      codigoServico: this.str(servico.itemlistaservico),
      descricaoServico: this.str(servico.discriminacao),
      municipioPrestacao: this.str(servico.codigomunicipio),
      ufPrestacao: this.str(prestador.endereco?.uf || 'MG'),
    };
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

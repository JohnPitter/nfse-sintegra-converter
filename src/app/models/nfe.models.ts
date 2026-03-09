export enum XmlDocumentType {
  NFE = 'NFE',
  NFCE = 'NFCE',
  NFSE = 'NFSE',
  UNKNOWN = 'UNKNOWN',
}

export interface DocumentItem {
  numeroItem: number;
  codigoProduto: string;
  descricao: string;
  ncm: string;
  cfop: string;
  cst: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  valorDesconto: number;
  baseCalculoIcms: number;
  baseCalculoIcmsSt: number;
  valorIcms: number;
  valorIpi: number;
  valorPis: number;
  valorCofins: number;
  aliquotaIcms: number;
  aliquotaIpi: number;
}

export interface NFeDocument {
  tipo: XmlDocumentType.NFE | XmlDocumentType.NFCE;
  numeroNota: string;
  serie: string;
  modelo: string;
  dataEmissao: string;
  cnpjEmitente: string;
  ieEmitente: string;
  razaoSocialEmitente: string;
  logradouroEmitente: string;
  numeroEnderecoEmitente: string;
  bairroEmitente: string;
  cepEmitente: string;
  municipioEmitente: string;
  codigoMunicipioEmitente: string;
  ufEmitente: string;
  telefoneEmitente: string;
  cnpjDestinatario: string;
  ieDestinatario: string;
  razaoSocialDestinatario: string;
  ufDestinatario: string;
  valorTotalNota: number;
  valorProdutos: number;
  baseCalculoIcms: number;
  valorIcms: number;
  valorIpi: number;
  valorPis: number;
  valorCofins: number;
  valorFrete: number;
  valorDesconto: number;
  valorOutros: number;
  naturezaOperacao: string;
  situacao: string;
  itens: DocumentItem[];
}

export interface NFSeDocument {
  tipo: XmlDocumentType.NFSE;
  numeroNota: string;
  dataEmissao: string;
  cnpjPrestador: string;
  iePrestador: string;
  razaoSocialPrestador: string;
  cnpjTomador: string;
  razaoSocialTomador: string;
  valorServicos: number;
  valorIss: number;
  aliquotaIss: number;
  codigoServico: string;
  descricaoServico: string;
  municipioPrestacao: string;
  ufPrestacao: string;
}

export type ParsedDocument = NFeDocument | NFSeDocument;

export interface ParseResult {
  type: XmlDocumentType;
  documents: ParsedDocument[];
  errors: string[];
}

export function isNFeDocument(doc: ParsedDocument): doc is NFeDocument {
  return doc.tipo === XmlDocumentType.NFE || doc.tipo === XmlDocumentType.NFCE;
}

export function isNFSeDocument(doc: ParsedDocument): doc is NFSeDocument {
  return doc.tipo === XmlDocumentType.NFSE;
}

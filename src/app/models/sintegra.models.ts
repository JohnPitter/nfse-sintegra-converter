export interface SintegraConfig {
  cnpj: string;
  inscricaoEstadual: string;
  razaoSocial: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  fax: string;
  contato: string;
  telefone: string;
  dtInicial: string;
  dtFinal: string;
  codEstrutura: '1' | '2' | '3';
  codNatureza: '1' | '2' | '3';
  codFinalidade: '1' | '2' | '3' | '5';
}

export interface SintegraGenerationResult {
  content: string;
  totalRecords: number;
  registerCounts: Map<string, number>;
  validationErrors: string[];
}

export const SINTEGRA_RECORD_LENGTH = 126;
export const SINTEGRA_LINE_ENDING = '\r\n';

export const DEFAULT_SINTEGRA_CONFIG: SintegraConfig = {
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
  dtInicial: '',
  dtFinal: '',
  codEstrutura: '3',
  codNatureza: '3',
  codFinalidade: '1',
};

# SINTEGRA Converter

<div align="center">

![Angular](https://img.shields.io/badge/Angular-16+-red?style=for-the-badge&logo=angular)
![TypeScript](https://img.shields.io/badge/TypeScript-5.1+-blue?style=for-the-badge&logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**Conversor de NFe, NFCe e NFSe para o formato SINTEGRA**

*Gere arquivos SINTEGRA a partir de XMLs fiscais brasileiros em conformidade com o Convenio ICMS 57/95*

[Funcionalidades](#funcionalidades) •
[Como Usar](#como-usar) •
[Registros Suportados](#registros-sintegra-suportados) •
[Instalacao](#instalacao) •
[Desenvolvimento](#desenvolvimento)

</div>

---

## Overview

O SINTEGRA Converter e uma aplicacao web que converte arquivos XML de documentos fiscais eletronicos brasileiros (NFe, NFCe, NFSe) para o formato SINTEGRA (Sistema Integrado de Informacoes sobre Operacoes Interestaduais com Mercadorias e Servicos).

**O que e o SINTEGRA?**

O SINTEGRA e uma obrigacao fiscal estabelecida pelo **Convenio ICMS 57/95** que exige que contribuintes de ICMS que utilizam sistemas de processamento eletronico de dados mantenham e enviem registros fiscais em formato digital (arquivo TXT com registros de 126 caracteres em largura fixa).

**O que voce consegue fazer:**
- Upload de arquivos XML de NFe (modelo 55), NFCe (modelo 65) e NFSe
- Deteccao automatica do tipo de documento fiscal
- Formulario de configuracao dos dados do estabelecimento
- Geracao do arquivo SINTEGRA com todos os registros obrigatorios
- Preview do arquivo gerado antes do download
- Suporte a multiplos arquivos XML em uma unica conversao

---

## Funcionalidades

| Funcionalidade | Descricao |
|----------------|-----------|
| **Deteccao Automatica** | Identifica automaticamente NFe, NFCe ou NFSe a partir da estrutura XML |
| **Parser Unificado** | Extrai todos os dados necessarios incluindo itens, impostos e totais |
| **Registros Completos** | Gera registros 10, 11, 50, 54, 75 e 90 conforme especificacao |
| **Agrupamento CFOP** | Registro 50 gerado por combinacao CFOP + aliquota (conforme spec) |
| **Tabela de Produtos** | Registro 75 com codigo unico de produtos referenciados no Registro 54 |
| **Totalizacao Correta** | Registro 90 com contagem por tipo de registro |
| **Validacao de Dados** | Validacao de CNPJ, datas, UF e campos obrigatorios |
| **Multi-arquivo** | Processa multiplos XMLs de uma vez |
| **Auto-preenchimento** | Extrai dados do emitente/prestador para configuracao |
| **Preview** | Visualiza o arquivo gerado antes de baixar |

---

## Documentos Suportados

| Documento | Modelo | Descricao |
|-----------|--------|-----------|
| **NFe** | 55 | Nota Fiscal Eletronica |
| **NFCe** | 65 | Nota Fiscal de Consumidor Eletronica |
| **NFSe** | - | Nota Fiscal de Servicos Eletronica |

---

## Registros SINTEGRA Suportados

| Registro | Descricao | Obrigatorio |
|----------|-----------|-------------|
| **10** | Identificacao do estabelecimento (cabecalho) | Sim |
| **11** | Dados complementares do estabelecimento (endereco) | Sim |
| **50** | Totais de nota fiscal por CFOP + aliquota | Sim (quando ha notas) |
| **54** | Itens de nota fiscal (detalhes por produto) | Sim (quando reg 50 existe) |
| **75** | Tabela de codigo de produto/servico | Sim (quando reg 54 existe) |
| **90** | Totalizacao do arquivo (contagem por tipo) | Sim |

### Layout dos Registros

Todos os registros seguem a especificacao oficial: **126 caracteres de largura fixa**, com campos numericos (zero-padded, alinhados a direita) e alfanumericos (space-padded, alinhados a esquerda). Valores monetarios usam 2 casas decimais implicitas.

---

## Como Usar

### 1. Upload dos XMLs

Selecione um ou mais arquivos XML de NFe, NFCe ou NFSe. O sistema detecta automaticamente o tipo de documento.

### 2. Configure os Dados do Estabelecimento

O formulario e pre-preenchido com dados extraidos do XML (CNPJ, razao social, endereco, IE). Revise e complete os campos obrigatorios:

- **CNPJ** (14 digitos)
- **Razao Social** (ate 35 caracteres)
- **Municipio** (ate 30 caracteres)
- **UF** (2 caracteres)
- **Periodo** (data inicial e final no formato YYYYMMDD)

### 3. Gere e Baixe

Clique em "Gerar Arquivo SINTEGRA", visualize o preview e faca o download do arquivo `.txt`.

---

## Instalacao

### Requisitos

| Requisito | Versao |
|-----------|--------|
| Node.js | 16+ |
| npm | 8+ |
| Angular CLI | 16.x |

### Setup

```bash
# Clone o repositorio
git clone https://github.com/JohnPitter/nfse-sintegra-converter.git
cd nfse-sintegra-converter

# Instale as dependencias
npm install

# Inicie o servidor de desenvolvimento
npm start
```

Acesse `http://localhost:4200` no navegador.

### Build de Producao

```bash
npm run build
```

Os artefatos serao gerados em `dist/nfse-sintegra-converter/`.

---

## Desenvolvimento

### Estrutura do Projeto

```
src/app/
├── models/
│   ├── nfe.models.ts          # Tipos para NFe/NFCe/NFSe
│   ├── sintegra.models.ts     # Tipos para configuracao SINTEGRA
│   └── index.ts               # Barrel export
├── services/
│   ├── xml-detector.service.ts        # Deteccao do tipo XML
│   ├── nfe-parser.service.ts          # Parser NFe/NFCe (unificado)
│   ├── nfse-parser.service.ts         # Parser NFSe
│   ├── unified-parser.service.ts      # Orquestrador de parsing
│   ├── sintegra-formatter.service.ts  # Formatacao de campos SINTEGRA
│   └── sintegra-generator.service.ts  # Geracao dos registros
├── app.component.ts           # Componente principal (3 steps)
├── app.component.html         # Template com form e preview
├── app.component.scss         # Estilos
└── app.module.ts              # Modulo Angular
```

### Arquitetura

```
XML Files → XmlDetectorService → NfeParser/NfseParser → UnifiedParserService
                                                              ↓
                                                     SintegraGeneratorService
                                                     (usa SintegraFormatterService)
                                                              ↓
                                                     Arquivo SINTEGRA (.txt)
```

### Decisoes Tecnicas

- **NFe e NFCe compartilham o mesmo parser**: ambos usam a mesma estrutura XML (`nfeProc/NFe/infNFe`), diferindo apenas pelo modelo (55 vs 65)
- **xml2js com `stripPrefix`**: remove namespaces XML para simplificar a navegacao no objeto parseado
- **Registro 50 por CFOP+aliquota**: conforme spec, uma nota com multiplos CFOPs gera multiplos registros 50
- **Registro 75 com produto unico**: cada codigo de produto aparece apenas uma vez, referenciando os registros 54
- **Valores monetarios**: multiplicados por 100 e formatados como inteiros zero-padded (formato 11v2)

---

## Referencia SINTEGRA

| Conceito | Descricao |
|----------|-----------|
| **Convenio ICMS 57/95** | Base legal que estabelece a obrigacao do arquivo magnetico |
| **CONFAZ** | Conselho Nacional de Politica Fazendaria, responsavel pela especificacao |
| **126 caracteres** | Tamanho fixo de cada linha do arquivo |
| **CR+LF** | Terminador de linha obrigatorio |
| **YYYYMMDD** | Formato de data em todos os registros |

---

## Stack Tecnologica

| Tecnologia | Uso |
|------------|-----|
| Angular 16 | Framework SPA |
| TypeScript 5.1 | Linguagem |
| xml2js | Parsing de XML |
| file-saver | Download de arquivos |
| SCSS | Estilizacao |

---

## License

MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

---

## Contributing

Contribuicoes sao bem-vindas! Por favor:
1. Fork o repositorio
2. Crie uma branch de feature
3. Submeta um pull request

---

## Suporte

- **Issues:** [GitHub Issues](https://github.com/JohnPitter/nfse-sintegra-converter/issues)
- **Discussoes:** [GitHub Discussions](https://github.com/JohnPitter/nfse-sintegra-converter/discussions)

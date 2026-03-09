# SINTEGRA Converter Complete Refactoring Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the NFe/NFCe/NFSe to SINTEGRA converter from scratch with correct SINTEGRA specification (Convenio ICMS 57/95), proper register layouts, missing registers (54, 75), and modern code architecture.

**Architecture:** Angular 16 SPA with clean separation: shared types/interfaces -> XML parsers (deduplicated) -> SINTEGRA generator (spec-compliant) -> UI with config form. All registers follow exact 126-char fixed-width layout from the official SINTEGRA specification.

**Tech Stack:** Angular 16, TypeScript, xml2js, file-saver, SCSS

---

## Critical Spec Reference

### SINTEGRA Record Rules
- Every line MUST be exactly **126 characters**
- Line endings: CR+LF (`\r\n`)
- Numeric (N): right-aligned, zero-padded
- Alphanumeric (X): left-aligned, space-padded
- Monetary values: 2 implied decimal places (13 chars = 11v2 format, e.g., `0000000001500` = R$15.00)
- Quantities: 3 implied decimal places in register 54
- Dates: YYYYMMDD

### Register Layouts (from spec)

**Reg 10** (126 chars): tipo(2N) + cnpj(14N) + ie(14X) + nome(35X) + municipio(30X) + uf(2X) + fax(10N) + dt_ini(8N) + dt_fim(8N) + cod_estrutura(1X) + cod_natureza(1X) + cod_finalidade(1X) = 126

**Reg 11** (126 chars): tipo(2N) + logradouro(34X) + numero(5N) + complemento(22X) + bairro(15X) + cep(8N) + contato(28X) + telefone(12N) = 126

**Reg 50** (126 chars): tipo(2N) + cnpj(14N) + ie(14X) + data(8N) + uf(2X) + modelo(2N) + serie(3X) + numero(6N) + cfop(4N) + emitente(1X) + vl_total(13N,11v2) + bc_icms(13N,11v2) + vl_icms(13N,11v2) + isenta(13N,11v2) + outras(13N,11v2) + aliquota(4N,2v2) + situacao(1X) = 126

**Reg 51** (126 chars): tipo(2N) + cnpj(14N) + ie(14X) + data(8N) + uf(2X) + serie(3X) + numero(6N) + cfop(4N) + vl_total(13N,11v2) + vl_ipi(13N,11v2) + isenta_ipi(13N,11v2) + outras_ipi(13N,11v2) + brancos(20X) + situacao(1X) = 126

**Reg 54** (126 chars): tipo(2N) + cnpj(14N) + modelo(2N) + serie(3X) + numero(6N) + cfop(4N) + cst(3X) + num_item(3N) + cod_produto(14X) + quantidade(11N,8v3) + vl_produto(12N,10v2) + desconto(12N,10v2) + bc_icms(12N,10v2) + bc_icms_st(12N,10v2) + vl_ipi(12N,10v2) + aliquota(4N,2v2) = 126

**Reg 75** (126 chars): tipo(2N) + dt_ini(8N) + dt_fim(8N) + cod_produto(14X) + cod_ncm(8X) + descricao(53X) + unidade(6X) + aliq_ipi(5N,3v2) + aliq_icms(4N,2v2) + reducao_bc(5N,3v2) + bc_icms_st(13N,11v2) = 126

**Reg 90** (126 chars): tipo(2N) + cnpj(14N) + ie(14X) + [tipo_reg(2N) + qtd(8N)]* + brancos + num_reg90(1N) at position 126

---

## Task 1: Initialize Git and Create Branch Structure

**Files:**
- Create: `.gitignore` (update)

**Step 1: Initialize git repository**
```bash
git init
git add -A
git commit -m "chore: initial commit with original Angular 16 codebase"
```

**Step 2: Create main branch and feature branch**
```bash
git branch -M main
git checkout -b refactor/sintegra-complete-rewrite
```

---

## Task 2: Create Shared Types and Interfaces

**Files:**
- Create: `src/app/models/sintegra.models.ts`
- Create: `src/app/models/nfe.models.ts`
- Create: `src/app/models/index.ts`

**Step 1: Create SINTEGRA models with all register types and config interface**

`src/app/models/sintegra.models.ts` - Contains:
- `SintegraConfig` interface (company data: cnpj, ie, razaoSocial, endereco, numero, complemento, bairro, cep, municipio, uf, fax, contato, telefone, dtInicial, dtFinal, codEstrutura, codNatureza, codFinalidade)
- `SintegraRecord` base interface
- `RegisterType` enum

**Step 2: Create NFe/NFCe/NFSe unified models**

`src/app/models/nfe.models.ts` - Contains:
- `XmlDocumentType` enum (NFE, NFCE, NFSE, UNKNOWN)
- `DocumentItem` interface (shared between NFe/NFCe)
- `NFeDocument` interface (all NFe/NFCe fields)
- `NFSeDocument` interface (service-specific fields)
- `ParsedDocument` union type
- `ParseResult` interface

**Step 3: Create barrel export**

`src/app/models/index.ts`

---

## Task 3: Rewrite XML Parsers (Deduplicated)

**Files:**
- Rewrite: `src/app/services/xml-detector.service.ts`
- Rewrite: `src/app/services/nfe-parser.service.ts` (handles both NFe and NFCe)
- Rewrite: `src/app/services/nfse-parser.service.ts`
- Delete: `src/app/services/nfce-parser.service.ts` (merged into nfe-parser)
- Rewrite: `src/app/services/unified-parser.service.ts`

Key changes:
- NFe and NFCe share the same XML structure (differ only by model 55 vs 65), so merge into single parser
- Handle XML namespaces properly (the test XML uses `xmlns` which xml2js normalizes with `normalizeTags`)
- Extract helper functions for reading nested XML safely
- Parse ALL item-level data (needed for registers 54/75)

---

## Task 4: Rewrite SINTEGRA Generator (Spec-Compliant)

**Files:**
- Rewrite: `src/app/services/sintegra-generator.service.ts`
- Create: `src/app/services/sintegra-formatter.service.ts`

Key changes:

**sintegra-formatter.service.ts** - Pure utility:
- `formatNumeric(value: number | string, length: number): string` - zero-padded right-aligned
- `formatAlpha(value: string, length: number): string` - space-padded left-aligned
- `formatMoney(value: number, length: number): string` - value * 100, zero-padded
- `formatQuantity(value: number, length: number, decimals: number): string`
- `formatDate(date: string | Date): string` - YYYYMMDD
- `formatCNPJ(cnpj: string): string` - 14 digits, validated
- `assertLength(record: string, expected: number): string` - throws if wrong length

**sintegra-generator.service.ts** - Register generation:
- `generateRegister10(config: SintegraConfig): string` - CORRECT 126-char layout
- `generateRegister11(config: SintegraConfig): string` - CORRECT 126-char layout
- `generateRegister50(doc: NFeDocument | NFSeDocument, config: SintegraConfig): string[]` - Per CFOP+aliquota grouping
- `generateRegister51(doc: NFeDocument): string` - Only for model 01/1A with IPI > 0
- `generateRegister54(doc: NFeDocument, cnpj: string): string[]` - One per item
- `generateRegister75(docs: NFeDocument[], config: SintegraConfig): string[]` - Unique product codes
- `generateRegister90(records: string[], config: SintegraConfig): string[]` - Counts per register type
- `generateFile(docs: ParsedDocument[], config: SintegraConfig): string` - Full file assembly

---

## Task 5: Rewrite UI Component

**Files:**
- Rewrite: `src/app/app.component.ts`
- Rewrite: `src/app/app.component.html`
- Rewrite: `src/app/app.component.scss`
- Modify: `src/app/app.module.ts` (add FormsModule, ReactiveFormsModule)

Key changes:
- Add configuration form (company data input)
- Add file preview section
- Add multi-file upload support
- Show validation results
- Better error display
- Modern UI with proper styling

---

## Task 6: Create README (j-obs format)

**Files:**
- Rewrite: `README.md`

Based on j-obs format with:
- Badges (Angular, TypeScript, License)
- Overview of what SINTEGRA is
- Features table
- Supported document types
- Installation/usage
- SINTEGRA registers supported
- Configuration
- Contributing

---

## Task 7: Git Setup and Branch Protections

**Steps:**
1. Create GitHub repository
2. Push main branch
3. Push feature branch
4. Create PR
5. Set up branch protections via `gh` CLI

---

## Execution Order

Tasks 2 -> 3 -> 4 -> 5 -> 6 -> 7 (sequential due to dependencies)
Task 1 must be first.

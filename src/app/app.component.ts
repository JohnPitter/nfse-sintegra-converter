import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UnifiedParserService } from './services/unified-parser.service';
import { SintegraGeneratorService } from './services/sintegra-generator.service';
import { SintegraFormatterService } from './services/sintegra-formatter.service';
import { SintegraConfig, SintegraGenerationResult, ParsedDocument, XmlDocumentType } from './models';
import { saveAs } from 'file-saver';

interface FileInfo {
  file: File;
  name: string;
  size: string;
}

interface ConversionRecord {
  id: string;
  timestamp: number;
  fileNames: string[];
  documentType: string;
  documentCount: number;
  totalRecords: number;
  razaoSocial: string;
  cnpj: string;
  periodo: string;
  outputFileName: string;
  content: string;
}

const HISTORY_KEY = 'sintegra-history';
const MAX_HISTORY = 20;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  configForm!: FormGroup;
  selectedFiles: FileInfo[] = [];
  parsedDocuments: ParsedDocument[] = [];
  documentType = '';
  parseErrors: string[] = [];

  isProcessing = false;
  isParsed = false;
  generationResult: SintegraGenerationResult | null = null;
  previewLines: string[] = [];

  currentStep: 'upload' | 'config' | 'result' = 'upload';
  isDarkTheme = false;
  history: ConversionRecord[] = [];

  constructor(
    private fb: FormBuilder,
    private parser: UnifiedParserService,
    private generator: SintegraGeneratorService,
    private formatter: SintegraFormatterService
  ) {
    this.initForm();
    this.loadTheme();
    this.loadHistory();
  }

  toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    this.applyTheme();
    localStorage.setItem('sintegra-theme', this.isDarkTheme ? 'dark' : 'light');
  }

  private loadTheme(): void {
    const saved = localStorage.getItem('sintegra-theme');
    this.isDarkTheme = saved === 'dark';
    this.applyTheme();
  }

  private applyTheme(): void {
    if (this.isDarkTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  private initForm(): void {
    this.configForm = this.fb.group({
      cnpj: ['', [Validators.required, Validators.pattern(/^\d{14}$/)]],
      inscricaoEstadual: ['ISENTO'],
      razaoSocial: ['', [Validators.required, Validators.maxLength(35)]],
      logradouro: ['', [Validators.maxLength(34)]],
      numero: ['', [Validators.maxLength(5)]],
      complemento: ['', [Validators.maxLength(22)]],
      bairro: ['', [Validators.maxLength(15)]],
      cep: ['', [Validators.pattern(/^\d{0,8}$/)]],
      municipio: ['', [Validators.required, Validators.maxLength(30)]],
      uf: ['MG', [Validators.required, Validators.pattern(/^[A-Z]{2}$/)]],
      fax: [''],
      contato: ['', [Validators.maxLength(28)]],
      telefone: [''],
      dtInicial: [''],
      dtFinal: [''],
      codEstrutura: ['3'],
      codNatureza: ['3'],
      codFinalidade: ['1'],
    });
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.selectedFiles = Array.from(input.files).map((f) => ({
      file: f,
      name: f.name,
      size: this.formatFileSize(f.size),
    }));

    this.generationResult = null;
    this.parseErrors = [];
    this.isParsed = false;
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.isParsed = false;
    this.generationResult = null;
  }

  async parseFiles(): Promise<void> {
    if (this.selectedFiles.length === 0) return;

    this.isProcessing = true;
    this.parseErrors = [];

    try {
      const files = this.selectedFiles.map((f) => f.file);
      const result = await this.parser.parseFiles(files);

      this.parsedDocuments = result.documents;
      this.documentType = this.parser.getTypeName(result.type);
      this.parseErrors = result.errors;

      if (result.documents.length > 0) {
        const defaultConfig = this.generator.generateDefaultConfig(result.documents);
        this.patchForm(defaultConfig);
        this.isParsed = true;
        this.currentStep = 'config';
      } else if (result.errors.length === 0) {
        this.parseErrors.push('Nenhum documento encontrado nos arquivos XML');
      }
    } catch (error) {
      this.parseErrors.push('Erro ao processar: ' + (error as Error).message);
    } finally {
      this.isProcessing = false;
    }
  }

  generateSintegra(): void {
    if (!this.configForm.valid || this.parsedDocuments.length === 0) return;

    const config = this.buildConfig();
    this.generationResult = this.generator.generateFile(this.parsedDocuments, config);

    if (this.generationResult.content) {
      this.previewLines = this.generationResult.content.split('\r\n').slice(0, 20);
      this.currentStep = 'result';
    }
  }

  downloadFile(): void {
    if (!this.generationResult?.content) return;

    const baseName =
      this.selectedFiles.length === 1
        ? this.selectedFiles[0].name.replace('.xml', '')
        : 'sintegra';

    const outputFileName = `${baseName}_sintegra.txt`;

    const blob = new Blob([this.generationResult.content], {
      type: 'text/plain;charset=utf-8',
    });
    saveAs(blob, outputFileName);

    this.saveToHistory(outputFileName);
  }

  downloadFromHistory(record: ConversionRecord): void {
    const blob = new Blob([record.content], {
      type: 'text/plain;charset=utf-8',
    });
    saveAs(blob, record.outputFileName);
  }

  removeFromHistory(id: string): void {
    this.history = this.history.filter((r) => r.id !== id);
    this.persistHistory();
  }

  clearHistory(): void {
    this.history = [];
    this.persistHistory();
  }

  private saveToHistory(outputFileName: string): void {
    if (!this.generationResult?.content) return;

    const v = this.configForm.value;
    const record: ConversionRecord = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      fileNames: this.selectedFiles.map((f) => f.name),
      documentType: this.documentType,
      documentCount: this.parsedDocuments.length,
      totalRecords: this.generationResult.totalRecords,
      razaoSocial: v.razaoSocial || '',
      cnpj: v.cnpj || '',
      periodo: v.dtInicial && v.dtFinal ? `${v.dtInicial} - ${v.dtFinal}` : '',
      outputFileName,
      content: this.generationResult.content,
    };

    this.history = [record, ...this.history].slice(0, MAX_HISTORY);
    this.persistHistory();
  }

  private loadHistory(): void {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      this.history = raw ? JSON.parse(raw) : [];
    } catch {
      this.history = [];
    }
  }

  private persistHistory(): void {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
    } catch {
      // localStorage full — remove oldest entries and retry
      this.history = this.history.slice(0, Math.max(1, this.history.length - 5));
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
      } catch {
        // give up silently
      }
    }
  }

  formatHistoryDate(timestamp: number): string {
    const d = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  formatCnpj(cnpj: string): string {
    if (cnpj.length !== 14) return cnpj;
    return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
  }

  goToStep(step: 'upload' | 'config' | 'result'): void {
    this.currentStep = step;
  }

  private patchForm(config: SintegraConfig): void {
    this.configForm.patchValue({
      cnpj: config.cnpj.replace(/\D/g, '').substring(0, 14),
      inscricaoEstadual: (config.inscricaoEstadual || 'ISENTO').substring(0, 14),
      razaoSocial: config.razaoSocial.substring(0, 35),
      logradouro: config.logradouro.substring(0, 34),
      numero: config.numero.substring(0, 5),
      complemento: config.complemento.substring(0, 22),
      bairro: config.bairro.substring(0, 15),
      cep: config.cep.replace(/\D/g, '').substring(0, 8),
      municipio: config.municipio.substring(0, 30),
      uf: config.uf.substring(0, 2),
      telefone: config.telefone.replace(/\D/g, '').substring(0, 12),
      dtInicial: config.dtInicial,
      dtFinal: config.dtFinal,
      codEstrutura: config.codEstrutura,
      codNatureza: config.codNatureza,
      codFinalidade: config.codFinalidade,
    });
  }

  private buildConfig(): SintegraConfig {
    const v = this.configForm.value;
    return {
      cnpj: v.cnpj,
      inscricaoEstadual: v.inscricaoEstadual || 'ISENTO',
      razaoSocial: v.razaoSocial,
      logradouro: v.logradouro || '',
      numero: v.numero || '',
      complemento: v.complemento || '',
      bairro: v.bairro || '',
      cep: v.cep || '',
      municipio: v.municipio,
      uf: v.uf,
      fax: v.fax || '',
      contato: v.contato || '',
      telefone: v.telefone || '',
      dtInicial: v.dtInicial || this.formatter.formatDate(this.formatter.getFirstDayOfMonth()),
      dtFinal: v.dtFinal || this.formatter.formatDate(this.formatter.getLastDayOfMonth()),
      codEstrutura: v.codEstrutura || '3',
      codNatureza: v.codNatureza || '3',
      codFinalidade: v.codFinalidade || '1',
    };
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

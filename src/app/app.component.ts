import { Component } from '@angular/core';
import { UnifiedParserService, UnifiedData } from './services/unified-parser.service';
import { SintegraGeneratorService } from './services/sintegra-generator.service';
import { saveAs } from 'file-saver';

interface ConversionResult {
  documentCount: number;
  sintegraContent: string;
  documentType: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'nfse-sintegra-converter';
  selectedFile: File | null = null;
  isProcessing = false;
  conversionResult: ConversionResult | null = null;
  errorMessage: string | null = null;

  constructor(
    private unifiedParser: UnifiedParserService,
    private sintegraGenerator: SintegraGeneratorService
  ) {}

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      this.selectedFile = target.files[0];
      this.conversionResult = null;
      this.errorMessage = null;
    }
  }

  async convertFile(): Promise<void> {
    if (!this.selectedFile) return;

    this.isProcessing = true;
    this.errorMessage = null;

    try {
      const parseResult = await this.unifiedParser.parseXmlFile(this.selectedFile);
      const config = this.sintegraGenerator.generateSintegraConfigurationFromData(parseResult.data);
      const sintegraContent = this.sintegraGenerator.generateSintegraFile(parseResult.data, config);
      
      this.conversionResult = {
        documentCount: parseResult.data.length,
        sintegraContent,
        documentType: this.unifiedParser.getXmlTypeName(parseResult.type)
      };
    } catch (error) {
      this.errorMessage = 'Error converting file: ' + (error as Error).message;
    } finally {
      this.isProcessing = false;
    }
  }

  downloadSintegraFile(): void {
    if (!this.conversionResult) return;

    const blob = new Blob([this.conversionResult.sintegraContent], {
      type: 'text/plain;charset=utf-8'
    });
    
    const fileName = this.selectedFile?.name.replace('.xml', '_sintegra.txt') || 'sintegra.txt';
    saveAs(blob, fileName);
  }
}

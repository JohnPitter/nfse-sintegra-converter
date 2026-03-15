import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { AppComponent } from './app.component';
import { UnifiedParserService } from './services/unified-parser.service';
import { SintegraGeneratorService } from './services/sintegra-generator.service';
import { SintegraFormatterService } from './services/sintegra-formatter.service';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFile(name: string, size = 1024): File {
  return new File(['<xml/>'], name, { type: 'text/xml' });
}

function makeDragEvent(
  type: string,
  files: File[] = [],
  relatedTarget: EventTarget | null = null
): DragEvent {
  const dataTransfer = {
    files: {
      length: files.length,
      item: (i: number) => files[i] ?? null,
      [Symbol.iterator]: function* () {
        yield* files;
      },
    } as unknown as FileList,
  } as DataTransfer;

  const event = new DragEvent(type, {
    bubbles: true,
    cancelable: true,
    dataTransfer,
    relatedTarget,
  });
  return event;
}

// ── mocks ─────────────────────────────────────────────────────────────────────

class MockUnifiedParserService {
  async parseFiles(_files: File[]) {
    return { documents: [], errors: [], type: 0 };
  }
  getTypeName(_type: number) { return ''; }
}

class MockSintegraGeneratorService {
  generateDefaultConfig(_docs: unknown[]) {
    return {
      cnpj: '00000000000000',
      inscricaoEstadual: 'ISENTO',
      razaoSocial: 'TEST',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cep: '',
      municipio: 'SAO PAULO',
      uf: 'SP',
      fax: '',
      contato: '',
      telefone: '',
      dtInicial: '20240101',
      dtFinal: '20240131',
      codEstrutura: '3',
      codNatureza: '3',
      codFinalidade: '1',
    };
  }
  generateFile(_docs: unknown[], _config: unknown) {
    return { content: '', totalRecords: 0, validationErrors: [] };
  }
}

class MockSintegraFormatterService {
  formatDate(d: Date) { return d.toISOString().slice(0, 10).replace(/-/g, ''); }
  getFirstDayOfMonth() { return new Date(); }
  getLastDayOfMonth() { return new Date(); }
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('AppComponent — Drag and Drop', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: UnifiedParserService,   useClass: MockUnifiedParserService   },
        { provide: SintegraGeneratorService, useClass: MockSintegraGeneratorService },
        { provide: SintegraFormatterService, useClass: MockSintegraFormatterService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── isDragging state ────────────────────────────────────────────────────────

  describe('onDragOver()', () => {
    it('should set isDragging to true', () => {
      const event = makeDragEvent('dragover');
      expect(component.isDragging).toBeFalse();
      component.onDragOver(event);
      expect(component.isDragging).toBeTrue();
    });

    it('should call event.preventDefault() to block browser default file-open', () => {
      const event = makeDragEvent('dragover');
      spyOn(event, 'preventDefault');
      component.onDragOver(event);
      expect(event.preventDefault).toHaveBeenCalledOnceWith();
    });

    it('should call event.stopPropagation()', () => {
      const event = makeDragEvent('dragover');
      spyOn(event, 'stopPropagation');
      component.onDragOver(event);
      expect(event.stopPropagation).toHaveBeenCalledOnceWith();
    });
  });

  // ── onDragLeave ─────────────────────────────────────────────────────────────

  describe('onDragLeave()', () => {
    it('should clear isDragging when pointer leaves the dropzone boundary (relatedTarget is null)', () => {
      component.isDragging = true;
      const event = makeDragEvent('dragleave', [], null);
      component.onDragLeave(event);
      expect(component.isDragging).toBeFalse();
    });

    it('should NOT clear isDragging when relatedTarget is a child of the dropzone (prevents flicker)', () => {
      component.isDragging = true;
      // Build a real DOM tree so .contains() works correctly
      const dropzone = document.createElement('div');
      const child = document.createElement('span');
      dropzone.appendChild(child);
      document.body.appendChild(dropzone);

      const event = makeDragEvent('dragleave', [], child);
      // Override currentTarget to our div
      Object.defineProperty(event, 'currentTarget', { value: dropzone, writable: false });

      component.onDragLeave(event);
      expect(component.isDragging).toBeTrue();

      document.body.removeChild(dropzone);
    });

    it('should clear isDragging when relatedTarget is outside the dropzone', () => {
      component.isDragging = true;
      const dropzone = document.createElement('div');
      const outside = document.createElement('div');
      document.body.appendChild(dropzone);
      document.body.appendChild(outside);

      const event = makeDragEvent('dragleave', [], outside);
      Object.defineProperty(event, 'currentTarget', { value: dropzone, writable: false });

      component.onDragLeave(event);
      expect(component.isDragging).toBeFalse();

      document.body.removeChild(dropzone);
      document.body.removeChild(outside);
    });

    it('should call preventDefault and stopPropagation', () => {
      const event = makeDragEvent('dragleave', [], null);
      spyOn(event, 'preventDefault');
      spyOn(event, 'stopPropagation');
      component.onDragLeave(event);
      expect(event.preventDefault).toHaveBeenCalledOnceWith();
      expect(event.stopPropagation).toHaveBeenCalledOnceWith();
    });
  });

  // ── onDrop ───────────────────────────────────────────────────────────────────

  describe('onDrop()', () => {
    it('should reset isDragging after drop', () => {
      component.isDragging = true;
      const xml = makeFile('nfe.xml');
      const event = makeDragEvent('drop', [xml]);
      component.onDrop(event);
      expect(component.isDragging).toBeFalse();
    });

    it('should call event.preventDefault() to prevent browser opening the file', () => {
      const event = makeDragEvent('drop', [makeFile('a.xml')]);
      spyOn(event, 'preventDefault');
      component.onDrop(event);
      expect(event.preventDefault).toHaveBeenCalledOnceWith();
    });

    it('should call event.stopPropagation()', () => {
      const event = makeDragEvent('drop', [makeFile('a.xml')]);
      spyOn(event, 'stopPropagation');
      component.onDrop(event);
      expect(event.stopPropagation).toHaveBeenCalledOnceWith();
    });

    it('should add .xml files to selectedFiles', () => {
      const xml1 = makeFile('nota1.xml');
      const xml2 = makeFile('nota2.xml');
      const event = makeDragEvent('drop', [xml1, xml2]);
      component.onDrop(event);
      expect(component.selectedFiles.length).toBe(2);
      expect(component.selectedFiles[0].name).toBe('nota1.xml');
      expect(component.selectedFiles[1].name).toBe('nota2.xml');
    });

    it('should silently ignore non-xml files when mixed with xml files', () => {
      const xml = makeFile('nota.xml');
      const pdf = makeFile('nota.pdf');
      const event = makeDragEvent('drop', [xml, pdf]);
      component.onDrop(event);
      // Only the xml file should be added
      expect(component.selectedFiles.length).toBe(1);
      expect(component.selectedFiles[0].name).toBe('nota.xml');
    });

    it('should set a user-facing error when ALL dropped files are non-xml', () => {
      const pdf = makeFile('nota.pdf');
      const doc = makeFile('nota.docx');
      const event = makeDragEvent('drop', [pdf, doc]);
      component.onDrop(event);
      expect(component.selectedFiles.length).toBe(0);
      expect(component.parseErrors.length).toBeGreaterThan(0);
      expect(component.parseErrors[0]).toContain('.xml');
    });

    it('should replace previous selection on a new drop', () => {
      const first = makeFile('old.xml');
      component.onDrop(makeDragEvent('drop', [first]));
      expect(component.selectedFiles.length).toBe(1);

      const second = makeFile('new.xml');
      component.onDrop(makeDragEvent('drop', [second]));
      expect(component.selectedFiles.length).toBe(1);
      expect(component.selectedFiles[0].name).toBe('new.xml');
    });

    it('should reset isParsed and generationResult when new files are dropped', () => {
      component.isParsed = true;
      component.generationResult = { content: 'DATA', totalRecords: 1, validationErrors: [] };
      component.onDrop(makeDragEvent('drop', [makeFile('a.xml')]));
      expect(component.isParsed).toBeFalse();
      expect(component.generationResult).toBeNull();
    });

    it('should do nothing when dataTransfer has no files', () => {
      component.isDragging = true;
      const event = makeDragEvent('drop', []);
      component.onDrop(event);
      // isDragging must still be reset
      expect(component.isDragging).toBeFalse();
      expect(component.selectedFiles.length).toBe(0);
    });

    it('should accept .XML files (uppercase extension)', () => {
      const upperXml = makeFile('NOTA.XML');
      const event = makeDragEvent('drop', [upperXml]);
      component.onDrop(event);
      expect(component.selectedFiles.length).toBe(1);
    });

    it('should accept .Xml files (mixed-case extension)', () => {
      const mixedXml = makeFile('Nota.Xml');
      const event = makeDragEvent('drop', [mixedXml]);
      component.onDrop(event);
      expect(component.selectedFiles.length).toBe(1);
    });

    it('should clear previous parseErrors on a successful xml drop', () => {
      component.parseErrors = ['previous error'];
      component.onDrop(makeDragEvent('drop', [makeFile('a.xml')]));
      expect(component.parseErrors.length).toBe(0);
    });
  });

  // ── addFiles (shared path with file-input onChange) ───────────────────────

  describe('onFilesSelected() — shared addFiles path', () => {
    it('should populate selectedFiles from the file input', () => {
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', {
        value: {
          0: makeFile('input.xml'),
          length: 1,
          item: (i: number) => (i === 0 ? makeFile('input.xml') : null),
          [Symbol.iterator]: function* () { yield makeFile('input.xml'); },
        } as unknown as FileList,
        writable: false,
      });
      const event = new Event('change');
      Object.defineProperty(event, 'target', { value: input, writable: false });
      component.onFilesSelected(event);
      expect(component.selectedFiles.length).toBe(1);
    });

    it('should do nothing when input.files is null', () => {
      const input = document.createElement('input');
      const event = new Event('change');
      Object.defineProperty(event, 'target', { value: input, writable: false });
      component.onFilesSelected(event);
      expect(component.selectedFiles.length).toBe(0);
    });
  });

  // ── template binding cross-check ──────────────────────────────────────────

  describe('Template bindings', () => {
    it('should apply drag-over CSS class to the dropzone when isDragging is true', () => {
      component.isDragging = false;
      fixture.detectChanges();
      const dropzone: HTMLElement = fixture.nativeElement.querySelector('.dropzone');
      expect(dropzone.classList.contains('drag-over')).toBeFalse();

      component.isDragging = true;
      fixture.detectChanges();
      expect(dropzone.classList.contains('drag-over')).toBeTrue();
    });

    it('should show "Solte para adicionar!" text in the dropzone when dragging', () => {
      component.isDragging = true;
      fixture.detectChanges();
      const text: HTMLElement = fixture.nativeElement.querySelector('.dropzone-text');
      expect(text.textContent).toContain('Solte para adicionar');
    });

    it('should show default text when not dragging', () => {
      component.isDragging = false;
      fixture.detectChanges();
      const text: HTMLElement = fixture.nativeElement.querySelector('.dropzone-text');
      expect(text.textContent).toContain('Selecionar arquivos');
    });

    it('should update aria-label on the dropzone to guide screen-reader users when dragging', () => {
      component.isDragging = true;
      fixture.detectChanges();
      const dropzone: HTMLElement = fixture.nativeElement.querySelector('.dropzone');
      expect(dropzone.getAttribute('aria-label')).toContain('Solte os arquivos');
    });
  });

  // ── formatFileSize ────────────────────────────────────────────────────────

  describe('addFiles() — file size formatting', () => {
    it('should format sizes in bytes correctly', () => {
      const event = makeDragEvent('drop', [makeFile('a.xml')]);
      // The File constructor with content '<xml/>' will have 6 bytes
      component.onDrop(event);
      expect(component.selectedFiles[0].size).toMatch(/B$/);
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { SintegraGeneratorService, SintegraConfiguration } from './sintegra-generator.service';
import { NFSeData } from './nfse-parser.service';

describe('SintegraGeneratorService', () => {
  let service: SintegraGeneratorService;
  let mockConfig: SintegraConfiguration;
  let mockNfseData: NFSeData[];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SintegraGeneratorService);
    
    mockConfig = {
      cnpj: '12.345.678/0001-90',
      inscricaoEstadual: 'IE123456789',
      razaoSocial: 'Empresa Teste LTDA',
      municipio: 'Belo Horizonte',
      uf: 'MG',
      codigoMunicipio: '31372',
      cep: '30.112-000',
      telefone: '(31) 3333-4444',
      codigoAtividadeEconomica: '1234567',
      dtInicial: '2023-01-01',
      dtFinal: '2023-12-31',
      codigoIdentificacaoConvenio: '1',
      codigoFinalidadeArquivo: '1',
      codigoNaturezaOperacao: '00'
    };

    mockNfseData = [
      {
        numeroNota: '123',
        dataEmissao: '2023-06-15',
        cnpjPrestador: '12.345.678/0001-90',
        razaoSocialPrestador: 'Prestador Teste',
        cnpjTomador: '98.765.432/0001-10',
        razaoSocialTomador: 'Tomador Teste',
        valorServicos: 1000.50,
        valorIss: 50.02,
        codigoServico: '1401',
        descricaoServico: 'Serviço de consultoria'
      }
    ];
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateSintegraFile', () => {
    it('should generate complete SINTEGRA file with correct structure', () => {
      const result = service.generateSintegraFile(mockNfseData, mockConfig);
      const lines = result.split('\r\n');
      
      expect(lines.length).toBe(5); // 10, 11, 50, 51, 90
      expect(lines[0].startsWith('10')).toBeTruthy();
      expect(lines[1].startsWith('11')).toBeTruthy();
      expect(lines[2].startsWith('50')).toBeTruthy();
      expect(lines[3].startsWith('51')).toBeTruthy();
      expect(lines[4].startsWith('90')).toBeTruthy();
    });

    it('should use CRLF line endings', () => {
      const result = service.generateSintegraFile(mockNfseData, mockConfig);
      expect(result.includes('\r\n')).toBeTruthy();
      expect(result.includes('\n') && !result.includes('\r\n')).toBeFalsy();
    });
  });

  describe('generateRegister10', () => {
    it('should generate register 10 with correct format and length', () => {
      const result = service['generateRegister10'](mockConfig);
      
      expect(result.length).toBe(126);
      expect(result.startsWith('10')).toBeTruthy();
      expect(result.substring(2, 16)).toBe('12345678000190'); // CNPJ
      expect(result.substring(16, 30)).toBe('IE123456789   '); // IE padded
      expect(result.substring(30, 65)).toBe('Empresa Teste LTDA                 '); // Razão social
      expect(result.substring(65, 95)).toBe('Belo Horizonte                '); // Município
      expect(result.substring(95, 97)).toBe('MG'); // UF
      expect(result.substring(97, 105)).toBe('30112000'); // CEP
    });

    it('should handle CNPJ formatting correctly', () => {
      const result = service['generateRegister10'](mockConfig);
      const cnpjField = result.substring(2, 16);
      
      expect(cnpjField).toBe('12345678000190');
      expect(cnpjField.length).toBe(14);
    });

    it('should pad text fields correctly', () => {
      const shortConfig = { ...mockConfig, razaoSocial: 'Test' };
      const result = service['generateRegister10'](shortConfig);
      const razaoSocialField = result.substring(30, 65);
      
      expect(razaoSocialField).toBe('Test                               ');
      expect(razaoSocialField.length).toBe(35);
    });
  });

  describe('generateRegister11', () => {
    it('should generate register 11 with correct format and length', () => {
      const result = service['generateRegister11'](mockConfig);
      
      expect(result.length).toBe(126);
      expect(result.startsWith('11')).toBeTruthy();
      expect(result.substring(63, 71)).toBe('30112000'); // CEP
      expect(result.substring(99, 111)).toBe('31333334444'); // Telefone
    });

    it('should handle empty address fields', () => {
      const result = service['generateRegister11'](mockConfig);
      
      expect(result.substring(2, 36)).toBe('                                  '); // Endereço
      expect(result.substring(36, 41)).toBe('     '); // Número
      expect(result.substring(41, 63)).toBe('                      '); // Complemento
    });
  });

  describe('generateRegister50FromNFSe', () => {
    it('should generate register 50 with correct format and length', () => {
      const result = service['generateRegister50FromNFSe'](mockNfseData[0]);
      
      expect(result.length).toBe(126);
      expect(result.startsWith('50')).toBeTruthy();
      expect(result.substring(2, 16)).toBe('12345678000190'); // CNPJ Prestador
      expect(result.substring(30, 38)).toBe('20230615'); // Data emissão
      expect(result.substring(38, 40)).toBe('MG'); // UF
      expect(result.substring(43, 45)).toBe('22'); // Modelo
      expect(result.substring(45, 48)).toBe('000'); // Série
      expect(result.substring(48, 54)).toBe('000123'); // Número
      expect(result.substring(54, 58)).toBe('5933'); // CFOP
      expect(result.substring(58, 59)).toBe('P'); // Emitente
      expect(result.substring(59, 74)).toBe('000000000100050'); // Valor total
    });

    it('should format monetary values correctly', () => {
      const result = service['generateRegister50FromNFSe'](mockNfseData[0]);
      const valorField = result.substring(59, 74);
      
      expect(valorField).toBe('000000000100050'); // 1000.50 -> 100050 centavos
    });
  });

  describe('generateRegister51FromNFSe', () => {
    it('should generate register 51 with correct format and length', () => {
      const result = service['generateRegister51FromNFSe'](mockNfseData[0]);
      
      expect(result.length).toBe(126);
      expect(result.startsWith('51')).toBeTruthy();
      expect(result.substring(2, 16)).toBe('98765432000110'); // CNPJ Tomador
      expect(result.substring(30, 38)).toBe('20230615'); // Data emissão
      expect(result.substring(48, 54)).toBe('000123'); // Número
      expect(result.substring(58, 73)).toBe('000000000100050'); // Valor total
    });
  });

  describe('generateRegister90', () => {
    it('should generate register 90 with correct format and length', () => {
      const result = service['generateRegister90'](5, '12345678000190');
      
      expect(result.length).toBe(126);
      expect(result.startsWith('90')).toBeTruthy();
      expect(result.substring(2, 16)).toBe('12345678000190'); // CNPJ
      expect(result.substring(30, 38)).toBe('00000005'); // Total registros
    });

    it('should calculate total records correctly', () => {
      const result = service['generateRegister90'](10, '12345678000190');
      const totalField = result.substring(30, 38);
      
      expect(totalField).toBe('00000010');
    });
  });

  describe('formatDate', () => {
    it('should format valid dates correctly', () => {
      const result = service['formatDate']('2023-06-15');
      expect(result).toBe('20230615');
    });

    it('should handle invalid dates', () => {
      const result = service['formatDate']('invalid-date');
      expect(result).toBe('00000000');
    });

    it('should handle empty dates', () => {
      const result = service['formatDate']('');
      expect(result).toBe('00000000');
    });

    it('should handle different date formats', () => {
      const result = service['formatDate']('2023-12-25T10:30:00');
      expect(result).toBe('20231225');
    });
  });

  describe('formatValue', () => {
    it('should format monetary values correctly', () => {
      expect(service['formatValue'](1000.50)).toBe('000000000100050');
      expect(service['formatValue'](10.99)).toBe('000000000001099');
      expect(service['formatValue'](0)).toBe('000000000000000');
    });

    it('should handle decimal precision', () => {
      expect(service['formatValue'](1000.556)).toBe('000000000100056'); // Rounded
      expect(service['formatValue'](1000.554)).toBe('000000000100055'); // Rounded
    });

    it('should handle invalid values', () => {
      expect(service['formatValue'](NaN)).toBe('000000000000000');
      expect(service['formatValue'](null as any)).toBe('000000000000000');
      expect(service['formatValue'](undefined as any)).toBe('000000000000000');
    });
  });

  describe('SINTEGRA Format Compliance', () => {
    it('should generate all lines with exactly 126 characters', () => {
      const result = service.generateSintegraFile(mockNfseData, mockConfig);
      const lines = result.split('\r\n');
      
      lines.forEach((line, index) => {
        expect(line.length).toBe(126, `Line ${index + 1} should be 126 characters`);
      });
    });

    it('should generate registers in correct order', () => {
      const result = service.generateSintegraFile(mockNfseData, mockConfig);
      const lines = result.split('\r\n');
      
      expect(lines[0].startsWith('10')).toBeTruthy();
      expect(lines[1].startsWith('11')).toBeTruthy();
      expect(lines[2].startsWith('50')).toBeTruthy();
      expect(lines[3].startsWith('51')).toBeTruthy();
      expect(lines[4].startsWith('90')).toBeTruthy();
    });

    it('should handle multiple NFSe records', () => {
      const multipleNfse = [
        mockNfseData[0],
        {
          ...mockNfseData[0],
          numeroNota: '124',
          valorServicos: 2000.75
        }
      ];
      
      const result = service.generateSintegraFile(multipleNfse, mockConfig);
      const lines = result.split('\r\n');
      
      expect(lines.length).toBe(7); // 10, 11, 50, 51, 50, 51, 90
      expect(lines[0].startsWith('10')).toBeTruthy();
      expect(lines[1].startsWith('11')).toBeTruthy();
      expect(lines[2].startsWith('50')).toBeTruthy();
      expect(lines[3].startsWith('51')).toBeTruthy();
      expect(lines[4].startsWith('50')).toBeTruthy();
      expect(lines[5].startsWith('51')).toBeTruthy();
      expect(lines[6].startsWith('90')).toBeTruthy();
    });

    it('should calculate correct total records in register 90', () => {
      const multipleNfse = [mockNfseData[0], { ...mockNfseData[0], numeroNota: '124' }];
      const result = service.generateSintegraFile(multipleNfse, mockConfig);
      const lines = result.split('\r\n');
      const register90 = lines[lines.length - 1];
      
      const totalRecords = register90.substring(30, 38);
      expect(totalRecords).toBe('00000006'); // 2 NFSe * 2 registers + 2 header registers
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty NFSe array', () => {
      const result = service.generateSintegraFile([], mockConfig);
      const lines = result.split('\r\n');
      
      expect(lines.length).toBe(3); // Only 10, 11, 90
      expect(lines[0].startsWith('10')).toBeTruthy();
      expect(lines[1].startsWith('11')).toBeTruthy();
      expect(lines[2].startsWith('90')).toBeTruthy();
    });

    it('should handle very long text fields by truncating', () => {
      const longConfig = {
        ...mockConfig,
        razaoSocial: 'Esta é uma razão social muito longa que deve ser truncada para caber no campo'
      };
      
      const result = service['generateRegister10'](longConfig);
      const razaoSocialField = result.substring(30, 65);
      
      expect(razaoSocialField.length).toBe(35);
      expect(razaoSocialField).toBe('Esta é uma razão social muito longa');
    });

    it('should handle missing optional fields', () => {
      const incompleteNfse = {
        ...mockNfseData[0],
        cnpjTomador: '',
        valorServicos: 0
      };
      
      const result50 = service['generateRegister50FromNFSe'](incompleteNfse);
      const result51 = service['generateRegister51FromNFSe'](incompleteNfse);
      
      expect(result50.length).toBe(126);
      expect(result51.length).toBe(126);
    });
  });
});
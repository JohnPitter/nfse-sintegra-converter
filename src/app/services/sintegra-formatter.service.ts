import { Injectable } from '@angular/core';
import { SINTEGRA_RECORD_LENGTH } from '../models';

@Injectable({
  providedIn: 'root',
})
export class SintegraFormatterService {
  formatNumeric(value: string | number, length: number): string {
    const clean = String(value).replace(/\D/g, '');
    return clean.padStart(length, '0').substring(0, length);
  }

  formatAlpha(value: string, length: number): string {
    const normalized = (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();
    return normalized.padEnd(length, ' ').substring(0, length);
  }

  formatMoney(value: number, length: number): string {
    if (!value || isNaN(value)) {
      return '0'.padStart(length, '0');
    }
    const centavos = Math.round(value * 100);
    return Math.abs(centavos).toString().padStart(length, '0').substring(0, length);
  }

  formatQuantity(value: number, length: number, decimals: number = 3): string {
    if (!value || isNaN(value)) {
      return '0'.padStart(length, '0');
    }
    const multiplier = Math.pow(10, decimals);
    const intValue = Math.round(value * multiplier);
    return Math.abs(intValue).toString().padStart(length, '0').substring(0, length);
  }

  formatDate(dateInput: string | Date): string {
    if (!dateInput) return '00000000';

    let date: Date;

    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      if (dateInput.includes('T')) {
        date = new Date(dateInput);
      } else if (dateInput.includes('/')) {
        const parts = dateInput.split('/');
        if (parts.length === 3) {
          date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else {
          return '00000000';
        }
      } else if (dateInput.length === 8 && /^\d{8}$/.test(dateInput)) {
        return dateInput;
      } else if (dateInput.includes('-')) {
        date = new Date(dateInput + 'T00:00:00');
      } else {
        return '00000000';
      }
    } else {
      return '00000000';
    }

    if (isNaN(date.getTime())) return '00000000';

    const year = date.getFullYear().toString().padStart(4, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return year + month + day;
  }

  formatCNPJ(cnpj: string): string {
    const clean = (cnpj || '').replace(/\D/g, '');
    return clean.padStart(14, '0').substring(0, 14);
  }

  validateCNPJ(cnpj: string): boolean {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(clean)) return false;
    return true;
  }

  assertLength(record: string, label: string): string {
    if (record.length !== SINTEGRA_RECORD_LENGTH) {
      throw new Error(
        `Registro ${label} com tamanho incorreto: ${record.length} (esperado: ${SINTEGRA_RECORD_LENGTH})`
      );
    }
    return record;
  }

  getFirstDayOfMonth(referenceDate?: Date): Date {
    const ref = referenceDate || new Date();
    return new Date(ref.getFullYear(), ref.getMonth(), 1);
  }

  getLastDayOfMonth(referenceDate?: Date): Date {
    const ref = referenceDate || new Date();
    return new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  }
}

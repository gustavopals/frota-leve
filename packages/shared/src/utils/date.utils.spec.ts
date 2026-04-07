import { daysBetween, daysUntilExpiry, formatDateBR, isExpired } from './date.utils';

describe('formatDateBR', () => {
  it('formata data no padrão brasileiro', () => {
    // Usa UTC para evitar ambiguidade de fuso horário no teste
    const date = new Date('2026-04-07T12:00:00.000Z');
    const result = formatDateBR(date);
    // Aceita 07/04/2026 independente de horário de verão
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(result).toContain('04');
    expect(result).toContain('2026');
  });

  it('aceita string de data', () => {
    const result = formatDateBR('2026-01-15T12:00:00.000Z');
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

describe('daysBetween', () => {
  it('retorna diferença em dias entre duas datas', () => {
    const a = new Date('2026-01-01');
    const b = new Date('2026-01-11');
    expect(daysBetween(a, b)).toBe(10);
  });

  it('retorna valor absoluto (ordem não importa)', () => {
    const a = new Date('2026-01-11');
    const b = new Date('2026-01-01');
    expect(daysBetween(a, b)).toBe(10);
  });

  it('retorna 0 para a mesma data', () => {
    const a = new Date('2026-04-07');
    expect(daysBetween(a, a)).toBe(0);
  });
});

describe('isExpired', () => {
  it('retorna true para data no passado', () => {
    expect(isExpired(new Date('2020-01-01'))).toBe(true);
  });

  it('retorna false para data no futuro', () => {
    expect(isExpired(new Date('2099-12-31'))).toBe(false);
  });

  it('aceita string de data', () => {
    expect(isExpired('2020-01-01')).toBe(true);
  });
});

describe('daysUntilExpiry', () => {
  it('retorna número positivo para data futura', () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    expect(daysUntilExpiry(future)).toBeGreaterThan(0);
  });

  it('retorna número negativo para data no passado', () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    expect(daysUntilExpiry(past)).toBeLessThan(0);
  });
});

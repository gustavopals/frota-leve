import { formatCNPJ, formatCPF, formatCurrency, formatPhone, formatPlate } from './format.utils';

describe('formatCNPJ', () => {
  it('formata CNPJ sem máscara', () => {
    expect(formatCNPJ('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('formata CNPJ já com máscara (remove e reformata)', () => {
    expect(formatCNPJ('12.345.678/0001-95')).toBe('12.345.678/0001-95');
  });
});

describe('formatCPF', () => {
  it('formata CPF sem máscara', () => {
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
  });

  it('formata CPF já com máscara', () => {
    expect(formatCPF('123.456.789-01')).toBe('123.456.789-01');
  });
});

describe('formatPhone', () => {
  it('formata telefone fixo (10 dígitos)', () => {
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
  });

  it('formata celular (11 dígitos)', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
  });

  it('ignora caracteres não numéricos', () => {
    expect(formatPhone('(11) 98765-4321')).toBe('(11) 98765-4321');
  });
});

describe('formatPlate', () => {
  it('formata placa no padrão antigo sem hífen', () => {
    expect(formatPlate('ABC1234')).toBe('ABC-1234');
  });

  it('mantém placa no padrão antigo com hífen', () => {
    expect(formatPlate('ABC-1234')).toBe('ABC-1234');
  });

  it('mantém placa Mercosul sem alteração', () => {
    expect(formatPlate('ABC1D23')).toBe('ABC1D23');
  });

  it('normaliza para maiúsculas', () => {
    expect(formatPlate('abc1234')).toBe('ABC-1234');
  });
});

describe('formatCurrency', () => {
  it('formata valor em reais', () => {
    expect(formatCurrency(1234.56)).toBe('R$\u00a01.234,56');
  });

  it('formata zero', () => {
    expect(formatCurrency(0)).toBe('R$\u00a00,00');
  });
});

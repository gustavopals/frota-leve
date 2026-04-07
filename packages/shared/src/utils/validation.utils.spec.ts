import { isValidCNPJ, isValidCPF, isValidPlate } from './validation.utils';

describe('isValidCNPJ', () => {
  it('aceita CNPJ válido sem máscara', () => {
    expect(isValidCNPJ('11222333000181')).toBe(true);
  });

  it('aceita CNPJ válido com máscara', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
  });

  it('rejeita CNPJ com todos os dígitos iguais', () => {
    expect(isValidCNPJ('11111111111111')).toBe(false);
  });

  it('rejeita CNPJ com comprimento errado', () => {
    expect(isValidCNPJ('1234567')).toBe(false);
  });

  it('rejeita CNPJ com dígito verificador incorreto', () => {
    expect(isValidCNPJ('11222333000182')).toBe(false);
  });
});

describe('isValidCPF', () => {
  it('aceita CPF válido sem máscara', () => {
    expect(isValidCPF('52998224725')).toBe(true);
  });

  it('aceita CPF válido com máscara', () => {
    expect(isValidCPF('529.982.247-25')).toBe(true);
  });

  it('rejeita CPF com todos os dígitos iguais', () => {
    expect(isValidCPF('11111111111')).toBe(false);
  });

  it('rejeita CPF com comprimento errado', () => {
    expect(isValidCPF('1234567')).toBe(false);
  });

  it('rejeita CPF com dígito verificador incorreto', () => {
    expect(isValidCPF('52998224726')).toBe(false);
  });
});

describe('isValidPlate', () => {
  it('aceita placa no padrão antigo sem hífen', () => {
    expect(isValidPlate('ABC1234')).toBe(true);
  });

  it('aceita placa no padrão antigo com hífen', () => {
    expect(isValidPlate('ABC-1234')).toBe(true);
  });

  it('aceita placa Mercosul', () => {
    expect(isValidPlate('ABC1D23')).toBe(true);
  });

  it('aceita placa em minúsculas', () => {
    expect(isValidPlate('abc1234')).toBe(true);
  });

  it('rejeita placa com formato inválido', () => {
    expect(isValidPlate('12AB34')).toBe(false);
    expect(isValidPlate('ABCD123')).toBe(false);
    expect(isValidPlate('AB123')).toBe(false);
  });
});

/**
 * Valida CNPJ verificando formato e dígitos verificadores.
 * Rejeita CNPJs com todos os dígitos iguais (ex: "11111111111111").
 */
export function isValidCNPJ(value: string): boolean {
  const digits = value.replace(/\D/g, '');

  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calcDigit = (base: string, weights: number[]): number => {
    const sum = base.split('').reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigit(digits.slice(0, 12), weights1);
  const d2 = calcDigit(digits.slice(0, 13), weights2);

  return parseInt(digits[12], 10) === d1 && parseInt(digits[13], 10) === d2;
}

/**
 * Valida CPF verificando formato e dígitos verificadores.
 * Rejeita CPFs com todos os dígitos iguais (ex: "11111111111").
 */
export function isValidCPF(value: string): boolean {
  const digits = value.replace(/\D/g, '');

  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calcDigit = (base: string, factor: number): number => {
    const sum = base.split('').reduce((acc, d, i) => acc + parseInt(d, 10) * (factor - i), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 || remainder === 11 ? 0 : remainder;
  };

  const d1 = calcDigit(digits.slice(0, 9), 10);
  const d2 = calcDigit(digits.slice(0, 10), 11);

  return parseInt(digits[9], 10) === d1 && parseInt(digits[10], 10) === d2;
}

/**
 * Valida placa de veículo — aceita padrão antigo (ABC-1234 ou ABC1234)
 * e padrão Mercosul (ABC1D23).
 */
export function isValidPlate(value: string): boolean {
  const plate = value.toUpperCase().replace(/[\s-]/g, '');
  const oldFormat = /^[A-Z]{3}\d{4}$/;
  const mercosulFormat = /^[A-Z]{3}\d[A-Z]\d{2}$/;
  return oldFormat.test(plate) || mercosulFormat.test(plate);
}

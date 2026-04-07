/**
 * Formata CNPJ adicionando máscara: "12345678000195" → "12.345.678/0001-95"
 */
export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Formata CPF adicionando máscara: "12345678901" → "123.456.789-01"
 */
export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

/**
 * Formata telefone brasileiro:
 * 10 dígitos (fixo): "1133334444" → "(11) 3333-4444"
 * 11 dígitos (celular): "11987654321" → "(11) 98765-4321"
 */
export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
}

/**
 * Formata placa de veículo:
 * Padrão antigo: "ABC1234" → "ABC-1234"
 * Mercosul: "ABC1D23" → "ABC1D23" (sem alteração, já é o formato padrão)
 */
export function formatPlate(value: string): string {
  const plate = value.toUpperCase().replace(/[\s-]/g, '');
  // Padrão antigo: 3 letras + 4 dígitos
  if (/^[A-Z]{3}\d{4}$/.test(plate)) {
    return plate.replace(/^([A-Z]{3})(\d{4})$/, '$1-$2');
  }
  return plate;
}

/**
 * Formata valor monetário em reais: 1234.56 → "R$ 1.234,56"
 */
export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

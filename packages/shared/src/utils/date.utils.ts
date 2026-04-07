/**
 * Formata uma data no padrão brasileiro: "DD/MM/YYYY"
 */
export function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Retorna o número de dias entre duas datas (valor absoluto).
 */
export function daysBetween(dateA: Date | string, dateB: Date | string): number {
  const a = typeof dateA === 'string' ? new Date(dateA) : dateA;
  const b = typeof dateB === 'string' ? new Date(dateB) : dateB;
  const diffMs = Math.abs(b.getTime() - a.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Verifica se uma data já expirou (está no passado em relação a hoje).
 */
export function isExpired(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() < Date.now();
}

/**
 * Retorna quantos dias faltam para a data expirar.
 * Negativo se já expirou.
 */
export function daysUntilExpiry(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = d.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

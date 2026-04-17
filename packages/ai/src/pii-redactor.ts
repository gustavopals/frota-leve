const CPF_PATTERN = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
const EMAIL_PATTERN = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
const BR_PHONE_PATTERN = /(?<!\w)(?:\+55\s?)?(?:\(\d{2}\)|\d{2})\s?(?:9\d{4}|\d{4})-?\d{4}\b/g;
const CNH_PATTERN = /(?<![\d@.-])\d{11}(?![\d.-])/g;

export const PII_PLACEHOLDERS = {
  cpf: '[REDACTED_CPF]',
  cnh: '[REDACTED_CNH]',
  email: '[REDACTED_EMAIL]',
  phone: '[REDACTED_PHONE]',
} as const;

export function redactPii(input: string): string {
  return input
    .replace(EMAIL_PATTERN, PII_PLACEHOLDERS.email)
    .replace(CPF_PATTERN, PII_PLACEHOLDERS.cpf)
    .replace(BR_PHONE_PATTERN, PII_PLACEHOLDERS.phone)
    .replace(CNH_PATTERN, PII_PLACEHOLDERS.cnh);
}

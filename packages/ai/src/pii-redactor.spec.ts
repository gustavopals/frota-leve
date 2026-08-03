import { PII_PLACEHOLDERS, redactPii } from './pii-redactor';

describe('redactPii', () => {
  it('redacts formatted CPF values in free text', () => {
    const input = 'CPF do motorista: 123.456.789-10 precisa ser ocultado.';

    expect(redactPii(input)).toBe(
      `CPF do motorista: ${PII_PLACEHOLDERS.cpf} precisa ser ocultado.`,
    );
  });

  it('redacts isolated CNH values with 11 digits', () => {
    const input = 'CNH informada 12345678901 para validacao.';

    expect(redactPii(input)).toBe(`CNH informada ${PII_PLACEHOLDERS.cnh} para validacao.`);
  });

  it('redacts email addresses in free text', () => {
    const input = 'Contato: frota.leve+ia@empresa.com.br para retorno.';

    expect(redactPii(input)).toBe(`Contato: ${PII_PLACEHOLDERS.email} para retorno.`);
  });

  it('redacts brazilian phone numbers with formatting', () => {
    const input = 'Ligar para +55 (11) 99876-5432 ou 113333-4444 ainda hoje.';

    expect(redactPii(input)).toBe(
      `Ligar para ${PII_PLACEHOLDERS.phone} ou ${PII_PLACEHOLDERS.phone} ainda hoje.`,
    );
  });

  it('redacts mixed PII in the same paragraph', () => {
    const input =
      'Cliente Joao, CPF 987.654.321-00, CNH 99887766554, email joao@empresa.com e telefone (31) 98888-7777.';

    expect(redactPii(input)).toBe(
      `Cliente Joao, CPF ${PII_PLACEHOLDERS.cpf}, CNH ${PII_PLACEHOLDERS.cnh}, email ${PII_PLACEHOLDERS.email} e telefone ${PII_PLACEHOLDERS.phone}.`,
    );
  });

  it('does not modify text without supported PII', () => {
    const input = 'Resumo da frota com custo por km e manutencoes em aberto.';

    expect(redactPii(input)).toBe(input);
  });

  it('does not treat dotted cpf fragments inside emails as cpf', () => {
    const input = 'Enviar para 123.456.789-10@empresa.com somente se necessario.';

    expect(redactPii(input)).toBe(`Enviar para ${PII_PLACEHOLDERS.email} somente se necessario.`);
  });
});

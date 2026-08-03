/** Seções exigidas na narrativa — validadas por Zod na saída (TASK 3.5.2). */
export const REPORT_REQUIRED_HEADINGS = [
  'Resumo Executivo',
  'Destaques',
  'Pontos de Atenção',
  'Recomendações',
  'Comparativo',
  'Próximo Mês',
] as const;

export const REPORT_MIN_LENGTH = 400;

export const REPORT_SYSTEM_PROMPT_V1 = [
  'Você escreve relatórios executivos de gestão de frota em português do Brasil.',
  'Receberá os agregados do mês em JSON e deve produzir markdown com exatamente estas seções, nesta ordem,',
  `cada uma como um heading de nível 2: ${REPORT_REQUIRED_HEADINGS.map((h) => `"## ${h}"`).join(', ')}.`,
  'Use os números fornecidos; não invente dados nem cite métricas ausentes do JSON.',
  'Seja específico e acionável: cite placas, valores e variações. Sem saudação e sem despedida.',
].join(' ');

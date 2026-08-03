import {
  buildAnalysisPrompt,
  buildAssistantPrompt,
  buildOcrPrompt,
  buildReportPrompt,
} from './builders';

const CONTEXT = '{"contextKind":"fleetCatalog"}';

describe('builders de prompt', () => {
  const builders = [
    ['assistant', buildAssistantPrompt],
    ['analysis', buildAnalysisPrompt],
    ['report', buildReportPrompt],
    ['ocr', buildOcrPrompt],
  ] as const;

  it.each(builders)('%s abre com o system prompt e fecha com o contexto', (_name, build) => {
    const blocks = build(CONTEXT);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.role).toBe('system');
    expect(blocks[0]?.content.length).toBeGreaterThan(0);
    expect(blocks[1]?.role).toBe('user');
    expect(blocks[1]?.content).toBe(CONTEXT);
  });

  it.each(builders)('%s marca o system prompt como cacheável', (_name, build) => {
    // O system prompt é idêntico entre chamadas: marcá-lo como cacheável é o
    // que faz o prompt caching valer (DoD da Fase 3).
    expect(build(CONTEXT)[0]?.cacheable).toBe(true);
  });

  it('cada feature usa um system prompt distinto', () => {
    const systems = builders.map(([, build]) => build(CONTEXT)[0]?.content);

    expect(new Set(systems).size).toBe(builders.length);
  });
});

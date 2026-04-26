import type { AiToolDefinition } from '@frota-leve/ai';
import { getVehicleByIdTool } from './get-vehicle-by-id.tool';
import { listVehiclesByFilterTool } from './list-vehicles-by-filter.tool';
import { getMonthlySummaryTool } from './get-monthly-summary.tool';
import { getTopCostVehiclesTool } from './get-top-cost-vehicles.tool';
import { getDriverMetricsTool } from './get-driver-metrics.tool';
import { listOpenAnomaliesTool } from './list-open-anomalies.tool';
import type { AITool, AIToolContext } from './types';

export type { AITool, AIToolContext } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ALL_TOOLS: AITool<any>[] = [
  getVehicleByIdTool,
  listVehiclesByFilterTool,
  getMonthlySummaryTool,
  getTopCostVehiclesTool,
  getDriverMetricsTool,
  listOpenAnomaliesTool,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOL_REGISTRY: Map<string, AITool<any>> = new Map(ALL_TOOLS.map((tool) => [tool.name, tool]));

/** Definições enviadas para Claude (formato esperado pelo `AiClient`). */
export function getAssistantToolDefinitions(): AiToolDefinition[] {
  return ALL_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

/**
 * Executa uma tool pelo nome. Resultado JSON-stringifiable.
 * Lança Error se a tool não existir (whitelisting estrito) ou se o input falhar Zod.
 */
export async function executeAssistantTool(
  name: string,
  rawInput: unknown,
  ctx: AIToolContext,
): Promise<unknown> {
  const tool = TOOL_REGISTRY.get(name);
  if (!tool) {
    return { error: `Ferramenta '${name}' não está disponível.` };
  }

  const parsed = tool.zodSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return {
      error: 'Parâmetros inválidos para a ferramenta.',
      details: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    return await tool.execute(parsed.data, ctx);
  } catch (error) {
    return {
      error: 'Falha ao executar a ferramenta.',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

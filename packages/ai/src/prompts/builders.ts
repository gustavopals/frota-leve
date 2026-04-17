import type { AiPromptBlock } from '../types';
import { ANALYSIS_SYSTEM_PROMPT_V1 } from './system/analysis.v1';
import { ASSISTANT_SYSTEM_PROMPT_V1 } from './system/assistant.v1';
import { OCR_SYSTEM_PROMPT_V1 } from './system/ocr.v1';
import { REPORT_SYSTEM_PROMPT_V1 } from './system/report.v1';

export function buildAssistantPrompt(context: string): AiPromptBlock[] {
  return [
    { role: 'system', content: ASSISTANT_SYSTEM_PROMPT_V1, cacheable: true },
    { role: 'user', content: context },
  ];
}

export function buildAnalysisPrompt(context: string): AiPromptBlock[] {
  return [
    { role: 'system', content: ANALYSIS_SYSTEM_PROMPT_V1, cacheable: true },
    { role: 'user', content: context },
  ];
}

export function buildReportPrompt(context: string): AiPromptBlock[] {
  return [
    { role: 'system', content: REPORT_SYSTEM_PROMPT_V1, cacheable: true },
    { role: 'user', content: context },
  ];
}

export function buildOcrPrompt(context: string): AiPromptBlock[] {
  return [
    { role: 'system', content: OCR_SYSTEM_PROMPT_V1, cacheable: true },
    { role: 'user', content: context },
  ];
}

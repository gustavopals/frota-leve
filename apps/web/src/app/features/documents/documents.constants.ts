import type { PoComboOption } from '@po-ui/ng-components';
import { DocumentType } from '@frota-leve/shared/src/enums/document-type.enum';
import { getDocumentTypeLabel } from './documents.utils';

export const DOCUMENT_TYPE_OPTIONS: PoComboOption[] = Object.values(DocumentType).map((value) => ({
  label: getDocumentTypeLabel(value),
  value,
}));

export const DOCUMENT_ALERT_PRESET_DAYS = [0, 7, 15, 30, 45, 60, 90] as const;

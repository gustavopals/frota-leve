export type OcrFieldConfidence = Record<string, number>;

export interface OcrFuelData {
  liters: number | null;
  totalCost: number | null;
  pricePerLiter: number | null;
  gasStation: string | null;
  fuelType: string | null;
  date: string | null;
  odometerKm: number | null;
  cnpj: string | null;
  confidence: number;
  fieldsConfidence: OcrFieldConfidence;
}

export interface OcrInvoiceItem {
  description: string;
  qty: number | null;
  unitValue: number | null;
  totalValue: number | null;
}

export interface OcrInvoiceData {
  supplier: string | null;
  cnpj: string | null;
  issueDate: string | null;
  totalValue: number | null;
  items: OcrInvoiceItem[];
  taxes: number | null;
  confidence: number;
  fieldsConfidence: OcrFieldConfidence;
}

export interface OcrResponse<T> {
  success: true;
  data: {
    data: T | null;
    confidence: number;
    rawText?: string;
  };
}

/** Faixas de confiança que a UI usa para colorir os campos (TASK 3.6.5). */
export type OcrFieldLevel = 'high' | 'review' | 'discard';

export function resolveFieldLevel(confidence: number | undefined): OcrFieldLevel {
  if (confidence === undefined) {
    return 'discard';
  }

  if (confidence >= 0.8) {
    return 'high';
  }

  return confidence >= 0.5 ? 'review' : 'discard';
}

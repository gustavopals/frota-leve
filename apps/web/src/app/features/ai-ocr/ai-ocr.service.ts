import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { OcrFuelData, OcrInvoiceData, OcrResponse } from './ai-ocr.types';

@Injectable({ providedIn: 'root' })
export class AiOcrService {
  private readonly http = inject(HttpClient);

  /** Usa HttpClient direto: o ApiService assume JSON e aqui vai multipart. */
  scanFuelReceipt(file: File): Observable<OcrResponse<OcrFuelData>> {
    return this.http.post<OcrResponse<OcrFuelData>>(
      `${environment.apiUrl}/ai/ocr/fuel`,
      this.toFormData(file),
    );
  }

  scanInvoice(file: File): Observable<OcrResponse<OcrInvoiceData>> {
    return this.http.post<OcrResponse<OcrInvoiceData>>(
      `${environment.apiUrl}/ai/ocr/invoice`,
      this.toFormData(file),
    );
  }

  private toFormData(file: File): FormData {
    const formData = new FormData();
    formData.append('image', file);
    return formData;
  }
}

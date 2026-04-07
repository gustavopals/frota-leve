import { HttpClient } from '@angular/common/http';
import type { HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

type RequestOptions = {
  context?: HttpContext;
  headers?: HttpHeaders | Record<string, string | string[]>;
  params?:
    | HttpParams
    | Record<string, string | number | boolean | readonly (string | number | boolean)[]>;
  withCredentials?: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = environment.apiUrl.replace(/\/+$/, '');

  constructor(private readonly httpClient: HttpClient) {}

  get<T>(endpoint: string, options?: RequestOptions): Observable<T> {
    return this.httpClient.get<T>(this.buildUrl(endpoint), options);
  }

  post<T, TBody = unknown>(endpoint: string, body: TBody, options?: RequestOptions): Observable<T> {
    return this.httpClient.post<T>(this.buildUrl(endpoint), body, options);
  }

  put<T, TBody = unknown>(endpoint: string, body: TBody, options?: RequestOptions): Observable<T> {
    return this.httpClient.put<T>(this.buildUrl(endpoint), body, options);
  }

  patch<T, TBody = unknown>(
    endpoint: string,
    body: TBody,
    options?: RequestOptions,
  ): Observable<T> {
    return this.httpClient.patch<T>(this.buildUrl(endpoint), body, options);
  }

  delete<T>(endpoint: string, options?: RequestOptions): Observable<T> {
    return this.httpClient.delete<T>(this.buildUrl(endpoint), options);
  }

  private buildUrl(endpoint: string): string {
    if (/^https?:\/\//.test(endpoint)) {
      return endpoint;
    }

    const sanitizedEndpoint = endpoint.replace(/^\/+/, '');

    return sanitizedEndpoint ? `${this.baseUrl}/${sanitizedEndpoint}` : this.baseUrl;
  }
}

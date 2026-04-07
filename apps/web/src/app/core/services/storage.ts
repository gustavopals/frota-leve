import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  getString(key: string): string | null {
    if (!this.isAvailable()) {
      return null;
    }

    return window.localStorage.getItem(key);
  }

  setString(key: string, value: string): void {
    if (!this.isAvailable()) {
      return;
    }

    window.localStorage.setItem(key, value);
  }

  getObject<T>(key: string): T | null {
    const value = this.getString(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  setObject<T>(key: string, value: T): void {
    this.setString(key, JSON.stringify(value));
  }

  remove(key: string): void {
    if (!this.isAvailable()) {
      return;
    }

    window.localStorage.removeItem(key);
  }

  private isAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }
}

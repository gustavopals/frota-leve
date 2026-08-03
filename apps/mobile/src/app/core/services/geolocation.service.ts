import { Injectable } from '@angular/core';

export interface GeoResult {
  latitude: number;
  longitude: number;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  current(): Promise<GeoResult | null> {
    if (!('geolocation' in navigator)) return Promise.resolve(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const latitude = Number(coords.latitude.toFixed(6));
          const longitude = Number(coords.longitude.toFixed(6));
          resolve({ latitude, longitude, label: `${latitude}, ${longitude}` });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
      );
    });
  }
}

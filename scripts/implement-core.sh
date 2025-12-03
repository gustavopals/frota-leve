#!/bin/bash

# Guards
cat > src/app/core/guards/auth-guard.ts << 'EOF'
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/auth/login']);
  return false;
};
EOF

# Interceptors
cat > src/app/core/interceptors/auth-interceptor.ts << 'EOF'
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req);
};
EOF

cat > src/app/core/interceptors/error-interceptor.ts << 'EOF'
import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401) {
        localStorage.clear();
        router.navigate(['/auth/login']);
      }
      console.error('HTTP Error:', error);
      return throwError(() => error);
    })
  );
};
EOF

# Models
mkdir -p src/app/core/models

cat > src/app/core/models/user.model.ts << 'EOF'
export enum UserRole {
  ADMIN_EMPRESA = 'ADMIN_EMPRESA',
  GESTOR_FROTA = 'GESTOR_FROTA',
  MOTORISTA = 'MOTORISTA'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string;
  createdAt: Date;
}
EOF

cat > src/app/core/models/vehicle.model.ts << 'EOF'
export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  chassisNumber?: string;
  renavam?: string;
  currentKm: number;
  fuelType: string;
  status: 'ATIVO' | 'MANUTENCAO' | 'INATIVO';
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleDto {
  plate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  chassisNumber?: string;
  renavam?: string;
  currentKm: number;
  fuelType: string;
}
EOF

echo "✅ Core services, guards, interceptors e models criados!"

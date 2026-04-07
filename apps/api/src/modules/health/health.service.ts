interface HealthStatus {
  status: 'ok';
  timestamp: string;
  version: string;
  uptime: number;
}

export class HealthService {
  check(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] ?? '0.0.1',
      uptime: Math.floor(process.uptime()),
    };
  }
}

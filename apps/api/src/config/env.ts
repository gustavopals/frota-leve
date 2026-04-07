import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Servidor
  PORT: z.coerce.number().default(3000),

  // Banco de dados (PostgreSQL)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),

  // Cache e filas (Redis)
  REDIS_URL: z.string().min(1, 'REDIS_URL é obrigatório'),

  // JWT — obrigatório, sem defaults por segurança
  JWT_SECRET: z.string().min(1, 'JWT_SECRET é obrigatório'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET é obrigatório'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Inteligência Artificial (Claude API)
  CLAUDE_API_KEY: z.string().optional(),

  // Pagamentos (Stripe)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ESSENTIAL: z.string().optional(),
  STRIPE_PRICE_PROFESSIONAL: z.string().optional(),

  // Armazenamento (AWS S3)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_CLOUDFRONT_URL: z.string().optional(),

  // E-mail (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().default('noreply@frotaleve.com.br'),
  EMAIL_FROM_NAME: z.string().default('Frota Leve'),

  // Frontend
  FRONTEND_URL: z.string().url().default('http://localhost:4200'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('debug'),
});

function writeStderr(message: string): void {
  process.stderr.write(`${message}\n`);
}

// Crash early — se vars obrigatórias estiverem faltando, o processo encerra com mensagem clara
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  writeStderr('\nVariáveis de ambiente inválidas ou faltando:\n');
  const errors = parsed.error.flatten().fieldErrors;
  for (const [field, messages] of Object.entries(errors)) {
    writeStderr(`  ${field}: ${messages?.join(', ')}`);
  }
  writeStderr('\nConsulte o arquivo .env.example para referência.\n');
  process.exit(1);
}

export const env = parsed.data;

export type Env = typeof env;

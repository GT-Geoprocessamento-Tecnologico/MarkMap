import { z } from 'zod';

/**
 * Server-side environment. DATABASE_URL is read here and nowhere else, and is
 * never returned by any endpoint (00-MASTER-PRD.md:489).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Comma-separated allowlist. No wildcard default: the admin runs on localhost. */
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  /**
   * Optional so /health answers without a database, which is what lets the
   * health check run before migrations exist.
   */
  DATABASE_URL: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema> & {
  corsOrigins: string[];
  hasDatabase: boolean;
};

export const loadEnv = (source: Record<string, string | undefined> = process.env): Env => {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration -> ${detail}`);
  }
  const value = parsed.data;
  const corsOrigins = value.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  // Fail-closed: wildcard CORS nunca é permitido (PRD 30). Cada origem deve
  // ser http(s) explícita; configuração malformada derruba o boot em vez de
  // abrir a API silenciosamente.
  for (const origin of corsOrigins) {
    if (origin === '*' || !/^https?:\/\/[^/]+$/.test(origin)) {
      throw new Error(
        `Invalid environment configuration -> CORS_ORIGINS: origem inválida "${origin}" (use http(s)://host[:porta], sem wildcard)`,
      );
    }
  }
  return {
    ...value,
    corsOrigins,
    hasDatabase: value.DATABASE_URL !== undefined,
  };
};

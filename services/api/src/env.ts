import { z } from "zod";

/**
 * Server-side environment. DATABASE_URL is read here and nowhere else, and is
 * never returned by any endpoint (00-MASTER-PRD.md:489).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Comma-separated allowlist. No wildcard default: the admin runs on localhost. */
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /**
   * Optional so /health answers without a database, which is what lets the
   * health check run before migrations exist.
   */
  DATABASE_URL: z.string().min(1).optional(),
  /** Backwards-compatible alias accepted by the database package. */
  NEON_DB_URL: z.string().min(1).optional(),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema> & {
  corsOrigins: string[];
  hasDatabase: boolean;
};

export const loadEnv = (
  source: Record<string, string | undefined> = process.env,
): Env => {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration -> ${detail}`);
  }
  const value = parsed.data;
  const databaseUrl = value.DATABASE_URL ?? value.NEON_DB_URL;
  const corsOrigins = value.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  // Fail-closed: wildcard CORS nunca é permitido (PRD 30). Cada origem deve
  // ser http(s) explícita; configuração malformada derruba o boot em vez de
  // abrir a API silenciosamente.
  for (const origin of corsOrigins) {
    if (origin === "*" || !/^https?:\/\/[^/]+$/.test(origin)) {
      throw new Error(
        `Invalid environment configuration -> CORS_ORIGINS: origem inválida "${origin}" (use http(s)://host[:porta], sem wildcard)`,
      );
    }
  }
  return {
    ...value,
    DATABASE_URL: databaseUrl,
    corsOrigins,
    hasDatabase: databaseUrl !== undefined,
  };
};

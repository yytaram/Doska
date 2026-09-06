import { z } from 'zod';

const developmentDefaults = {
  DATABASE_URL: 'postgresql://doska:doska_local_password@127.0.0.1:5432/doska',
  REDIS_URL: 'redis://127.0.0.1:6379',
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_ACCESS_KEY: 'doska',
  S3_SECRET_KEY: 'doska_local_password',
  S3_BUCKET: 'doska-local',
} as const;

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url().default(developmentDefaults.DATABASE_URL),
  REDIS_URL: z.url().default(developmentDefaults.REDIS_URL),
  S3_ENDPOINT: z.url().default(developmentDefaults.S3_ENDPOINT),
  S3_ACCESS_KEY: z.string().min(1).default(developmentDefaults.S3_ACCESS_KEY),
  S3_SECRET_KEY: z.string().min(8).default(developmentDefaults.S3_SECRET_KEY),
  S3_BUCKET: z.string().min(3).default(developmentDefaults.S3_BUCKET),
});

export type AppConfig = z.infer<typeof configSchema>;

export function getConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = configSchema.safeParse(environment);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid API configuration: ${message}`);
  }

  return result.data;
}

import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().default(4000),
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  ADMIN_KEY: z.string().default('dev-secret-admin-key-123'),
  IMAGE_BASE_URL: z.string().default('http://localhost:4000/images'),

  PG_HOST: z.string().min(1, 'PG_HOST is required'),
  PG_PORT: z.coerce.number().default(5432),
  PG_USER: z.string().min(1, 'PG_USER is required'),
  PG_PASSWORD: z.string().min(1, 'PG_PASSWORD is required'),
  PG_DATABASE: z.string().default('defaultdb'),
  PG_CA_PATH: z.string().default('./certs/ca.pem'),

  KAFKA_BROKER: z.string().min(1, 'KAFKA_BROKER is required'),
  KAFKA_USER: z.string().min(1, 'KAFKA_USER is required'),
  KAFKA_PASSWORD: z.string().min(1, 'KAFKA_PASSWORD is required'),
  KAFKA_SASL_MECHANISM: z.string().default('plain'),

  OS_HOST: z.string().min(1, 'OS_HOST is required'),
  OS_PORT: z.coerce.number().default(443),
  OS_USER: z.string().min(1, 'OS_USER is required'),
  OS_PASSWORD: z.string().min(1, 'OS_PASSWORD is required'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment validation failed. Missing or invalid variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = {
  ...parsed.data,
  corsOriginsList: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()),
};


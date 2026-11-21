import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

let caCert: string;
try {
  const resolvedPath = path.resolve(process.cwd(), config.PG_CA_PATH);
  caCert = fs.readFileSync(resolvedPath).toString();
} catch (err) {
  logger.warn(`Could not read PG_CA_PATH from ${config.PG_CA_PATH}, trying fallback ../ca.pem`);
  caCert = fs.readFileSync(path.resolve(process.cwd(), '../ca.pem')).toString();
}

export const pool = new Pool({
  host: config.PG_HOST,
  port: config.PG_PORT,
  user: config.PG_USER,
  password: config.PG_PASSWORD,
  database: config.PG_DATABASE,
  ssl: {
    ca: caCert,
    rejectUnauthorized: true,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { config } from './config.js';
import { logger } from './logger.js';

let caCert = '';
const possiblePaths = [
  path.resolve(process.cwd(), config.PG_CA_PATH),
  path.resolve(process.cwd(), 'backend', config.PG_CA_PATH),
  path.resolve(process.cwd(), 'ca.pem'),
  path.resolve(process.cwd(), 'backend/certs/ca.pem'),
  path.resolve(__dirname, '../certs/ca.pem'),
  path.resolve(__dirname, '../../certs/ca.pem'),
  path.resolve(__dirname, '../../../ca.pem'),
];

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    try {
      caCert = fs.readFileSync(p, 'utf-8');
      break;
    } catch {
      // try next
    }
  }
}

if (!caCert) {
  throw new Error(`Could not find valid CA cert in any location: ${possiblePaths.join(', ')}`);
}

const cmd = process.argv.join(' ');
const isApiServer = cmd.includes('server');
const isWorker = cmd.includes('worker') || cmd.includes('Indexer') || cmd.includes('Publisher');
const defaultMax = isApiServer ? 7 : (isWorker ? 1 : 2);
const poolMax = process.env.PG_POOL_MAX ? parseInt(process.env.PG_POOL_MAX, 10) : defaultMax;

export const pool = new Pool({
  host: config.PG_HOST,
  port: config.PG_PORT,
  user: config.PG_USER,
  password: config.PG_PASSWORD,
  database: config.PG_DATABASE,
  ssl: {
    ca: caCert,
  },
  max: poolMax,
  idleTimeoutMillis: 3000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
});


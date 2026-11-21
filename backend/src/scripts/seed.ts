import fs from 'fs';
import path from 'path';
import { pool } from '../db.js';
import { logger } from '../logger.js';

async function seed() {
  const client = await pool.connect();
  try {
    const seedPath = path.resolve(process.cwd(), 'db/seed.sql');
    const sql = fs.readFileSync(seedPath, 'utf-8');

    logger.info('Executing seed script...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    const { rows } = await client.query('SELECT count(*) AS count FROM products');
    logger.info(`✅ Seeding complete. Total products in catalog: ${rows[0].count}`);
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error({ err }, 'Seed failed');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();


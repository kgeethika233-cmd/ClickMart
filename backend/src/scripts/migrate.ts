import fs from 'fs';
import path from 'path';
import { pool } from '../db.js';
import { logger } from '../logger.js';

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    const { rows: applied } = await client.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(applied.map((r) => r.filename));

    const migrationsDir = path.resolve(process.cwd(), 'db/migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        logger.info(`Skipping already applied migration: ${file}`);
        continue;
      }

      logger.info(`Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      logger.info(`✅ Successfully applied: ${file}`);
    }

    logger.info('All database migrations applied cleanly.');
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error({ err }, 'Migration failed');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();


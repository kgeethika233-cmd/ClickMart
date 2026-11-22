import { pool } from '../db.js';
import { logger } from '../logger.js';
import { generateAndSeed } from './generateCatalogAndImages.js';

async function seed() {
  const client = await pool.connect();
  try {
    logger.info('Seeding customers...');
    await client.query(`
      INSERT INTO customers (email, name, password_hash, city, lat, lng) VALUES
        ('demo@example.com', 'Demo User', '$2a$10$7zD.lX31hAom20z6Qz6.pOI95oZf3eE/V.yB2yq9n8J2Ld6sJ1G2W', 'Bengaluru', 12.9716, 77.5946),
        ('alice@example.com', 'Alice Johnson', '$2a$10$7zD.lX31hAom20z6Qz6.pOI95oZf3eE/V.yB2yq9n8J2Ld6sJ1G2W', 'Bengaluru', 12.9716, 77.5946),
        ('bob@example.com', 'Bob Smith', '$2a$10$7zD.lX31hAom20z6Qz6.pOI95oZf3eE/V.yB2yq9n8J2Ld6sJ1G2W', 'Mumbai', 19.0760, 72.8777)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        city = EXCLUDED.city,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng;
    `);
    logger.info('✅ Customers seeded.');
  } finally {
    client.release();
  }

  await generateAndSeed(true);
}

seed().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});

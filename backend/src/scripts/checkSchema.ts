import { pool } from '../db.js';

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position;
    `);
    console.log('Current schema columns:', res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

main();


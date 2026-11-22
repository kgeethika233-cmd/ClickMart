require('dotenv').config();
const fs = require('fs');
const { Client } = require('pg');

const client = new Client({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: { ca: fs.readFileSync(process.env.PG_CA_CERT).toString() },
});

client.connect()
  .then(() => client.query('SELECT version()'))
  .then((res) => { console.log('Connected!', res.rows[0].version); return client.end(); })
  .catch((err) => { console.error('Failed:', err.message); });
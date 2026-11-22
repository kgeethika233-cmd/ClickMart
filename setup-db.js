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

const sql = `
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory (
  product_id INT PRIMARY KEY REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity >= 0)
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id),
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL CHECK (quantity > 0)
);

INSERT INTO products (name, description, price)
SELECT * FROM (VALUES
  ('Bluetooth Headphones', 'Wireless over-ear headphones', 1999.00),
  ('Bluetooth Speaker', 'Portable waterproof speaker', 1499.00),
  ('USB-C Cable', '1 metre fast-charging cable', 299.00)
) AS v(name, description, price)
WHERE NOT EXISTS (SELECT 1 FROM products);

INSERT INTO inventory (product_id, quantity)
SELECT id, CASE WHEN name = 'Bluetooth Speaker' THEN 1 ELSE 10 END
FROM products
ON CONFLICT (product_id) DO NOTHING;
`;

client.connect()
  .then(() => client.query(sql))
  .then(() => client.query('SELECT p.name, i.quantity FROM products p JOIN inventory i ON i.product_id = p.id ORDER BY p.id'))
  .then((res) => { console.log('Tables ready. Products:'); console.table(res.rows); return client.end(); })
  .catch((err) => { console.error('Failed:', err.message); });
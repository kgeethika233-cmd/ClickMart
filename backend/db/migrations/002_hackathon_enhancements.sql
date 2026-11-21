-- Migration 002: Hackathon Enhancements

-- 1. Products enhancements: ratings, delivery info, tags, expiry dates
ALTER TABLE products ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 4.5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_time_mins INT DEFAULT 30;
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_fee INT DEFAULT 49;
ALTER TABLE products ADD COLUMN IF NOT EXISTS distance_km NUMERIC(5,2) DEFAULT 3.5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS expiry_date DATE NULL;

-- 2. Customers enhancements: password hashing, location coords
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS city VARCHAR(64) NOT NULL DEFAULT 'Bengaluru';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION NOT NULL DEFAULT 12.9716;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION NOT NULL DEFAULT 77.5946;

-- 3. Orders enhancements: direct customer info and currency
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'INR';
ALTER TABLE orders ALTER COLUMN customer_id DROP NOT NULL;

-- Backfill orders customer_email if null
UPDATE orders o 
SET customer_email = c.email, customer_name = c.name 
FROM customers c 
WHERE o.customer_id = c.id AND o.customer_email IS NULL;

-- 4. Dead letter events table (replaces Kafka DLQ topics to respect <= 5 topics limit)
CREATE TABLE IF NOT EXISTS dead_letter_events (
  id SERIAL PRIMARY KEY,
  topic VARCHAR(128) NOT NULL,
  event_key VARCHAR(255),
  payload JSONB NOT NULL,
  error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index for dead letter events
CREATE INDEX IF NOT EXISTS idx_dead_letter_topic ON dead_letter_events(topic);


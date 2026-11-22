-- Migration 003: Deduplicate Products and Add Unique Constraints

-- Remap foreign keys for product id 1 to id 33 if both exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM products WHERE id = 1) AND EXISTS (SELECT 1 FROM products WHERE id = 33) THEN
    UPDATE order_items SET product_id = 33 WHERE product_id = 1;
    UPDATE ledger_entries SET product_id = 33 WHERE product_id = 1;
  END IF;
END $$;

-- Remove older duplicate products (ELEC-*, FASH-*, HOME-*, BOOK-*, SPRT-* duplicates)
DELETE FROM inventory WHERE product_id IN (1, 2, 3, 10, 17, 23, 28);
DELETE FROM products WHERE id IN (1, 2, 3, 10, 17, 23, 28);

-- Remove any remaining duplicates by (name, city), keeping the highest ID (or IH- sku)
DELETE FROM inventory WHERE product_id IN (
  SELECT p.id
  FROM products p
  JOIN (
    SELECT name, city, MIN(id) as keep_id, count(*)
    FROM products
    GROUP BY name, city
    HAVING count(*) > 1
  ) dup ON p.name = dup.name AND p.city = dup.city AND p.id != dup.keep_id
);

DELETE FROM products WHERE id IN (
  SELECT p.id
  FROM products p
  JOIN (
    SELECT name, city, MIN(id) as keep_id, count(*)
    FROM products
    GROUP BY name, city
    HAVING count(*) > 1
  ) dup ON p.name = dup.name AND p.city = dup.city AND p.id != dup.keep_id
);

-- Ensure UNIQUE constraint on (name, city)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_products_name_city'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT uq_products_name_city UNIQUE (name, city);
  END IF;
END $$;


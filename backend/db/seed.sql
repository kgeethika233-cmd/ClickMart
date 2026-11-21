-- Test Customers
INSERT INTO customers (email, name) VALUES
  ('alice@example.com', 'Alice Johnson'),
  ('bob@example.com', 'Bob Smith')
ON CONFLICT (email) DO NOTHING;

-- Seed Products (32 products across 5 categories and 5 cities)
INSERT INTO products (sku, name, description, category, city, price_cents, currency, image_url) VALUES
  -- Electronics
  ('ELEC-SPK-001', 'Bluetooth Speaker', 'Portable waterproof high-bass wireless speaker', 'Electronics', 'Bengaluru', 149900, 'INR', 'https://picsum.photos/seed/ELEC-SPK-001/400/300'),
  ('ELEC-HD-002', 'Bluetooth Headphones', 'Over-ear active noise cancelling Bluetooth headphones', 'Electronics', 'Mumbai', 249900, 'INR', 'https://picsum.photos/seed/ELEC-HD-002/400/300'),
  ('ELEC-EAR-003', 'Wireless Earbuds', 'True wireless stereo earbuds with charging case', 'Electronics', 'Delhi', 129900, 'INR', 'https://picsum.photos/seed/ELEC-EAR-003/400/300'),
  ('ELEC-GAM-004', 'Studio Monitor Headphones', 'Professional studio grade wired and Bluetooth headphones', 'Electronics', 'Chennai', 349900, 'INR', 'https://picsum.photos/seed/ELEC-GAM-004/400/300'),
  ('ELEC-CBL-005', 'USB-C Fast Cable', 'Durable braided nylon 100W charging cable', 'Electronics', 'Hyderabad', 29900, 'INR', 'https://picsum.photos/seed/ELEC-CBL-005/400/300'),
  ('ELEC-PWR-006', 'Power Bank 20000mAh', 'High capacity fast charging portable battery pack', 'Electronics', 'Bengaluru', 189900, 'INR', 'https://picsum.photos/seed/ELEC-PWR-006/400/300'),
  ('ELEC-MOU-007', 'Ergonomic Wireless Mouse', 'Silent click Bluetooth & 2.4GHz rechargeable mouse', 'Electronics', 'Mumbai', 89900, 'INR', 'https://picsum.photos/seed/ELEC-MOU-007/400/300'),
  ('LAST-ITEM-TEST', 'Last Item Test Gadget', 'Special test product configured with exactly 1 unit stock', 'Electronics', 'Bengaluru', 99900, 'INR', 'https://picsum.photos/seed/LAST-ITEM-TEST/400/300'),
  ('SOLDOUT-001', 'Sold Out Sample', 'Sample catalog product that is completely sold out', 'Electronics', 'Delhi', 199900, 'INR', 'https://picsum.photos/seed/SOLDOUT-001/400/300'),

  -- Fashion
  ('FASH-TSH-001', 'Classic Cotton T-Shirt', 'Breathable organic crew-neck casual t-shirt', 'Fashion', 'Delhi', 49900, 'INR', 'https://picsum.photos/seed/FASH-TSH-001/400/300'),
  ('FASH-JAC-002', 'Denim Slim Jacket', 'Vintage washed rugged denim streetwear jacket', 'Fashion', 'Mumbai', 299900, 'INR', 'https://picsum.photos/seed/FASH-JAC-002/400/300'),
  ('FASH-HOO-003', 'Fleece Pullover Hoodie', 'Warm thermal heavyweight winter hoodie', 'Fashion', 'Bengaluru', 179900, 'INR', 'https://picsum.photos/seed/FASH-HOO-003/400/300'),
  ('FASH-SNK-004', 'Canvas Low-Top Sneakers', 'Comfortable vulcanized sole everyday casual shoes', 'Fashion', 'Chennai', 159900, 'INR', 'https://picsum.photos/seed/FASH-SNK-004/400/300'),
  ('FASH-SKS-005', 'Sports Cushion Socks 3-Pack', 'Moisture-wicking athletic ankle socks', 'Fashion', 'Hyderabad', 34900, 'INR', 'https://picsum.photos/seed/FASH-SKS-005/400/300'),
  ('FASH-WCH-006', 'Minimalist Chronograph Watch', 'Stainless steel analog wrist watch with leather strap', 'Fashion', 'Bengaluru', 549900, 'INR', 'https://picsum.photos/seed/FASH-WCH-006/400/300'),

  -- Home
  ('HOME-LMP-001', 'LED Desk Lamp', 'Adjustable brightness eye-caring architect study lamp', 'Home', 'Bengaluru', 119900, 'INR', 'https://picsum.photos/seed/HOME-LMP-001/400/300'),
  ('HOME-CUP-002', 'Ceramic Coffee Mug Set', 'Handcrafted artisan minimalist ceramic tea mugs', 'Home', 'Chennai', 69900, 'INR', 'https://picsum.photos/seed/HOME-CUP-002/400/300'),
  ('HOME-BLN-003', 'Organic Cotton Bedlinen', 'King size 400 thread count soft bedsheet set', 'Home', 'Mumbai', 249900, 'INR', 'https://picsum.photos/seed/HOME-BLN-003/400/300'),
  ('HOME-DIFF-004', 'Aroma Oil Diffuser', 'Ultrasonic quiet cool mist essential oil humidifier', 'Home', 'Delhi', 149900, 'INR', 'https://picsum.photos/seed/HOME-DIFF-004/400/300'),
  ('HOME-PLT-005', 'Indoor Planter Ceramic Pot', 'Modern geometric drainage pot for succulents and herbs', 'Home', 'Hyderabad', 39900, 'INR', 'https://picsum.photos/seed/HOME-PLT-005/400/300'),
  ('HOME-ROB-006', 'Smart Robot Vacuum Cleaner', 'Automatic laser mapping sweep and mop robot', 'Home', 'Bengaluru', 1999900, 'INR', 'https://picsum.photos/seed/HOME-ROB-006/400/300'),

  -- Books
  ('BOOK-SYS-001', 'Designing Data-Intensive Applications', 'The definitive guide to distributed systems architecture', 'Books', 'Bengaluru', 169900, 'INR', 'https://picsum.photos/seed/BOOK-SYS-001/400/300'),
  ('BOOK-CLN-002', 'Clean Code Handbook', 'A handbook of agile software craftsmanship and style', 'Books', 'Delhi', 79900, 'INR', 'https://picsum.photos/seed/BOOK-CLN-002/400/300'),
  ('BOOK-PRG-003', 'The Pragmatic Programmer', 'Your journey to software mastery, 20th anniversary edition', 'Books', 'Mumbai', 189900, 'INR', 'https://picsum.photos/seed/BOOK-PRG-003/400/300'),
  ('BOOK-KAF-004', 'Kafka: The Definitive Guide', 'Real-time data and stream processing at scale', 'Books', 'Hyderabad', 219900, 'INR', 'https://picsum.photos/seed/BOOK-KAF-004/400/300'),
  ('BOOK-NTB-005', 'Hardcover Dot Grid Journal', 'Thick 160gsm archival notebook for notes and sketches', 'Books', 'Chennai', 44900, 'INR', 'https://picsum.photos/seed/BOOK-NTB-005/400/300'),

  -- Sports
  ('SPRT-YOG-001', 'Eco TPE Yoga Mat', 'Non-slip extra thick alignment workout fitness mat', 'Sports', 'Chennai', 129900, 'INR', 'https://picsum.photos/seed/SPRT-YOG-001/400/300'),
  ('SPRT-BTL-002', 'Stainless Steel Water Bottle', 'Double-wall vacuum insulated 1 litre flask', 'Sports', 'Mumbai', 89900, 'INR', 'https://picsum.photos/seed/SPRT-BTL-002/400/300'),
  ('SPRT-DUM-003', 'Adjustable Dumbbell Pair', 'Space-saving quick change weights 2kg - 24kg', 'Sports', 'Bengaluru', 899900, 'INR', 'https://picsum.photos/seed/SPRT-DUM-003/400/300'),
  ('SPRT-RST-004', 'Resistance Loop Bands Set', '5 exercise workout bands with door anchor and carry pouch', 'Sports', 'Hyderabad', 49900, 'INR', 'https://picsum.photos/seed/SPRT-RST-004/400/300'),
  ('SPRT-CYC-005', 'Road Cycling Helmet', 'Aerodynamic lightweight safety helmet with visor', 'Sports', 'Delhi', 279900, 'INR', 'https://picsum.photos/seed/SPRT-CYC-005/400/300'),
  ('SPRT-RKT-006', 'Carbon Fiber Badminton Racket', 'High tension lightweight professional competition racquet', 'Sports', 'Bengaluru', 319900, 'INR', 'https://picsum.photos/seed/SPRT-RKT-006/400/300')
ON CONFLICT (sku) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  city = EXCLUDED.city,
  image_url = EXCLUDED.image_url;

-- Seed Inventory
INSERT INTO inventory (product_id, stock_count, reserved_count)
SELECT 
  id,
  CASE 
    WHEN sku = 'LAST-ITEM-TEST' THEN 1
    WHEN sku = 'SOLDOUT-001' THEN 0
    ELSE 25
  END AS stock_count,
  0 AS reserved_count
FROM products
ON CONFLICT (product_id) DO UPDATE SET
  stock_count = EXCLUDED.stock_count,
  reserved_count = 0;

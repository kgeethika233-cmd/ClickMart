-- Seed Customers (including Demo User)
-- Password hash for 'demo123': $2a$10$wTf7JgXlX5H4N1d9vB2j1eGv8O7L3k8b8y5G7x1F0p4d3k1m0p1a (or standard bcrypt)
INSERT INTO customers (email, name, password_hash, city, lat, lng) VALUES
  ('demo@example.com', 'Demo User', '$2a$10$7zD.lX31hAom20z6Qz6.pOI95oZf3eE/V.yB2yq9n8J2Ld6sJ1G2W', 'Bengaluru', 12.9716, 77.5946),
  ('alice@example.com', 'Alice Johnson', '$2a$10$7zD.lX31hAom20z6Qz6.pOI95oZf3eE/V.yB2yq9n8J2Ld6sJ1G2W', 'Bengaluru', 12.9716, 77.5946),
  ('bob@example.com', 'Bob Smith', '$2a$10$7zD.lX31hAom20z6Qz6.pOI95oZf3eE/V.yB2yq9n8J2Ld6sJ1G2W', 'Mumbai', 19.0760, 72.8777)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng;

-- Seed Products (~40 products across 5 categories and 5 cities)
-- IH-001 to IH-008 use image_url '/IH-001.webp' ... '/IH-008.webp'
INSERT INTO products (sku, name, description, category, city, price_cents, currency, image_url, rating, delivery_time_mins, delivery_fee, distance_km, tags, expiry_date) VALUES
  -- Electronics
  ('IH-001', 'Bluetooth Speaker', 'Portable waterproof high-bass wireless bluetooth speaker for outdoor and home use', 'Electronics', 'Bengaluru', 149900, 'INR', '/IH-001.webp', 4.8, 25, 49, 2.5, ARRAY['bluetooth', 'speaker', 'audio', 'wireless'], NULL),
  ('IH-002', 'Bluetooth Headphones', 'Over-ear active noise cancelling Bluetooth headphones with 40h playtime', 'Electronics', 'Mumbai', 249900, 'INR', '/IH-002.webp', 4.7, 30, 49, 3.2, ARRAY['bluetooth', 'headphones', 'audio', 'wireless'], NULL),
  ('IH-003', 'Wireless Earbuds', 'True wireless stereo earbuds with charging case and ultra low latency', 'Electronics', 'Delhi', 129900, 'INR', '/IH-003.webp', 4.5, 35, 49, 4.0, ARRAY['bluetooth', 'earbuds', 'earphones', 'wireless', 'audio'], NULL),
  ('IH-008', 'boAt Airdopes TWS', 'True wireless bluetooth earbuds with beast mode gaming and crystal clear mic', 'Electronics', 'Coimbatore', 179900, 'INR', '/IH-008.webp', 4.6, 20, 29, 1.8, ARRAY['airdopes', 'earbuds', 'earphones', 'bluetooth', 'audio'], NULL),
  ('ELEC-GAM-004', 'Studio Monitor Headphones', 'Professional studio grade wired and Bluetooth headphones with reference sound', 'Electronics', 'Chennai', 349900, 'INR', NULL, 4.9, 40, 59, 5.1, ARRAY['headphones', 'studio', 'bluetooth', 'audio'], NULL),
  ('ELEC-CBL-005', 'USB-C Fast Cable', 'Durable braided nylon 100W power delivery charging cable 2 meters', 'Electronics', 'Hyderabad', 29900, 'INR', NULL, 4.4, 20, 29, 2.1, ARRAY['cable', 'usbc', 'charger', 'fast'], NULL),
  ('ELEC-PWR-006', 'Power Bank 20000mAh', 'High capacity fast charging portable battery pack with dual USB-C', 'Electronics', 'Bengaluru', 189900, 'INR', NULL, 4.6, 25, 49, 3.0, ARRAY['powerbank', 'battery', 'portable', 'charger'], NULL),
  ('ELEC-MOU-007', 'Ergonomic Wireless Mouse', 'Silent click Bluetooth & 2.4GHz rechargeable wireless optical mouse', 'Electronics', 'Mumbai', 89900, 'INR', NULL, 4.3, 30, 49, 2.8, ARRAY['mouse', 'bluetooth', 'accessories'], NULL),
  ('LAST-ITEM-TEST', 'Last Item Test Gadget', 'Special test product configured with exactly 1 unit stock for concurrency proof', 'Electronics', 'Bengaluru', 99900, 'INR', NULL, 5.0, 15, 0, 1.0, ARRAY['test', 'gadget', 'concurrency'], NULL),
  ('SOLDOUT-001', 'Sold Out Sample', 'Sample catalog product that is completely sold out with 0 stock', 'Electronics', 'Delhi', 199900, 'INR', NULL, 4.0, 45, 49, 6.0, ARRAY['sample', 'soldout'], NULL),

  -- Fashion
  ('IH-004', 'Classic Cotton T-Shirt', 'Breathable organic premium combed cotton crew-neck casual t-shirt', 'Fashion', 'Delhi', 49900, 'INR', '/IH-004.webp', 4.5, 30, 49, 3.5, ARRAY['tshirt', 'cotton', 'clothes', 'kapde'], NULL),
  ('FASH-JAC-002', 'Denim Slim Jacket', 'Vintage washed rugged denim streetwear jacket with copper buttons', 'Fashion', 'Mumbai', 299900, 'INR', NULL, 4.7, 35, 49, 4.2, ARRAY['jacket', 'denim', 'clothes', 'kapde'], NULL),
  ('FASH-HOO-003', 'Fleece Pullover Hoodie', 'Warm thermal heavyweight winter hoodie with kangaroo pocket', 'Fashion', 'Bengaluru', 179900, 'INR', NULL, 4.6, 25, 49, 2.9, ARRAY['hoodie', 'winter', 'clothes', 'kapde'], NULL),
  ('FASH-SNK-004', 'Canvas Low-Top Sneakers', 'Comfortable vulcanized rubber sole everyday casual walking shoes', 'Fashion', 'Chennai', 159900, 'INR', NULL, 4.4, 30, 49, 3.8, ARRAY['shoes', 'sneakers', 'footwear', 'joota'], NULL),
  ('FASH-SKS-005', 'Sports Cushion Socks 3-Pack', 'Moisture-wicking athletic ankle socks with arch support', 'Fashion', 'Hyderabad', 34900, 'INR', NULL, 4.3, 20, 29, 2.0, ARRAY['socks', 'sports', 'footwear'], NULL),
  ('FASH-WCH-006', 'Minimalist Chronograph Watch', 'Stainless steel analog wrist watch with genuine leather strap', 'Fashion', 'Bengaluru', 549900, 'INR', NULL, 4.8, 30, 49, 3.4, ARRAY['watch', 'accessories', 'chronograph'], NULL),
  ('FASH-SAR-007', 'Traditional Silk Saree', 'Handwoven pure Kanjeevaram silk saree with rich zari pallu', 'Fashion', 'Chennai', 499900, 'INR', NULL, 4.9, 40, 59, 4.5, ARRAY['saree', 'sari', 'silk', 'clothes', 'traditional'], NULL),
  ('FASH-CHP-008', 'Kolhapuri Leather Chappal', 'Handmade authentic ethnic leather chappal slippers for everyday wear', 'Fashion', 'Mumbai', 89900, 'INR', NULL, 4.5, 25, 39, 2.6, ARRAY['chappal', 'footwear', 'slippers', 'sandals'], NULL),
  ('FASH-SAN-009', 'Coimbatore Walking Sandals', 'Comfortable orthopedic cushioned walking sandals with anti-slip grip', 'Footwear', 'Coimbatore', 99900, 'INR', NULL, 4.6, 20, 29, 1.5, ARRAY['footwear', 'sandals', 'shoes', 'chappal'], NULL),

  -- Home
  ('IH-005', 'Ceramic Coffee Mug Set', 'Handcrafted artisan minimalist ceramic coffee and tea mugs set of 4', 'Home', 'Chennai', 69900, 'INR', '/IH-005.webp', 4.7, 30, 49, 3.0, ARRAY['mugs', 'ceramic', 'kitchen', 'home'], NULL),
  ('HOME-LMP-001', 'LED Desk Lamp', 'Adjustable brightness eye-caring architect study lamp with USB port', 'Home', 'Bengaluru', 119900, 'INR', NULL, 4.6, 25, 49, 2.7, ARRAY['lamp', 'lighting', 'desk', 'study'], NULL),
  ('HOME-BLN-003', 'Organic Cotton Bedlinen', 'King size 400 thread count breathable soft cotton bedsheet set', 'Home', 'Mumbai', 249900, 'INR', NULL, 4.8, 35, 49, 4.1, ARRAY['bedsheet', 'linen', 'cotton', 'home'], NULL),
  ('HOME-DIFF-004', 'Aroma Oil Diffuser', 'Ultrasonic quiet cool mist essential oil humidifier with ambient light', 'Home', 'Delhi', 149900, 'INR', NULL, 4.5, 30, 49, 3.6, ARRAY['diffuser', 'aroma', 'home', 'wellness'], NULL),
  ('HOME-PLT-005', 'Indoor Planter Ceramic Pot', 'Modern geometric drainage pot for succulents and indoor houseplants', 'Home', 'Hyderabad', 39900, 'INR', NULL, 4.4, 20, 29, 2.2, ARRAY['planter', 'pot', 'garden', 'home'], NULL),
  ('HOME-ROB-006', 'Smart Robot Vacuum Cleaner', 'Automatic laser LiDAR mapping sweep and wet mop robot with app control', 'Home', 'Bengaluru', 1999900, 'INR', NULL, 4.9, 45, 99, 5.0, ARRAY['vacuum', 'robot', 'cleaning', 'smart'], NULL),

  -- Books
  ('IH-006', 'Clean Code Handbook', 'A handbook of agile software craftsmanship and professional style', 'Books', 'Delhi', 79900, 'INR', '/IH-006.webp', 4.8, 25, 39, 2.5, ARRAY['books', 'programming', 'cleancode', 'software'], NULL),
  ('BOOK-SYS-001', 'Designing Data-Intensive Applications', 'The definitive guide to distributed systems architecture and storage', 'Books', 'Bengaluru', 169900, 'INR', NULL, 5.0, 25, 49, 2.8, ARRAY['books', 'systems', 'database', 'distributed'], NULL),
  ('BOOK-PRG-003', 'The Pragmatic Programmer', 'Your journey to software mastery 20th anniversary edition', 'Books', 'Mumbai', 189900, 'INR', NULL, 4.9, 30, 49, 3.5, ARRAY['books', 'pragmatic', 'software', 'programming'], NULL),
  ('BOOK-KAF-004', 'Kafka: The Definitive Guide', 'Real-time data and stream processing at massive cloud scale', 'Books', 'Hyderabad', 219900, 'INR', NULL, 4.7, 30, 49, 3.2, ARRAY['books', 'kafka', 'streaming', 'architecture'], NULL),
  ('BOOK-NTB-005', 'Hardcover Dot Grid Journal', 'Thick 160gsm archival bamboo paper notebook for notes and sketches', 'Books', 'Chennai', 44900, 'INR', NULL, 4.6, 20, 29, 1.9, ARRAY['journal', 'notebook', 'stationery', 'books'], NULL),

  -- Sports
  ('IH-007', 'Stainless Steel Water Bottle', 'Double-wall vacuum insulated 1 litre thermal hydration flask', 'Sports', 'Mumbai', 89900, 'INR', '/IH-007.webp', 4.7, 25, 39, 2.4, ARRAY['bottle', 'sports', 'fitness', 'hydration'], NULL),
  ('SPRT-YOG-001', 'Eco TPE Yoga Mat', 'Non-slip extra thick body alignment workout fitness yoga mat', 'Sports', 'Chennai', 129900, 'INR', NULL, 4.6, 30, 49, 3.1, ARRAY['yogamat', 'yoga', 'fitness', 'sports'], NULL),
  ('SPRT-DUM-003', 'Adjustable Dumbbell Pair', 'Space-saving quick change weights 2kg to 24kg gym dumbbells', 'Sports', 'Bengaluru', 899900, 'INR', NULL, 4.9, 45, 99, 4.8, ARRAY['dumbbell', 'gym', 'workout', 'weights', 'sports'], NULL),
  ('SPRT-RST-004', 'Resistance Loop Bands Set', '5 exercise workout bands with door anchor handles and carry pouch', 'Sports', 'Hyderabad', 49900, 'INR', NULL, 4.5, 20, 29, 2.0, ARRAY['bands', 'resistance', 'fitness', 'workout'], NULL),
  ('SPRT-CYC-005', 'Road Cycling Helmet', 'Aerodynamic lightweight safety certified bicycle helmet with sun visor', 'Sports', 'Delhi', 279900, 'INR', NULL, 4.7, 35, 49, 4.0, ARRAY['cycling', 'helmet', 'safety', 'sports'], NULL),
  ('SPRT-RKT-006', 'Carbon Fiber Badminton Racket', 'High tension lightweight professional competition badminton racquet', 'Sports', 'Bengaluru', 319900, 'INR', NULL, 4.8, 30, 49, 3.3, ARRAY['badminton', 'racket', 'sports'], NULL),

  -- Perishable / Fresh Groceries (with dynamic expiry dates)
  ('EXP-001', 'Organic Farm Fresh Milk', 'Pure cow milk pasteurized fresh daily from local sustainable farms', 'Groceries', 'Coimbatore', 8900, 'INR', NULL, 4.9, 15, 19, 1.2, ARRAY['milk', 'dairy', 'doodh', 'paal', 'groceries', 'fresh'], CURRENT_DATE + INTERVAL '2 days'),
  ('EXP-002', 'Masala Rolled Oats', 'Nutritious whole grain rolled oats with Indian herbs and spices', 'Groceries', 'Coimbatore', 14900, 'INR', NULL, 4.5, 20, 29, 1.8, ARRAY['oats', 'groceries', 'breakfast', 'grains'], CURRENT_DATE + INTERVAL '45 days'),
  ('EXP-003', 'Expired Test Curd', 'Probiotic curd for testing expired item filtration in catalog and orders', 'Groceries', 'Coimbatore', 6500, 'INR', NULL, 3.8, 15, 19, 1.0, ARRAY['curd', 'dairy', 'doodh', 'groceries', 'test'], CURRENT_DATE - INTERVAL '3 days'),
  ('EXP-004', 'Fresh Malai Paneer', 'Soft rich cottage cheese packed fresh daily in vacuum seal', 'Groceries', 'Bengaluru', 12000, 'INR', NULL, 4.8, 20, 29, 2.0, ARRAY['paneer', 'dairy', 'doodh', 'groceries', 'fresh'], CURRENT_DATE + INTERVAL '4 days')

ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  city = EXCLUDED.city,
  price_cents = EXCLUDED.price_cents,
  currency = EXCLUDED.currency,
  image_url = EXCLUDED.image_url,
  rating = EXCLUDED.rating,
  delivery_time_mins = EXCLUDED.delivery_time_mins,
  delivery_fee = EXCLUDED.delivery_fee,
  distance_km = EXCLUDED.distance_km,
  tags = EXCLUDED.tags,
  expiry_date = EXCLUDED.expiry_date,
  is_active = TRUE;

-- Seed Inventory (Idempotent: reset test products stock, set others to 25)
INSERT INTO inventory (product_id, stock_count, reserved_count)
SELECT 
  id,
  CASE 
    WHEN sku = 'LAST-ITEM-TEST' THEN 1
    WHEN sku = 'SOLDOUT-001' THEN 0
    WHEN sku = 'EXP-001' THEN 30
    WHEN sku = 'EXP-002' THEN 24
    WHEN sku = 'EXP-003' THEN 8
    WHEN sku = 'EXP-004' THEN 15
    ELSE 25
  END AS stock_count,
  0 AS reserved_count
FROM products
ON CONFLICT (product_id) DO UPDATE SET
  stock_count = EXCLUDED.stock_count,
  reserved_count = 0;

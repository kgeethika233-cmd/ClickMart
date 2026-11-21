import { kafka } from '../kafka.js';
import { opensearch } from '../opensearch.js';
import { pool } from '../db.js';
import { logger } from '../logger.js';
import { computeExpiryInfo } from '../utils/expiry.js';

async function run() {
  const consumer = kafka.consumer({ groupId: 'search-indexer' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'inventory.updated', fromBeginning: false });
  await consumer.subscribe({ topic: 'product.changed', fromBeginning: false });

  logger.info('Search indexer worker subscribed to inventory.updated & product.changed.');

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      let raw: any;
      try {
        raw = JSON.parse(message.value.toString());
      } catch (e) {
        return;
      }
      const data = raw.data || raw;

      try {
        if (topic === 'inventory.updated') {
          const productId = String(data.productId);
          const available = Math.max(0, Number(data.availableCount || 0));

          try {
            await opensearch.update({
              index: 'products',
              id: productId,
              retry_on_conflict: 3,
              refresh: true,
              body: {
                doc: {
                  stock_count: available,
                  in_stock: available > 0,
                  updated_at: new Date().toISOString(),
                },
              },
            });
            logger.info(`[SEARCH] Updated stock for product #${productId} to ${available} (inStock: ${available > 0})`);
          } catch (err: any) {
            if (err.meta?.statusCode === 404 || err.statusCode === 404) {
              // Product not yet in index, load from DB
              const { rows } = await pool.query(
                `SELECT p.*, (i.stock_count - i.reserved_count) AS available_count 
                 FROM products p JOIN inventory i ON i.product_id = p.id 
                 WHERE p.id = $1`,
                [data.productId]
              );
              if (rows.length > 0) {
                const p = rows[0];
                const avail = Math.max(0, p.available_count);
                const expiry = computeExpiryInfo(p.expiry_date);
                await opensearch.index({
                  index: 'products',
                  id: productId,
                  refresh: true,
                  body: {
                    product_id: p.id,
                    sku: p.sku,
                    name: p.name,
                    description: p.description,
                    category: p.category,
                    city: p.city,
                    price: Number(p.price_cents) / 100,
                    price_cents: p.price_cents,
                    currency: p.currency,
                    image_url: p.image_url,
                    stock_count: avail,
                    in_stock: avail > 0,
                    rating: p.rating ? Number(p.rating) : 4.5,
                    delivery_time_mins: p.delivery_time_mins ?? 30,
                    delivery_fee: p.delivery_fee ?? 49,
                    distance_km: p.distance_km ? Number(p.distance_km) : 3.5,
                    tags: Array.isArray(p.tags) ? p.tags : [],
                    expiry_date: expiry.expiry_date,
                    days_to_expiry: expiry.days_to_expiry,
                    expiry_status: expiry.expiry_status,
                    badge: expiry.badge,
                    is_active: p.is_active,
                    updated_at: p.updated_at,
                  },
                });
                logger.info(`[SEARCH] Indexed newly seen product #${productId}`);
              }
            } else {
              throw err;
            }
          }
        } else if (topic === 'product.changed') {
          const productId = String(data.productId || data.id);
          if (data.action === 'DELETE' || data.is_active === false) {
            await opensearch.delete({
              index: 'products',
              id: productId,
              refresh: true,
            }).catch(() => {});
            logger.info(`[SEARCH] Removed inactive product #${productId}`);
          } else {
            // Re-index product
            const { rows } = await pool.query(
              `SELECT p.*, (i.stock_count - i.reserved_count) AS available_count 
               FROM products p JOIN inventory i ON i.product_id = p.id 
               WHERE p.id = $1`,
              [productId]
            );
            if (rows.length > 0) {
              const p = rows[0];
              const avail = Math.max(0, p.available_count);
              const expiry = computeExpiryInfo(p.expiry_date);
              await opensearch.index({
                index: 'products',
                id: productId,
                refresh: true,
                body: {
                  product_id: p.id,
                  sku: p.sku,
                  name: p.name,
                  description: p.description,
                  category: p.category,
                  city: p.city,
                  price: Number(p.price_cents) / 100,
                  price_cents: p.price_cents,
                  currency: p.currency,
                  image_url: p.image_url,
                  stock_count: avail,
                  in_stock: avail > 0,
                  rating: p.rating ? Number(p.rating) : 4.5,
                  delivery_time_mins: p.delivery_time_mins ?? 30,
                  delivery_fee: p.delivery_fee ?? 49,
                  distance_km: p.distance_km ? Number(p.distance_km) : 3.5,
                  tags: Array.isArray(p.tags) ? p.tags : [],
                  expiry_date: expiry.expiry_date,
                  days_to_expiry: expiry.days_to_expiry,
                  expiry_status: expiry.expiry_status,
                  badge: expiry.badge,
                  is_active: p.is_active,
                  updated_at: p.updated_at,
                },
              });
              logger.info(`[SEARCH] Re-indexed changed product #${productId}`);
            }
          }
        }
      } catch (err: any) {
        logger.error({ err, topic }, 'Search indexer error processing event');
      }
    },
  });
}

run().catch((err) => {
  logger.error({ err }, 'Search indexer crashed');
  process.exit(1);
});

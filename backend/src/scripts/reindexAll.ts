import { pool } from '../db.js';
import { opensearch } from '../opensearch.js';
import { logger } from '../logger.js';

async function reindexAll() {
  try {
    const { rows: products } = await pool.query(`
      SELECT 
        p.id AS product_id,
        p.sku,
        p.name,
        p.description,
        p.category,
        p.city,
        p.price_cents,
        p.currency,
        p.image_url,
        p.is_active,
        p.updated_at,
        (i.stock_count - i.reserved_count) AS available_count
      FROM products p
      JOIN inventory i ON i.product_id = p.id
      WHERE p.is_active = TRUE
      ORDER BY p.id ASC
    `);

    logger.info(`Found ${products.length} products to index in OpenSearch.`);

    const operations = products.flatMap((p) => {
      const available = Math.max(0, p.available_count);
      return [
        { index: { _index: 'products', _id: String(p.product_id) } },
        {
          product_id: p.product_id,
          sku: p.sku,
          name: p.name,
          description: p.description,
          category: p.category,
          city: p.city,
          price: Number(p.price_cents) / 100,
          currency: p.currency,
          image_url: p.image_url,
          stock_count: available,
          in_stock: available > 0,
          is_active: p.is_active,
          updated_at: p.updated_at,
        },
      ];
    });

    if (operations.length > 0) {
      const response = await opensearch.bulk({
        refresh: true,
        body: operations,
      });

      if ((response.body || response).errors) {
        logger.error('Errors occurred during bulk indexing');
      } else {
        logger.info(`✅ Successfully bulk indexed ${products.length} products into OpenSearch.`);
      }
    }
  } catch (err: any) {
    logger.error({ err }, 'Failed to reindex products');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

reindexAll();

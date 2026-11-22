import { pool } from '../db.js';
import { opensearch } from '../opensearch.js';
import { logger } from '../logger.js';
import { computeExpiryInfo } from '../utils/expiry.js';

async function reindexAll() {
  try {
    const indexName = 'products_v1';
    const aliasName = 'products';

    logger.info('Preparing OpenSearch index for clean full reindex...');

    // Delete existing alias and index if exists
    const aliasExists = await opensearch.indices.existsAlias({ name: aliasName }).catch(() => false);
    if (aliasExists.body ?? aliasExists) {
      const aliasData = await opensearch.indices.getAlias({ name: aliasName });
      const indices = Object.keys(aliasData.body || aliasData);
      for (const idx of indices) {
        await opensearch.indices.delete({ index: idx }).catch(() => {});
      }
    }

    const indexExists = await opensearch.indices.exists({ index: indexName }).catch(() => false);
    if (indexExists.body ?? indexExists) {
      await opensearch.indices.delete({ index: indexName }).catch(() => {});
    }

    // Create fresh index
    const properties = {
      product_id: { type: 'integer' },
      sku: { type: 'keyword' },
      name: {
        type: 'text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      description: { type: 'text' },
      category: { type: 'keyword' },
      city: { type: 'keyword' },
      price: { type: 'float' },
      price_cents: { type: 'integer' },
      currency: { type: 'keyword' },
      image_url: { type: 'keyword', index: false },
      stock_count: { type: 'integer' },
      in_stock: { type: 'boolean' },
      rating: { type: 'float' },
      delivery_time_mins: { type: 'integer' },
      delivery_fee: { type: 'integer' },
      distance_km: { type: 'float' },
      tags: { type: 'keyword' },
      expiry_date: { type: 'date', format: 'yyyy-MM-dd||epoch_millis' },
      days_to_expiry: { type: 'integer' },
      expiry_status: { type: 'keyword' },
      badge: { type: 'keyword' },
      is_active: { type: 'boolean' },
      updated_at: { type: 'date' },
    };

    await opensearch.indices.create({
      index: indexName,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
        },
        mappings: { properties },
      },
    });

    await opensearch.indices.putAlias({
      index: indexName,
      name: aliasName,
    });

    logger.info(`✅ Fresh index ${indexName} created and linked to alias ${aliasName}.`);

    // Fetch in-stock and non-expired products from Postgres
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
        p.rating,
        p.delivery_time_mins,
        p.delivery_fee,
        p.distance_km,
        p.tags,
        p.expiry_date,
        p.is_active,
        p.updated_at,
        (i.stock_count - i.reserved_count) AS available_count
      FROM products p
      JOIN inventory i ON i.product_id = p.id
      WHERE p.is_active = TRUE 
        AND (i.stock_count - i.reserved_count) > 0
        AND (p.expiry_date IS NULL OR p.expiry_date >= CURRENT_DATE)
      ORDER BY p.id ASC
    `);

    logger.info(`Found ${products.length} in-stock active products in PostgreSQL to index.`);

    const operations = products.flatMap((p) => {
      const available = Math.max(0, p.available_count);
      const expiry = computeExpiryInfo(p.expiry_date);

      return [
        { index: { _index: aliasName, _id: String(p.product_id) } },
        {
          product_id: p.product_id,
          sku: p.sku,
          name: p.name,
          description: p.description,
          category: p.category,
          city: p.city,
          price: Number(p.price_cents) / 100,
          price_cents: p.price_cents,
          currency: p.currency,
          image_url: p.image_url,
          stock_count: available,
          in_stock: true,
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

    // Verify document count
    const countRes = await opensearch.count({ index: aliasName });
    const osCount = (countRes.body || countRes).count;
    logger.info(`OpenSearch document count: ${osCount}, PostgreSQL in-stock count: ${products.length}`);

    if (osCount === products.length) {
      logger.info(`🎯 Perfect match: PostgreSQL in-stock count (${products.length}) === OpenSearch doc count (${osCount})`);
    } else {
      logger.warn(`Discrepancy: PG=${products.length}, OS=${osCount}`);
    }
  } catch (err: any) {
    logger.error({ err }, 'Failed to reindex products');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

reindexAll();

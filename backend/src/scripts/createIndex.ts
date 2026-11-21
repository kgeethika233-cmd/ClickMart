import { opensearch } from '../opensearch.js';
import { logger } from '../logger.js';

async function createIndex() {
  try {
    const indexName = 'products_v1';
    const aliasName = 'products';

    const directIndexExists = await opensearch.indices.exists({ index: aliasName });
    if (directIndexExists.body ?? directIndexExists) {
      const aliasCheck = await opensearch.indices.getAlias({ name: aliasName }).catch(() => null);
      if (!aliasCheck) {
        logger.info(`Deleting legacy un-aliased index ${aliasName}...`);
        await opensearch.indices.delete({ index: aliasName });
      }
    }

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

    const exists = await opensearch.indices.exists({ index: indexName });

    if (!(exists.body ?? exists)) {
      logger.info(`Creating OpenSearch index ${indexName}...`);
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
      logger.info(`✅ Index ${indexName} created.`);
    } else {
      logger.info(`Index ${indexName} already exists, updating mappings...`);
      await opensearch.indices.putMapping({
        index: indexName,
        body: { properties },
      });
      logger.info(`✅ Index ${indexName} mappings updated.`);
    }

    await opensearch.indices.putAlias({
      index: indexName,
      name: aliasName,
    });
    logger.info(`✅ Alias ${aliasName} linked to ${indexName}.`);
  } catch (err: any) {
    logger.error({ err }, 'Failed to create or update OpenSearch index');
    process.exit(1);
  }
}

createIndex();

import { opensearch } from '../opensearch.js';
import { logger } from '../logger.js';

async function createIndex() {
  try {
    const indexName = 'products_v1';
    const aliasName = 'products';

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
          mappings: {
            properties: {
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
              currency: { type: 'keyword' },
              image_url: { type: 'keyword', index: false },
              stock_count: { type: 'integer' },
              in_stock: { type: 'boolean' },
              is_active: { type: 'boolean' },
              updated_at: { type: 'date' },
            },
          },
        },
      });

      // Point alias
      await opensearch.indices.putAlias({
        index: indexName,
        name: aliasName,
      });

      logger.info(`✅ Index ${indexName} created and alias ${aliasName} linked.`);
    } else {
      logger.info(`Index ${indexName} already exists.`);
    }
  } catch (err: any) {
    logger.error({ err }, 'Failed to create OpenSearch index');
    process.exit(1);
  }
}

createIndex();

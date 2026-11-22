require('dotenv').config();
const { Client } = require('@opensearch-project/opensearch');

const client = new Client({
  node: `https://${process.env.OS_HOST}:${process.env.OS_PORT}`,
  auth: { username: process.env.OS_USER, password: process.env.OS_PASSWORD },
});

async function main() {
  const info = await client.info();
  console.log('Connected to OpenSearch', (info.body || info).version.number);

  const exists = await client.indices.exists({ index: 'products' });
  if (!(exists.body ?? exists)) {
    await client.indices.create({ index: 'products' });
  }

  await client.index({
    index: 'products',
    id: '1',
    body: { name: 'Bluetooth Headphones', description: 'Wireless over-ear headphones' },
    refresh: true,
  });

  const result = await client.search({
    index: 'products',
    body: { query: { match: { name: { query: 'bluetoth', fuzziness: 'AUTO' } } } },
  });
  const hits = (result.body || result).hits.hits;
  console.log('Search for "bluetoth" found:', hits.map((h) => h._source.name));
}

main().catch((err) => console.error('Failed:', err.message));
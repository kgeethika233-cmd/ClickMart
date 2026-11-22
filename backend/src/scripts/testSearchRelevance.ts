import { logger } from '../logger.js';

const queries = [
  'bluetoth',
  'speeker',
  'headfones',
  'earbud',
  'tshirt',
  'cofee mug',
  'yoga',
  'kettlbell',
  'keyboard',
  'saree',
  'milk',
  'oats',
  'sandals',
  'running shoes',
];

async function testSearchRelevance() {
  logger.info('Testing OpenSearch typo tolerance & query relevance for 14 benchmark terms...');

  for (const q of queries) {
    const res = await fetch(`http://localhost:4000/api/search?q=${encodeURIComponent(q)}&pageSize=5`);
    const data = await res.json() as any;
    const items = data.items || [];

    console.log(`\n------------------------------------------------------------`);
    console.log(`QUERY: "${q}" (Total found: ${data.total})`);
    console.log(`------------------------------------------------------------`);

    if (items.length === 0) {
      console.log('  [NO RESULTS FOUND]');
    } else {
      items.slice(0, 5).forEach((item: any, idx: number) => {
        console.log(`  ${idx + 1}. [${item.category}] ${item.name} (${item.city}) - ₹${item.priceCents / 100}`);
      });
    }

    if (q === 'bluetoth' || q === 'bluetooth') {
      const nonAudio = items.filter((item: any) => !['Electronics'].includes(item.category));
      if (nonAudio.length > 0) {
        logger.error(`❌ Non-audio items returned for bluetooth query: ${nonAudio.map((i: any) => i.name).join(', ')}`);
      } else {
        logger.info(`✅ 'bluetooth' returned strictly audio/electronics items!`);
      }
    }
  }
}

testSearchRelevance().catch(console.error);


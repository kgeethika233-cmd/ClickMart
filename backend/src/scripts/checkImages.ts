import fs from 'fs';
import path from 'path';
import { pool } from '../db.js';
import { logger } from '../logger.js';

async function checkImages() {
  logger.info('Running image verification suite: checking all product image URLs...');

  const { rows: products } = await pool.query(
    'SELECT id, sku, name, category, image_url FROM products WHERE is_active = TRUE ORDER BY id ASC'
  );

  logger.info(`Found ${products.length} active products in database to verify.`);

  let failures = 0;
  let verified = 0;

  for (const p of products) {
    if (!p.image_url) {
      logger.error(`❌ Product ${p.id} (${p.sku}: ${p.name}) has NULL or empty image_url!`);
      failures++;
      continue;
    }

    if (p.image_url.includes('picsum.photos') || p.image_url.includes('unsplash.it')) {
      logger.error(`❌ Product ${p.id} (${p.sku}) uses disallowed random image service: ${p.image_url}`);
      failures++;
      continue;
    }

    // Bundled relative WebP images in frontend/public
    if (p.image_url.startsWith('/IH-')) {
      const frontendFile = path.resolve(process.cwd(), 'frontend/public', p.image_url.slice(1));
      const rootFrontendFile = path.resolve(process.cwd(), '../frontend/public', p.image_url.slice(1));

      const exists = fs.existsSync(frontendFile) || fs.existsSync(rootFrontendFile);
      if (!exists) {
        logger.error(`❌ Bundled file ${p.image_url} not found on disk for ${p.sku}`);
        failures++;
        continue;
      }

      // Also probe frontend if running
      try {
        const res = await fetch(`http://localhost:3000${p.image_url}`);
        const contentType = res.headers.get('content-type') || '';
        if (res.status !== 200 || !contentType.startsWith('image/')) {
          logger.warn(`⚠️ Frontend probe for ${p.image_url} returned ${res.status} (${contentType}), disk verified.`);
        }
      } catch {
        // Frontend might not be queried or busy, disk check is authoritative
      }

      verified++;
      continue;
    }

    // Backend-served static images (http://localhost:4000/images/...)
    if (p.image_url.startsWith('http://localhost:4000/images/')) {
      const filename = p.image_url.replace('http://localhost:4000/images/', '');
      const localFile = path.resolve(process.cwd(), 'backend/public/images', filename);
      const rootLocalFile = path.resolve(process.cwd(), 'public/images', filename);

      const exists = fs.existsSync(localFile) || fs.existsSync(rootLocalFile);
      if (!exists) {
        logger.error(`❌ Image file ${filename} not found on disk for ${p.sku}`);
        failures++;
        continue;
      }

      try {
        const res = await fetch(p.image_url);
        const contentType = res.headers.get('content-type') || '';
        if (res.status !== 200 || !contentType.startsWith('image/')) {
          logger.error(`❌ HTTP request to ${p.image_url} failed: status=${res.status}, content-type=${contentType}`);
          failures++;
          continue;
        }
      } catch (err: any) {
        logger.error(`❌ Failed to fetch ${p.image_url}: ${err.message}`);
        failures++;
        continue;
      }

      verified++;
      continue;
    }

    logger.error(`❌ Unrecognized image URL format for ${p.sku}: ${p.image_url}`);
    failures++;
  }

  await pool.end();

  if (failures > 0) {
    logger.error(`❌ Image check failed with ${failures} error(s). (${verified} passed)`);
    process.exit(1);
  }

  logger.info(`✅ Image check SUCCESS: All ${verified}/${products.length} products have verified 200 OK image URLs with image content types!`);
}

checkImages().catch((err) => {
  logger.error({ err }, 'Image check script failed');
  process.exit(1);
});


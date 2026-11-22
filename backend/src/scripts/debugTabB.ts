import puppeteer from 'puppeteer-core';
import { pool } from '../db.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const { rows } = await pool.query("SELECT id FROM products WHERE sku = 'LAST-ITEM-TEST'");
  const lastItemId = rows[0].id;
  await pool.query('UPDATE inventory SET stock_count = 1, reserved_count = 0 WHERE product_id = $1', [lastItemId]);

  const page = await browser.newPage();
  
  // Clear location so it uses catalog stock
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('user-location:v1'));

  await page.goto(`http://localhost:3000/product/${lastItemId}`, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3000));

  const textBefore = await page.evaluate(() => document.body.innerText);
  console.log('Stock badge before:', textBefore.includes('Only 1 left') ? 'Only 1 left' : 'Other');

  // Trigger purchase
  const orderRes = await fetch('http://localhost:4000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerEmail: 'tab_b_debug@retailhub.in',
      customerName: 'Tab B Debug',
      idempotencyKey: `tab-b-${Date.now()}`,
      items: [{ productId: lastItemId, quantity: 1 }],
    }),
  });
  console.log('Order status:', orderRes.status);

  // Wait 2.5s for SSE
  await new Promise(r => setTimeout(r, 2500));

  const textAfter = await page.evaluate(() => document.body.innerText);
  console.log('Text after includes "Out of stock":', textAfter.includes('Out of stock'));
  console.log('Text after includes "currently unavailable":', textAfter.includes('currently unavailable'));

  const badgeText = await page.evaluate(() => document.querySelector('.stock-badge')?.textContent);
  console.log('Badge text:', badgeText);

  await browser.close();
  await pool.end();
}

main().catch(console.error);


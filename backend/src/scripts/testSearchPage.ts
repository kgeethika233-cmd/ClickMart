import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to /search?q=bluetoth...');
  await page.goto('http://localhost:3000/search?q=bluetoth', { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 4000));

  const text = await page.evaluate(() => document.body.innerText);
  console.log('--- Page text start ---');
  console.log(text.slice(0, 1000));
  console.log('--- Page text end ---');

  await browser.close();
}

main().catch(console.error);


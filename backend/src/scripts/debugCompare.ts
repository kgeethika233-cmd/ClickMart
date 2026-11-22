import puppeteer from 'puppeteer-core';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  page.on('console', msg => console.log('[CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
  page.on('request', req => console.log('[REQ]', req.method(), req.url()));
  page.on('requestfailed', req => console.log('[REQ FAILED]', req.url(), req.failure()?.errorText));
  page.on('response', res => {
    console.log('[RES]', res.status(), res.url());
  });

  await page.goto('http://localhost:3000/search?q=bluetooth', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem(
      'user-location:v1',
      JSON.stringify({
        name: 'Indiranagar',
        pincode: '560038',
        lat: 12.9784,
        lng: 77.6408,
        city: 'Bengaluru',
      })
    );
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 2000));

  const compareTrigger = await page.$('button[aria-controls^="product-compare-"]');
  if (compareTrigger) {
    await compareTrigger.click();
    console.log('Clicked compare trigger, waiting 6 seconds...');
    await new Promise(r => setTimeout(r, 6000));
    const testDirectFetch = await page.evaluate(async () => {
      try {
        const r = await fetch('http://localhost:4000/api/products/33');
        return { status: r.status, ok: r.ok };
      } catch (e: any) {
        return { err: e.message };
      }
    });
    console.log('Direct fetch from page context:', testDirectFetch);
    const errorDetails = await page.evaluate(() => {
      const stateDiv = document.querySelector('div[role="alert"]');
      return stateDiv ? stateDiv.textContent : 'No alert div';
    });
    console.log('Alert text on page:', errorDetails);
    console.log('--- PANEL HTML AFTER 6s ---');
    console.log(panelHtml.slice(0, 1500));

    // Try clicking Retry button if present
    const retryBtn = await page.$('section[id^="product-compare-"] button');
    if (retryBtn) {
      console.log('Found Retry button, clicking it...');
      await retryBtn.click();
      await new Promise(r => setTimeout(r, 3000));
      const retryHtml = await page.evaluate(() => {
        const panel = document.querySelector('section[id^="product-compare-"]');
        return panel ? panel.innerHTML : 'No panel found';
      });
      console.log('--- PANEL HTML AFTER RETRY ---');
      console.log(retryHtml.slice(0, 1500));
    }
  }

  await browser.close();
}

main().catch(console.error);

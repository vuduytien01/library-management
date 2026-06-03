const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR LOG:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE EXCEPTION:', error.message);
  });

  await page.goto('http://localhost:8081', { waitUntil: 'networkidle0', timeout: 30000 });
  const html = await page.content();
  if (html.includes('Something went wrong')) {
    console.log('Page rendered Error Boundary!');
  }
  await browser.close();
})();

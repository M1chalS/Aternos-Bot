import { getFreePort, resolveChromiumPath, randomUserAgent } from './global/set';
import puppeteer, { Browser, Page, Cookie } from 'puppeteer';
import { Server as ProxyChainServer } from 'proxy-chain';
import fs from 'fs';
import path from 'path';

const cookiesPath = path.resolve(process.cwd(), 'aternos-cookies.json');

export async function loginToAternos(user: string, pass: string): Promise<Cookie[]> {
  // if (fs.existsSync(cookiesPath)) {
  //   try {
  //     const raw = fs.readFileSync(cookiesPath, 'utf8');
  //     if (raw.trim().length > 0) {
  //       const cookies: Cookie[] = JSON.parse(raw);
  //       return cookies;
  //     }
  //   } catch {
  //     console.warn('⚠️ Invalid or corrupted cookies file. Regenerating...');
  //   }
  // }

  const port = await getFreePort();
  const proxyServer = new ProxyChainServer({ port });

  await proxyServer.listen(() => {
    console.log(`🧪 Proxy listening on 127.0.0.1:${port}`);
  });

  const browser: Browser = await puppeteer.launch({
    headless: true,
    args: [
      '--ignore-certificate-errors',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      `--proxy-server=127.0.0.1:${port}`,
    ],
  });

  const page: Page = await browser.newPage();
  await page.setUserAgent(
    randomUserAgent()
  );


  await page.goto('https://aternos.org/go/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

  await page.type('input.username', user, { delay: 50 });
  await page.type('input.password', pass, { delay: 50 });
  await page.click('button.login-button');

  await new Promise(resolve => setTimeout(resolve, 5000));

  const cookies: Cookie[] = await browser.cookies();
  fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));

  await browser.close();
  await proxyServer.close(true);

  return cookies;
}
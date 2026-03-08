import { getFreePort, resolveChromiumPath, randomUserAgent } from './global/set';
import puppeteer, { Browser, Page, Cookie } from 'puppeteer';
import { Server as ProxyChainServer } from 'proxy-chain';

interface ServerInfo {
  name: string | null;
  id: string | null;
  status: 'online' | 'offline' | 'unknown';
  software: string | null;
  players: string | null;
}

interface ServerListResponse {
  servers: ServerInfo[];
}

export async function getServerList(cookies: Cookie[]): Promise<ServerListResponse> {
  const port = await getFreePort();
  const proxyServer = new ProxyChainServer({ port });
  await proxyServer.listen(() => {});

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

  await browser.setCookie(...cookies);

  const page: Page = await browser.newPage();

  let servers: ServerInfo[] = [];
  try {
    await page.setUserAgent(
      randomUserAgent()
    );
    await page.goto('https://aternos.org/servers/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    if (page.url().includes('/go/')) {
      throw new Error('Authentication failed. Redirected back to login page.');
    }

    await page.waitForSelector('.servercard', { timeout: 20000 });

    servers = await page.evaluate(() => {
      const serverList: ServerInfo[] = [];
      const serverCards = document.querySelectorAll('.servercard');
      serverCards.forEach(card => {
        const serverName = card.querySelector('.server-name')?.textContent?.trim() || null;
        const serverId = card.querySelector('.server-id')?.textContent?.trim().replace('#', '') || null;
        const status = card.classList.contains('offline')
          ? 'offline'
          : card.classList.contains('online')
          ? 'online'
          : 'unknown';
        const software = card.querySelector('.server-software-name')?.textContent?.trim() || null;
        const players = card.querySelector('.statusplayerbadge')?.textContent?.trim() || null;
        serverList.push({ name: serverName, id: serverId, status, software, players });
      });
      return serverList;
    });

  } catch (error) {
    console.error(`❌ An error occurred during server list fetching:`, error);
  } finally {
    await browser.close();
    await proxyServer.close(true);
  }

  return { servers };
}
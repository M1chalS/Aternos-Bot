import { getFreePort, resolveChromiumPath, randomUserAgent } from './global/set';
import puppeteer, { Browser, Page, Cookie } from 'puppeteer';
import { Server as ProxyChainServer } from 'proxy-chain';
import gradient from 'gradient-string';

const logGradients = [
  gradient('cyan', 'lightgreen'),
  gradient('orange', 'yellow'),
  gradient('#FF7E5F', '#FEB47B'),
];

export async function viewConsoleLive(cookies: Cookie[], serverId: string): Promise<void> {
  if (!serverId) {
    console.error('Error: Server ID is required.');
    return;
  }

  let browser: Browser | null = null;
  let proxyServer: ProxyChainServer | null = null;

  try {
    const port = await getFreePort();
    proxyServer = new ProxyChainServer({ port });
    await proxyServer.listen(() => {});

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--ignore-certificate-errors',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        `--proxy-server=127.0.0.1:${port}`,
      ],
    });

    await browser.setCookie(...cookies);

    const page: Page = await browser.newPage();
    await page.setUserAgent(randomUserAgent());

    await page.goto('https://aternos.org/servers/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    const serverCardFound = await page.evaluate((id) => {
        const serverCards = document.querySelectorAll('.servercard');
        for (const card of serverCards) {
          const idElement = card.querySelector('.server-id');
          if (idElement && idElement.textContent?.trim().replace('#', '') === id) {
            (card as HTMLElement).click();
            return true;
          }
        }
        return false;
      }, serverId);

    if (!serverCardFound) {
      throw new Error(`Server with ID '${serverId}' not found on the page.`);
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    await page.goto('https://aternos.org/console/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForSelector('#console', { timeout: 20000 });

    console.log(gradient.atlas.multiline('--- LIVE CONSOLE ---'));
    const seenLogs = new Set<string>();

    while (true) {
      const allLogs = await page.evaluate(() => 
        Array.from(document.querySelectorAll('#console .line')).map(el => el.textContent || '')
      );

      const newLogs = allLogs.filter(log => !seenLogs.has(log));

      if (newLogs.length > 0) {
        for (const log of newLogs) {
          seenLogs.add(log);
          const cleanedLog = log.replace(/^\[.*?\]\s*/, '');
          const randomGradient = logGradients[Math.floor(Math.random() * logGradients.length)]!;

          if(cleanedLog.trim()) {
            console.log(randomGradient(cleanedLog));
          }

          const connectMatch = /Player connected: (.*?),\s*xuid:/.exec(log);
          if (connectMatch && connectMatch[1]) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const playerName = connectMatch[1];
            const welcomeMessage = `/say \u00A7bWelcome, \u00A7e${playerName}\u00A7b!`;
            await page.type('#c-input', welcomeMessage);
            await page.keyboard.press('Enter');
          }

          const disconnectMatch = /Player disconnected: (.*?),\s*xuid:/.exec(log);
          if (disconnectMatch && disconnectMatch[1]) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const playerName = disconnectMatch[1];
            const goodbyeMessage = `/say \u00A7cBye, ${playerName}!`;
            await page.type('#c-input', goodbyeMessage);
            await page.keyboard.press('Enter');
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

  } catch (error) {
    console.error(gradient.passion('An error occurred in the console viewer:'));
    if (error instanceof Error) {
        console.error(gradient.passion(error.message));
    } else {
        console.error(gradient.passion(String(error)));
    }
  } finally {
    if (browser) await browser.close();
    if (proxyServer) await proxyServer.close(true);
    console.log(gradient.atlas.multiline('--- CONSOLE CLOSED ---'));
  }
}
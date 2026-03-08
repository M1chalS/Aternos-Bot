import { getFreePort, resolveChromiumPath, randomUserAgent } from './global/set';
import puppeteer, { Browser, Page, Cookie } from 'puppeteer-core';
import { Server as ProxyChainServer } from 'proxy-chain';

interface DashboardInfo {
  shareUrl: string | null;
  address: string | null;
  port: string | null;
  software: string | null;
  version: string | null;
  players: string | null;
  ram: string | null;
}

interface ActionResult {
  success: boolean;
  message: string;
  status?: string | null;
  timeRemaining?: string | null;
}

type ServerTask = 'info' | 'start' | 'stop' | 'restart';

export async function manageServer(cookies: Cookie[], serverId: string, task: 'info'): Promise<DashboardInfo | null>;
export async function manageServer(cookies: Cookie[], serverId: string, task: 'start' | 'stop' | 'restart'): Promise<ActionResult>;
export async function manageServer(cookies: Cookie[], serverId: string, task: ServerTask): Promise<DashboardInfo | null | ActionResult> {
  if (!serverId) {
    return task === 'info' ? null : { success: false, message: 'Error: Server ID is required.' };
  }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let browser: Browser | null = null;
    let proxyServer: ProxyChainServer | null = null;
    
    try {
      const port = await getFreePort();
      proxyServer = new ProxyChainServer({ port });
      await proxyServer.listen(() => {});

      browser = await puppeteer.launch({
        headless: true,
        executablePath: resolveChromiumPath(),
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

      await page.setUserAgent(
        randomUserAgent()
      );
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
      
      if (task === 'info') {
        const info = await page.evaluate(() => {
          const getText = (selector: string) => document.querySelector(selector)?.textContent?.trim() || null;
          return {
            shareUrl: getText('#share-url'),
            address: getText('#ip'),
            port: getText('#port'),
            software: getText('#software'),
            version: getText('#version'),
            players: getText('.js-players'),
            ram: getText('.js-ram')
          };
        });
        return info;
      } else {
        await page.waitForSelector('.fc-cta-consent', { visible: true, timeout: 10000 });
        await page.click('.fc-cta-consent');

        const currentStatus = await page.evaluate(() => document.querySelector('.statuslabel-label')?.textContent?.trim() || null);

        if (task === 'start') {
          if (currentStatus === 'Online') {
            const timeRemaining = await page.evaluate(() => document.querySelector('.server-end-countdown')?.textContent?.trim() || 'N/A');
            return { success: true, message: 'Server is already online.', status: 'Online', timeRemaining };
          }
          if (currentStatus !== 'Offline') {
            return { success: false, message: `Server is not offline. Current status: ${currentStatus}` };
          }
        }

        if ((task === 'stop' || task === 'restart') && currentStatus !== 'Online') {
          return { success: false, message: `Server is not online. Current status: ${currentStatus}` };
        }

        const selector = `#${task}`;
        await page.waitForSelector(selector, { visible: true, timeout: 10000 });

        await page.click(selector);

        if (task === 'start') {
          const keywords = ['yes', 'okay', 'accept', 'confirm', 'agree', 'continue', 'proceed', 'next', 'ok'];
          const clickDialogButton = async () => {
            try {
              await page.waitForFunction((kws) => {
                const buttons = document.querySelectorAll('.alert-buttons button.btn-success');
                for (const button of buttons) {
                  const buttonText = button.textContent?.trim().toLowerCase() || '';
                  if (kws.some(kw => buttonText.includes(kw))) {
                    (button as HTMLElement).click();
                    return true;
                  }
                }
                return false;
              }, { timeout: 5000 }, keywords);
            } catch (e) {}
          };
          
          await clickDialogButton();
          await clickDialogButton();
          
          try {
            await page.waitForSelector('#confirm', { visible: true, timeout: 15000 });
            await page.click('#confirm');
          } catch(e) {}
        }

        if (task === 'start' || task === 'restart') {
          await page.waitForFunction(() => document.querySelector('.statuslabel-label')?.textContent?.trim() === 'Online', { timeout: 180000 });
        } else if (task === 'stop') {
          await page.waitForFunction(() => document.querySelector('.statuslabel-label')?.textContent?.trim() === 'Offline', { timeout: 60000 });
        }
        
        return { success: true, message: `Action '${task}' performed successfully.` };
      }
    } catch (error) {
      const errorMessage = (error as Error).message.toLowerCase();
      if (browser) await browser.close();
      if (proxyServer) await proxyServer.close(true);
      
      if ((errorMessage.includes('connection') || errorMessage.includes('target closed')) && attempt < maxAttempts) {
        console.error(`Attempt ${attempt} failed with connection error. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error(`Failed to perform task '${task}' on server ${serverId}.`, error);
        return task === 'info' ? null : { success: false, message: (error as Error).message + "Retry Rerun the console i think delay it"};
      }
    } finally {
        if (browser && !browser.process()?.killed) await browser.close();
        if (proxyServer) await proxyServer.close(true);
    }
  }

  return task === 'info' ? null : { success: false, message: `Action failed after all ${maxAttempts} attempts.` + "Retry Rerun the console i think delay it"};
}
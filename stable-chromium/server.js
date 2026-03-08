const puppeteer = require('puppeteer');
const freeport = require('freeport');
const ProxyChain = require('proxy-chain');
const path = require('path');
const fs = require('fs');
const gradient = require('gradient-string');
const { execSync } = require('child_process');

/**
 * Resolves the path to a working Chromium executable.
 * This is a helper function to ensure Puppeteer can find the browser.
 *
 * @returns {string} Absolute path to a usable Chromium executable.
 */
function resolveChromiumPath() {
  const localPath = path.resolve(
    __dirname,
    '../stable-chromium/chrome-linux/chrome-linux64/chrome'
  );

  if (fs.existsSync(localPath)) {
    return localPath;
  }

  try {
    return execSync('which chromium').toString().trim();
  } catch {
    console.error('❌ Chromium not found. Install with apt or make sure it is in your PATH.');
    process.exit(1);
  }
}

/**
 * @typedef {object} ServerInfo
 * @property {string | null} name - The name of the server, e.g., "ChoruOfficial".
 * @property {string | null} id - The unique identifier for the server, e.g., "5oMb5QMayDeWOxxG".
 * @property {'online' | 'offline' | 'unknown'} status - The current status of the server.
 * @property {string | null} software - The server software and version, e.g., "Bedrock 1.21.84.1".
 * @property {string | null} players - A string representing the current player count, e.g., "0/20".
 */

/**
 * @typedef {object} ServerListResponse
 * @property {ServerInfo[]} servers - An array of objects, each containing server details.
 */

/**
 * Navigates to the Aternos servers page using an authenticated session and scrapes the list of available servers.
 * It uses the same proxy and browser configuration as the login script for consistency.
 *
 * @param {import('puppeteer-core').Protocol.Network.Cookie[]} cookies - An array of cookie objects obtained from a successful login.
 * @returns {Promise<ServerListResponse>} A promise that resolves to an object containing the scraped server data.
 */
async function getServerList(cookies) {
  const port = await new Promise((resolve, reject) =>
    freeport((err, port) => (err ? reject(err) : resolve(port)))
  );

  const proxyServer = new ProxyChain.Server({ port });
  await proxyServer.listen(() =>
    console.log(`🔗 Scraper proxy listening on 127.0.0.1:${port}`)
  );

  const chromiumPath = resolveChromiumPath();

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: chromiumPath,
    ignoreHTTPSErrors: true,
    args: [
      '--ignore-certificate-errors',
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      `--proxy-server=127.0.0.1:${port}`,
    ],
  });

  const page = await browser.newPage();

  await page.setCookie(...cookies);

  await page.goto('https://aternos.org/servers/', { waitUntil: 'networkidle2' });

  const servers = await page.evaluate(() => {
    const serverList = [];
    const serverCards = document.querySelectorAll('.servercard');

    serverCards.forEach(card => {
      const serverName = card.querySelector('.server-name')?.innerText.trim() || null;
      const serverId = card.querySelector('.server-id')?.innerText.trim().replace('#', '') || null;
      const status = card.classList.contains('offline') ? 'offline' : (card.classList.contains('online') ? 'online' : 'unknown');
      const software = card.querySelector('.server-software-name')?.innerText.trim() || null;
      const players = card.querySelector('.statusplayerbadge')?.innerText.trim() || null;

      serverList.push({
        name: serverName,
        id: serverId,
        status: status,
        software: software,
        players: players,
      });
    });

    return serverList;
  });

  console.log(gradient(['#b0d7ff', '#0077ff'])('✅ Success Scrape: Fetched server list.'));

  await browser.close();
  await proxyServer.close();

  return { servers };
}

module.exports = { getServerList };
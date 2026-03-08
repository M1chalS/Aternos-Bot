import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import freeport from 'freeport';

export function resolveChromiumPath(): string {
  const localPath = path.resolve(
    __dirname,
    '../../stable-chromium/chrome-linux/chrome-linux64/chrome'
  );

  if (fs.existsSync(localPath)) return localPath;

  try {
    return execSync('which chromium').toString().trim();
  } catch {
    console.error('Chromium not found. Install with apt.');
    process.exit(1);
  }
}

export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    freeport((err: Error | null, port: number | null) => {
      if (err || port === null) return reject(err);
      resolve(port);
    });
  });
}

export function randomUserAgent(): string {
  const data = {
    platforms: ["Windows NT 10.0; Win64; x64", "Macintosh; Intel Mac OS X 10_15_7"],
    browsers: {
      chrome: ["125.0.0.0", "124.0.0.0"],
      firefox: ["126.0", "125.0"],
      edge: ["125.0.2535.51"],
    },
  };

  const randomItem = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];

  const os = randomItem(data.platforms);
  const browserKeys = Object.keys(data.browsers);
  const browserName = randomItem(browserKeys);
  const browserVersion = randomItem(data.browsers[browserName as keyof typeof data.browsers]);

  if (browserName === 'firefox') {
    return `Mozilla/5.0 (${os}; rv:${browserVersion}) Gecko/20100101 Firefox/${browserVersion}`;
  }

  if (browserName === 'edge') {
    const chromeVersion = randomItem(data.browsers.chrome);
    return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36 Edg/${browserVersion}`;
  }

  return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion} Safari/537.36`;
}

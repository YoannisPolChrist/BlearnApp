const { chromium } = require('playwright');
const http = require('http');
const handler = require('serve-handler');

(async () => {
  const args = process.argv.slice(2);
  const useDevServer = args[0] === '--dev';
  let targetUrl = useDevServer ? args[1] : args[0];
  let cleanup;

  if (useDevServer) {
    const { createServer, mergeConfig, loadConfigFromFile } = await import('vite');
    const loaded = await loadConfigFromFile(
      { command: 'serve', mode: 'development' },
      'vite.config.ts',
    );
    const baseConfig = loaded?.config ?? {};
    const merged = mergeConfig(baseConfig, {
      configFile: false,
      mode: 'development',
      server: { host: '127.0.0.1', port: 0, strictPort: false },
    });
    const vite = await createServer(merged);
    await vite.listen();
    const address = vite.httpServer.address();
    const port = typeof address === 'object' && address ? address.port : 5173;
    targetUrl = `http://127.0.0.1:${port}`;
    cleanup = () => vite.close();
  } else if (!targetUrl) {
    const server = http.createServer((request, response) =>
      handler(request, response, { public: 'dist' }),
    );

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    targetUrl = `http://127.0.0.1:${port}`;
    cleanup = () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));
  await page.goto(targetUrl);
  await page.waitForTimeout(4000);
  await browser.close();

  if (cleanup) {
    await cleanup();
  }
})();

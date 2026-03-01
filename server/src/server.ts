import { createServer } from 'http';
import { existsSync, createReadStream, statSync } from 'fs';
import { join } from 'path';
import next from 'next';
import { parse } from 'url';
import { createWebSocketServer } from './websocket/ws-server';
import { proxyManager } from './proxy/proxy-manager';

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);

    // Serve APK download
    if (parsedUrl.pathname === '/download/app.apk' && req.method === 'GET') {
      const apkPath = join(__dirname, '..', 'public', 'app.apk');
      if (existsSync(apkPath)) {
        const stat = statSync(apkPath);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Disposition': 'attachment; filename="MobileProxy.apk"',
          'Content-Length': stat.size,
        });
        createReadStream(apkPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'APK not built yet. Run build-apk.bat to build the APK.',
        }));
      }
      return;
    }

    handle(req, res, parsedUrl);
  });

  // Attach WebSocket server
  createWebSocketServer(server);

  // Load and start all configured proxy ports
  proxyManager.loadAllFromDb().then(() => {
    console.log('[Server] Proxy ports loaded from database');
  });

  server.listen(port, hostname, () => {
    console.log(`[Server] Ready on http://${hostname}:${port}`);
    console.log(`[Server] WebSocket available on ws://${hostname}:${port}/ws`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[Server] SIGTERM received, shutting down...');
    await proxyManager.stopAll();
    server.close();
    process.exit(0);
  });
});

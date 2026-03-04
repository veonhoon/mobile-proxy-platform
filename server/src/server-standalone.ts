process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[FATAL] Unhandled rejection:', err);
});

import { createServer } from 'http';
import { parse } from 'url';
import { createWebSocketServer } from './websocket/ws-server';
import { proxyManager } from './proxy/proxy-manager';
import { deviceRegistry } from './websocket/device-registry';

const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const server = createServer((req, res) => {
  const parsedUrl = parse(req.url!, true);
  const pathname = parsedUrl.pathname || '';

  // Health endpoint
  if (pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      devices: deviceRegistry.getOnlineCount(),
      proxies: proxyManager.getRunningCount(),
    }));
    return;
  }

  // Change IP endpoint: POST /api/devices/:id/change-ip
  const changeIpMatch = pathname.match(/^\/api\/devices\/([^/]+)\/change-ip$/);
  if (changeIpMatch && req.method === 'POST') {
    const deviceId = changeIpMatch[1];
    const sent = deviceRegistry.sendChangeIp(deviceId);
    if (sent) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Change IP command sent' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Device not connected' }));
    }
    return;
  }

  // List devices endpoint
  if (pathname === '/api/devices' && req.method === 'GET') {
    const devices = deviceRegistry.getAll().map(d => ({
      deviceId: d.deviceId,
      name: d.name,
      carrier: d.carrier,
      ipAddress: d.ipAddress,
      connectedAt: d.connectedAt,
      lastPong: d.lastPong,
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(devices));
    return;
  }

  // Pair device endpoint — exchanges pairing code for device key
  if (pathname === '/api/pair' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { pairingCode } = JSON.parse(body);
        if (!pairingCode) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'pairingCode required' }));
          return;
        }
        // Look up device by pairing code in DB
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.device.findFirst({ where: { pairingCode } }).then((device: any) => {
          prisma.$disconnect();
          if (!device) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid pairing code' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ deviceKey: device.deviceKey, deviceId: device.id }));
        }).catch((err: any) => {
          prisma.$disconnect();
          console.error('[Pair] DB error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Server error' }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Health/status endpoint
  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', devices: deviceRegistry.getAll().length }));
    return;
  }

  // Default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Attach WebSocket server
createWebSocketServer(server);

// Load proxy ports from DB
proxyManager.loadAllFromDb().then(() => {
  console.log('[Server] Proxy ports loaded from database');
}).catch(err => {
  console.error('[Server] Failed to load proxy ports:', err);
});

server.listen(port, hostname, () => {
  console.log(`[Server] Standalone server ready on http://${hostname}:${port}`);
  console.log(`[Server] WebSocket available on ws://${hostname}:${port}/ws`);
});

process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down...');
  await proxyManager.stopAll();
  server.close();
  process.exit(0);
});

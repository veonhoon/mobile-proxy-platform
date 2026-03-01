import { Server as HttpServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/db';
import { deviceRegistry, ConnectedDevice } from './device-registry';
import {
  PhoneToServerMessage,
  RegisterMessage,
  parseBinaryFrame,
} from './protocol';
import { tunnelManager } from '../proxy/tunnel';

const HEARTBEAT_INTERVAL = 30_000;

export function createWebSocketServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  console.log('[WS] WebSocket server created on /ws');

  wss.on('connection', (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress || 'unknown';
    console.log(`[WS] New connection from ${clientIp}`);

    let registeredDeviceId: string | null = null;

    ws.on('message', async (rawData: WebSocket.RawData, isBinary: boolean) => {
      // Handle binary frames (proxy data from phone)
      if (isBinary) {
        const data = rawData as Buffer;
        const { requestId, payload } = parseBinaryFrame(data);
        tunnelManager.handlePhoneData(requestId, payload);
        return;
      }

      // Handle JSON control messages
      try {
        const message: PhoneToServerMessage = JSON.parse(rawData.toString());

        switch (message.type) {
          case 'register':
            registeredDeviceId = await handleRegister(ws, message, clientIp);
            break;

          case 'proxy_response_headers':
            tunnelManager.handleResponseHeaders(
              message.requestId,
              message.statusCode,
              message.headers
            );
            break;

          case 'proxy_response_end':
            tunnelManager.handleResponseEnd(message.requestId);
            break;

          case 'proxy_error':
            tunnelManager.handleProxyError(message.requestId, message.error);
            break;

          case 'connect_established':
            tunnelManager.handleConnectEstablished(message.requestId);
            break;

          case 'ip_changed':
            if (registeredDeviceId && 'newIp' in message) {
              const newIp = (message as any).newIp;
              console.log(`[WS] Device ${registeredDeviceId} IP changed to ${newIp}`);
              const device = deviceRegistry.getById(registeredDeviceId);
              if (device) {
                device.ipAddress = newIp;
              }
              await deviceRegistry.markOnlineInDb(registeredDeviceId, newIp);
            }
            break;

          case 'pong':
            if (registeredDeviceId) {
              const device = deviceRegistry.getById(registeredDeviceId);
              if (device) device.lastPong = new Date();
            }
            break;
        }
      } catch (err) {
        console.error('[WS] Error parsing message:', err);
      }
    });

    ws.on('close', () => {
      if (registeredDeviceId) {
        deviceRegistry.markOfflineInDb(registeredDeviceId);
        deviceRegistry.unregister(registeredDeviceId);
        console.log(`[WS] Device disconnected: ${registeredDeviceId}`);
      }
    });

    ws.on('error', (err) => {
      console.error('[WS] Socket error:', err.message);
    });
  });

  // Heartbeat ping
  setInterval(() => {
    for (const device of deviceRegistry.getAll()) {
      if (device.ws.readyState === WebSocket.OPEN) {
        device.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }
  }, HEARTBEAT_INTERVAL);

  return wss;
}

async function handleRegister(
  ws: WebSocket,
  msg: RegisterMessage,
  clientIp: string
): Promise<string | null> {
  // Look up device by key
  const device = await prisma.device.findUnique({
    where: { deviceKey: msg.deviceKey },
  });

  if (!device) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid device key' }));
    ws.close();
    return null;
  }

  const connectedDevice: ConnectedDevice = {
    deviceId: device.id,
    deviceKey: device.deviceKey,
    name: msg.deviceInfo.name || device.name,
    carrier: msg.deviceInfo.carrier,
    ipAddress: msg.deviceInfo.ip || clientIp,
    ws,
    connectedAt: new Date(),
    lastPong: new Date(),
  };

  deviceRegistry.register(connectedDevice);
  await deviceRegistry.markOnlineInDb(
    device.id,
    msg.deviceInfo.ip || clientIp,
    msg.deviceInfo.carrier
  );

  ws.send(JSON.stringify({ type: 'registered', deviceId: device.id }));
  console.log(`[WS] Device registered: ${device.name} (${device.id})`);

  return device.id;
}

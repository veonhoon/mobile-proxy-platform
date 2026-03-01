import net from 'net';
import { v4 as uuidv4 } from 'uuid';
import { deviceRegistry } from '../websocket/device-registry';
import { tunnelManager } from './tunnel';
import {
  createBinaryFrame,
  ProxyRequestMessage,
  ConnectRequestMessage,
} from '../websocket/protocol';
import WebSocket from 'ws';

export interface ProxyPortConfig {
  port: number;
  deviceId: string;
  username: string;
  password: string;
  proxyPortId: string;
}

export class TcpProxyServer {
  private server: net.Server;
  private config: ProxyPortConfig;

  constructor(config: ProxyPortConfig) {
    this.config = config;
    this.server = net.createServer((socket) => this.handleConnection(socket));
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, '0.0.0.0', () => {
        console.log(
          `[Proxy] TCP proxy listening on port ${this.config.port} → device ${this.config.deviceId}`
        );
        resolve();
      });
      this.server.on('error', reject);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log(`[Proxy] TCP proxy stopped on port ${this.config.port}`);
        resolve();
      });
    });
  }

  updateConfig(config: Partial<ProxyPortConfig>): void {
    Object.assign(this.config, config);
  }

  private handleConnection(clientSocket: net.Socket): void {
    let buffer = Buffer.alloc(0);

    clientSocket.once('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        // Wait for more data (shouldn't happen normally)
        clientSocket.once('data', (chunk2: Buffer) => {
          buffer = Buffer.concat([buffer, chunk2]);
          this.processRequest(clientSocket, buffer);
        });
        return;
      }
      this.processRequest(clientSocket, buffer);
    });

    clientSocket.on('error', (err) => {
      // Client disconnected
    });
  }

  private processRequest(clientSocket: net.Socket, data: Buffer): void {
    const headerStr = data.toString('utf-8');
    const firstLine = headerStr.split('\r\n')[0];
    const parts = firstLine.split(' ');

    if (parts.length < 3) {
      clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\nMalformed request');
      return;
    }

    // Authenticate
    if (!this.authenticate(headerStr)) {
      clientSocket.end(
        'HTTP/1.1 407 Proxy Authentication Required\r\n' +
          'Proxy-Authenticate: Basic realm="Proxy"\r\n\r\n'
      );
      return;
    }

    // Check device is online
    const device = deviceRegistry.getById(this.config.deviceId);
    if (!device || device.ws.readyState !== WebSocket.OPEN) {
      clientSocket.end('HTTP/1.1 503 Service Unavailable\r\n\r\nDevice offline');
      return;
    }

    const method = parts[0].toUpperCase();
    const requestId = uuidv4();

    if (method === 'CONNECT') {
      this.handleConnect(clientSocket, requestId, parts[1], device);
    } else {
      this.handleHttpRequest(clientSocket, requestId, method, parts[1], headerStr, data, device);
    }
  }

  private handleConnect(
    clientSocket: net.Socket,
    requestId: string,
    hostPort: string,
    device: { ws: WebSocket }
  ): void {
    const [host, portStr] = hostPort.split(':');
    const port = parseInt(portStr) || 443;

    tunnelManager.registerRequest(requestId, clientSocket, true);

    const msg: ConnectRequestMessage = {
      type: 'connect_request',
      requestId,
      host,
      port,
    };

    device.ws.send(JSON.stringify(msg));

    // Once tunnel is established, pipe client data to phone via binary frames
    clientSocket.on('data', (chunk: Buffer) => {
      if (device.ws.readyState === WebSocket.OPEN) {
        device.ws.send(createBinaryFrame(requestId, chunk));
      }
    });
  }

  private handleHttpRequest(
    clientSocket: net.Socket,
    requestId: string,
    method: string,
    url: string,
    headerStr: string,
    rawData: Buffer,
    device: { ws: WebSocket }
  ): void {
    tunnelManager.registerRequest(requestId, clientSocket, false);

    // Parse headers
    const headerLines = headerStr.split('\r\n').slice(1);
    const headers: Record<string, string> = {};
    for (const line of headerLines) {
      if (!line) break;
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();
      // Skip proxy-specific headers
      if (key.toLowerCase() === 'proxy-authorization') continue;
      if (key.toLowerCase() === 'proxy-connection') continue;
      headers[key] = value;
    }

    const msg: ProxyRequestMessage = {
      type: 'proxy_request',
      requestId,
      method,
      url,
      headers,
    };

    // For requests with body, extract body after headers
    const headerEndIdx = rawData.indexOf('\r\n\r\n');
    if (headerEndIdx !== -1 && headerEndIdx + 4 < rawData.length) {
      msg.body = rawData.subarray(headerEndIdx + 4).toString('base64');
    }

    device.ws.send(JSON.stringify(msg));
  }

  private authenticate(headerStr: string): boolean {
    const authMatch = headerStr.match(/Proxy-Authorization:\s*Basic\s+(\S+)/i);
    if (!authMatch) return false;

    const decoded = Buffer.from(authMatch[1], 'base64').toString();
    const [username, password] = decoded.split(':');

    return username === this.config.username && password === this.config.password;
  }
}

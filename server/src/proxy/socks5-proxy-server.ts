import net from 'net';
import { v4 as uuidv4 } from 'uuid';
import { deviceRegistry } from '../websocket/device-registry';
import { tunnelManager } from './tunnel';
import {
  createBinaryFrame,
  ConnectRequestMessage,
} from '../websocket/protocol';
import WebSocket from 'ws';

export interface Socks5ProxyConfig {
  port: number;
  deviceId: string;
  username: string;
  password: string;
  proxyPortId: string;
}

// SOCKS5 constants
const SOCKS_VERSION = 0x05;
const AUTH_NONE = 0x00;
const AUTH_USERPASS = 0x02;
const AUTH_NO_ACCEPTABLE = 0xff;
const CMD_CONNECT = 0x01;
const ATYP_IPV4 = 0x01;
const ATYP_DOMAIN = 0x03;
const ATYP_IPV6 = 0x04;
const REP_SUCCESS = 0x00;
const REP_GENERAL_FAILURE = 0x01;
const REP_HOST_UNREACHABLE = 0x04;

export class Socks5ProxyServer {
  private server: net.Server;
  private config: Socks5ProxyConfig;

  constructor(config: Socks5ProxyConfig) {
    this.config = config;
    this.server = net.createServer((socket) => this.handleConnection(socket));
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, '0.0.0.0', () => {
        console.log(
          `[SOCKS5] Listening on port ${this.config.port} → device ${this.config.deviceId}`
        );
        resolve();
      });
      this.server.on('error', reject);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log(`[SOCKS5] Stopped on port ${this.config.port}`);
        resolve();
      });
    });
  }

  updateConfig(config: Partial<Socks5ProxyConfig>): void {
    Object.assign(this.config, config);
  }

  private handleConnection(clientSocket: net.Socket): void {
    clientSocket.on('error', () => {});

    // Step 1: Read greeting
    clientSocket.once('data', (greeting: Buffer) => {
      this.handleGreeting(clientSocket, greeting);
    });
  }

  private handleGreeting(clientSocket: net.Socket, greeting: Buffer): void {
    if (greeting.length < 3 || greeting[0] !== SOCKS_VERSION) {
      clientSocket.end();
      return;
    }

    const nmethods = greeting[1];
    const methods = greeting.subarray(2, 2 + nmethods);

    // Require username/password auth
    if (methods.includes(AUTH_USERPASS)) {
      clientSocket.write(Buffer.from([SOCKS_VERSION, AUTH_USERPASS]));
      clientSocket.once('data', (authData: Buffer) => {
        this.handleAuth(clientSocket, authData);
      });
    } else if (this.config.username === '' && this.config.password === '' && methods.includes(AUTH_NONE)) {
      // No auth required if creds are empty
      clientSocket.write(Buffer.from([SOCKS_VERSION, AUTH_NONE]));
      clientSocket.once('data', (request: Buffer) => {
        this.handleRequest(clientSocket, request);
      });
    } else {
      clientSocket.write(Buffer.from([SOCKS_VERSION, AUTH_NO_ACCEPTABLE]));
      clientSocket.end();
    }
  }

  private handleAuth(clientSocket: net.Socket, data: Buffer): void {
    // Username/password subnegotiation (RFC 1929)
    if (data.length < 5 || data[0] !== 0x01) {
      clientSocket.end();
      return;
    }

    const ulen = data[1];
    const username = data.subarray(2, 2 + ulen).toString();
    const plen = data[2 + ulen];
    const password = data.subarray(3 + ulen, 3 + ulen + plen).toString();

    if (username === this.config.username && password === this.config.password) {
      clientSocket.write(Buffer.from([0x01, 0x00])); // Success
      clientSocket.once('data', (request: Buffer) => {
        this.handleRequest(clientSocket, request);
      });
    } else {
      clientSocket.write(Buffer.from([0x01, 0x01])); // Failure
      clientSocket.end();
    }
  }

  private handleRequest(clientSocket: net.Socket, request: Buffer): void {
    if (request.length < 7 || request[0] !== SOCKS_VERSION) {
      this.sendReply(clientSocket, REP_GENERAL_FAILURE);
      clientSocket.end();
      return;
    }

    const cmd = request[1];
    // request[2] is reserved
    const atyp = request[3];

    if (cmd !== CMD_CONNECT) {
      // Only CONNECT supported
      this.sendReply(clientSocket, 0x07); // Command not supported
      clientSocket.end();
      return;
    }

    let host: string;
    let port: number;
    let offset: number;

    switch (atyp) {
      case ATYP_IPV4:
        host = `${request[4]}.${request[5]}.${request[6]}.${request[7]}`;
        port = request.readUInt16BE(8);
        break;

      case ATYP_DOMAIN:
        const domainLen = request[4];
        host = request.subarray(5, 5 + domainLen).toString();
        port = request.readUInt16BE(5 + domainLen);
        break;

      case ATYP_IPV6:
        // Read 16 bytes as IPv6
        const parts: string[] = [];
        for (let i = 0; i < 8; i++) {
          parts.push(request.readUInt16BE(4 + i * 2).toString(16));
        }
        host = parts.join(':');
        port = request.readUInt16BE(20);
        break;

      default:
        this.sendReply(clientSocket, 0x08); // Address type not supported
        clientSocket.end();
        return;
    }

    // Check device is online
    const device = deviceRegistry.getById(this.config.deviceId);
    if (!device || device.ws.readyState !== WebSocket.OPEN) {
      this.sendReply(clientSocket, REP_HOST_UNREACHABLE);
      clientSocket.end();
      return;
    }

    const requestId = uuidv4();

    // Register with tunnel manager — use a custom handler for SOCKS5 reply
    tunnelManager.registerSocks5Request(requestId, clientSocket, () => {
      // Called when connect is established
      this.sendReply(clientSocket, REP_SUCCESS);
    }, (error: string) => {
      // Called on error
      this.sendReply(clientSocket, REP_GENERAL_FAILURE);
      clientSocket.end();
    });

    // Send connect request to phone
    const msg: ConnectRequestMessage = {
      type: 'connect_request',
      requestId,
      host,
      port,
    };

    device.ws.send(JSON.stringify(msg));

    // Pipe client data to phone via binary frames
    clientSocket.on('data', (chunk: Buffer) => {
      if (device.ws.readyState === WebSocket.OPEN) {
        device.ws.send(createBinaryFrame(requestId, chunk));
      }
    });
  }

  private sendReply(socket: net.Socket, rep: number): void {
    // SOCKS5 reply: VER, REP, RSV, ATYP, BND.ADDR, BND.PORT
    const reply = Buffer.from([
      SOCKS_VERSION, rep, 0x00, ATYP_IPV4,
      0x00, 0x00, 0x00, 0x00, // 0.0.0.0
      0x00, 0x00,             // port 0
    ]);
    socket.write(reply);
  }
}

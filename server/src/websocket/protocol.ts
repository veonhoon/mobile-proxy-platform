// === Server → Phone Messages ===

export interface ProxyRequestMessage {
  type: 'proxy_request';
  requestId: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface ConnectRequestMessage {
  type: 'connect_request';
  requestId: string;
  host: string;
  port: number;
}

export interface ConfigUpdateMessage {
  type: 'config_update';
  ports: number[];
}

export interface PingMessage {
  type: 'ping';
}

export type ServerToPhoneMessage =
  | ProxyRequestMessage
  | ConnectRequestMessage
  | ConfigUpdateMessage
  | PingMessage;

// === Phone → Server Messages ===

export interface RegisterMessage {
  type: 'register';
  deviceKey: string;
  deviceInfo: {
    name: string;
    carrier?: string;
    ip?: string;
  };
}

export interface ProxyResponseHeadersMessage {
  type: 'proxy_response_headers';
  requestId: string;
  statusCode: number;
  headers: Record<string, string>;
}

export interface ProxyResponseEndMessage {
  type: 'proxy_response_end';
  requestId: string;
}

export interface ProxyErrorMessage {
  type: 'proxy_error';
  requestId: string;
  error: string;
}

export interface ConnectEstablishedMessage {
  type: 'connect_established';
  requestId: string;
}

export interface PongMessage {
  type: 'pong';
}

export type PhoneToServerMessage =
  | RegisterMessage
  | ProxyResponseHeadersMessage
  | ProxyResponseEndMessage
  | ProxyErrorMessage
  | ConnectEstablishedMessage
  | PongMessage;

// === Binary Frame Helpers ===
// Binary frames: first 36 bytes = requestId (UUID string), remaining = payload

export const REQUEST_ID_LENGTH = 36;

export function createBinaryFrame(requestId: string, data: Buffer): Buffer {
  const idBuffer = Buffer.from(requestId.padEnd(REQUEST_ID_LENGTH));
  return Buffer.concat([idBuffer, data]);
}

export function parseBinaryFrame(data: Buffer): { requestId: string; payload: Buffer } {
  const requestId = data.subarray(0, REQUEST_ID_LENGTH).toString().trim();
  const payload = data.subarray(REQUEST_ID_LENGTH);
  return { requestId, payload };
}

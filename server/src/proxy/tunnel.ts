import net from 'net';

interface PendingRequest {
  clientSocket: net.Socket;
  requestId: string;
  isConnect: boolean;
  headersSent: boolean;
  bytesIn: number;
  bytesOut: number;
  startTime: number;
  isSocks5?: boolean;
  socks5OnConnect?: () => void;
  socks5OnError?: (error: string) => void;
}

class TunnelManager {
  private pendingRequests: Map<string, PendingRequest> = new Map();

  registerRequest(
    requestId: string,
    clientSocket: net.Socket,
    isConnect: boolean
  ): void {
    this.pendingRequests.set(requestId, {
      clientSocket,
      requestId,
      isConnect,
      headersSent: false,
      bytesIn: 0,
      bytesOut: 0,
      startTime: Date.now(),
    });

    clientSocket.on('close', () => {
      this.pendingRequests.delete(requestId);
    });

    clientSocket.on('error', () => {
      this.pendingRequests.delete(requestId);
    });
  }

  registerSocks5Request(
    requestId: string,
    clientSocket: net.Socket,
    onConnect: () => void,
    onError: (error: string) => void
  ): void {
    this.pendingRequests.set(requestId, {
      clientSocket,
      requestId,
      isConnect: true,
      headersSent: false,
      bytesIn: 0,
      bytesOut: 0,
      startTime: Date.now(),
      isSocks5: true,
      socks5OnConnect: onConnect,
      socks5OnError: onError,
    });

    clientSocket.on('close', () => {
      this.pendingRequests.delete(requestId);
    });

    clientSocket.on('error', () => {
      this.pendingRequests.delete(requestId);
    });
  }

  handleResponseHeaders(
    requestId: string,
    statusCode: number,
    headers: Record<string, string>
  ): void {
    const req = this.pendingRequests.get(requestId);
    if (!req || req.clientSocket.destroyed) {
      this.pendingRequests.delete(requestId);
      return;
    }

    // Build HTTP response header
    let headerStr = `HTTP/1.1 ${statusCode} ${getStatusText(statusCode)}\r\n`;
    for (const [key, value] of Object.entries(headers)) {
      headerStr += `${key}: ${value}\r\n`;
    }
    headerStr += '\r\n';

    req.clientSocket.write(headerStr);
    req.headersSent = true;
  }

  handleConnectEstablished(requestId: string): void {
    const req = this.pendingRequests.get(requestId);
    if (!req || req.clientSocket.destroyed) {
      this.pendingRequests.delete(requestId);
      return;
    }

    if (req.isSocks5 && req.socks5OnConnect) {
      req.socks5OnConnect();
    } else {
      // Send 200 Connection Established to client (HTTP CONNECT)
      req.clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    }
    req.headersSent = true;
  }

  handlePhoneData(requestId: string, data: Buffer): void {
    const req = this.pendingRequests.get(requestId);
    if (!req || req.clientSocket.destroyed) {
      return;
    }

    req.clientSocket.write(data);
    req.bytesOut += data.length;
  }

  handleResponseEnd(requestId: string): void {
    const req = this.pendingRequests.get(requestId);
    if (!req) return;

    if (!req.isConnect) {
      req.clientSocket.end();
    }
    this.pendingRequests.delete(requestId);
  }

  handleProxyError(requestId: string, error: string): void {
    const req = this.pendingRequests.get(requestId);
    if (!req) return;

    if (req.isSocks5 && req.socks5OnError) {
      req.socks5OnError(error);
    } else if (!req.headersSent && !req.clientSocket.destroyed) {
      req.clientSocket.write(
        `HTTP/1.1 502 Bad Gateway\r\nContent-Type: text/plain\r\n\r\nProxy Error: ${error}`
      );
      req.clientSocket.end();
    } else {
      req.clientSocket.end();
    }
    this.pendingRequests.delete(requestId);
  }

  getStats(requestId: string): { bytesIn: number; bytesOut: number; duration: number } | null {
    const req = this.pendingRequests.get(requestId);
    if (!req) return null;
    return {
      bytesIn: req.bytesIn,
      bytesOut: req.bytesOut,
      duration: Date.now() - req.startTime,
    };
  }
}

function getStatusText(code: number): string {
  const texts: Record<number, string> = {
    200: 'OK', 201: 'Created', 204: 'No Content',
    301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
    400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
    404: 'Not Found', 500: 'Internal Server Error', 502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return texts[code] || 'Unknown';
}

export const tunnelManager = new TunnelManager();

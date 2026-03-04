import prisma from '../lib/db';
import { TcpProxyServer, ProxyPortConfig } from './tcp-proxy-server';
import { Socks5ProxyServer, Socks5ProxyConfig } from './socks5-proxy-server';

class ProxyManager {
  private proxies: Map<string, TcpProxyServer | Socks5ProxyServer> = new Map();

  async startProxy(config: ProxyPortConfig): Promise<void> {
    // Stop existing if running on same id
    if (this.proxies.has(config.proxyPortId)) {
      await this.stopProxy(config.proxyPortId);
    }

    const server = new TcpProxyServer(config);
    try {
      await server.start();
      this.proxies.set(config.proxyPortId, server);
    } catch (err: any) {
      console.error(`[ProxyManager] Failed to start proxy on port ${config.port}:`, err.message);
      throw err;
    }
  }

  async startSocks5Proxy(config: Socks5ProxyConfig): Promise<void> {
    const key = `socks5-${config.proxyPortId}`;
    if (this.proxies.has(key)) {
      await this.stopProxy(key);
    }

    const server = new Socks5ProxyServer(config);
    try {
      await server.start();
      this.proxies.set(key, server);
    } catch (err: any) {
      console.error(`[ProxyManager] Failed to start SOCKS5 on port ${config.port}:`, err.message);
      throw err;
    }
  }

  async stopProxy(proxyPortId: string): Promise<void> {
    const server = this.proxies.get(proxyPortId);
    if (server) {
      await server.stop();
      this.proxies.delete(proxyPortId);
    }
  }

  async updateProxy(proxyPortId: string, config: Partial<ProxyPortConfig>): Promise<void> {
    const server = this.proxies.get(proxyPortId);
    if (server) {
      // If port changed, restart
      if (config.port !== undefined) {
        const existingConfig = this.getConfig(proxyPortId);
        if (existingConfig) {
          await this.stopProxy(proxyPortId);
          await this.startProxy({ ...existingConfig, ...config });
        }
      } else {
        server.updateConfig(config);
      }
    }
  }

  isRunning(proxyPortId: string): boolean {
    return this.proxies.has(proxyPortId);
  }

  getRunningCount(): number {
    return this.proxies.size;
  }

  private getConfig(proxyPortId: string): ProxyPortConfig | null {
    // Config is stored in the TcpProxyServer, but we don't expose it directly
    // For restarts, we re-fetch from DB
    return null;
  }

  async loadAllFromDb(): Promise<void> {
    const ports = await prisma.proxyPort.findMany({
      where: { enabled: true },
      include: { device: true },
    });

    console.log(`[ProxyManager] Loading ${ports.length} proxy ports from database...`);

    for (const port of ports) {
      try {
        await this.startProxy({
          port: port.port,
          deviceId: port.deviceId,
          username: port.username,
          password: port.password,
          proxyPortId: port.id,
        });
      } catch (err: any) {
        console.error(
          `[ProxyManager] Failed to start HTTP port ${port.port}:`,
          err.message
        );
      }

      // Also start SOCKS5 on port+1
      try {
        await this.startSocks5Proxy({
          port: port.port + 1,
          deviceId: port.deviceId,
          username: port.username,
          password: port.password,
          proxyPortId: port.id,
        });
      } catch (err: any) {
        console.error(
          `[ProxyManager] Failed to start SOCKS5 port ${port.port + 1}:`,
          err.message
        );
      }
    }
  }

  async stopAll(): Promise<void> {
    const ids = Array.from(this.proxies.keys());
    for (const id of ids) {
      await this.stopProxy(id);
    }
  }
}

export const proxyManager = new ProxyManager();

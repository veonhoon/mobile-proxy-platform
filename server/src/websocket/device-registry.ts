import WebSocket from 'ws';
import prisma from '../lib/db';

export interface ConnectedDevice {
  deviceId: string;
  deviceKey: string;
  name: string;
  carrier?: string;
  ipAddress?: string;
  ws: WebSocket;
  connectedAt: Date;
  lastPong: Date;
}

class DeviceRegistry {
  private devices: Map<string, ConnectedDevice> = new Map(); // deviceId → ConnectedDevice
  private keyToId: Map<string, string> = new Map(); // deviceKey → deviceId

  register(device: ConnectedDevice): void {
    this.devices.set(device.deviceId, device);
    this.keyToId.set(device.deviceKey, device.deviceId);
    console.log(`[Registry] Device registered: ${device.name} (${device.deviceId})`);
  }

  unregister(deviceId: string): void {
    const device = this.devices.get(deviceId);
    if (device) {
      this.keyToId.delete(device.deviceKey);
      this.devices.delete(deviceId);
      console.log(`[Registry] Device unregistered: ${device.name} (${deviceId})`);
    }
  }

  getById(deviceId: string): ConnectedDevice | undefined {
    return this.devices.get(deviceId);
  }

  getByKey(deviceKey: string): ConnectedDevice | undefined {
    const id = this.keyToId.get(deviceKey);
    if (!id) return undefined;
    return this.devices.get(id);
  }

  isOnline(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    return !!device && device.ws.readyState === WebSocket.OPEN;
  }

  getAll(): ConnectedDevice[] {
    return Array.from(this.devices.values());
  }

  getOnlineCount(): number {
    return this.devices.size;
  }

  sendChangeIp(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device || device.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    device.ws.send(JSON.stringify({ type: 'change_ip' }));
    return true;
  }

  async markOfflineInDb(deviceId: string): Promise<void> {
    try {
      await prisma.device.update({
        where: { id: deviceId },
        data: { online: false },
      });
    } catch (e) {
      // Device may have been deleted
    }
  }

  async markOnlineInDb(deviceId: string, ip?: string, carrier?: string): Promise<void> {
    try {
      await prisma.device.update({
        where: { id: deviceId },
        data: {
          online: true,
          lastSeen: new Date(),
          ipAddress: ip || undefined,
          carrier: carrier || undefined,
        },
      });
    } catch (e) {
      console.error(`[Registry] Failed to update device in DB:`, e);
    }
  }
}

export const deviceRegistry = new DeviceRegistry();

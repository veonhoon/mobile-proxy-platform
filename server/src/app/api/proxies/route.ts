import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest, requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/utils';
import { proxyManager } from '@/proxy/proxy-manager';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) {
    return errorResponse('Unauthorized', 401);
  }

  const where = auth.role === 'ADMIN' ? {} : { assignedToId: auth.userId };

  const proxies = await prisma.proxyPort.findMany({
    where,
    include: {
      device: { select: { id: true, name: true, online: true, carrier: true, ipAddress: true } },
      assignedTo: { select: { id: true, email: true } },
    },
    orderBy: { port: 'asc' },
  });

  return jsonResponse(proxies);
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth || !requireAdmin(auth)) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const { deviceId, port, username, password, assignedToId } = await req.json();

    if (!deviceId || !port || !username || !password) {
      return errorResponse('deviceId, port, username, and password are required');
    }

    // Validate port range
    const portNum = parseInt(port);
    if (portNum < 1024 || portNum > 65535) {
      return errorResponse('Port must be between 1024 and 65535');
    }

    // Check port not in use
    const existing = await prisma.proxyPort.findUnique({ where: { port: portNum } });
    if (existing) {
      return errorResponse('Port already in use', 409);
    }

    // Check device exists
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      return errorResponse('Device not found', 404);
    }

    const proxyPort = await prisma.proxyPort.create({
      data: {
        deviceId,
        port: portNum,
        username,
        password,
        assignedToId: assignedToId || null,
      },
      include: {
        device: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, email: true } },
      },
    });

    // Start the proxy listener
    try {
      await proxyManager.startProxy({
        port: portNum,
        deviceId,
        username,
        password,
        proxyPortId: proxyPort.id,
      });
    } catch (err: any) {
      // Rollback DB entry if we can't start the proxy
      await prisma.proxyPort.delete({ where: { id: proxyPort.id } });
      return errorResponse(`Failed to start proxy: ${err.message}`, 500);
    }

    return jsonResponse(proxyPort, 201);
  } catch (err) {
    console.error('Create proxy error:', err);
    return errorResponse('Internal server error', 500);
  }
}

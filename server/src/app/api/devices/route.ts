import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/db';
import { authenticateRequest, requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/utils';
import { deviceRegistry } from '@/websocket/device-registry';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth || !requireAdmin(auth)) {
    return errorResponse('Unauthorized', 401);
  }

  const devices = await prisma.device.findMany({
    include: { proxyPorts: { select: { id: true, port: true, enabled: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // Enrich with live online status
  const enriched = devices.map((d) => ({
    ...d,
    online: deviceRegistry.isOnline(d.id),
  }));

  return jsonResponse(enriched);
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth || !requireAdmin(auth)) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const { name } = await req.json();
    if (!name) {
      return errorResponse('Device name is required');
    }

    const deviceKey = uuidv4();
    const device = await prisma.device.create({
      data: { name, deviceKey },
    });

    return jsonResponse(device, 201);
  } catch (err) {
    console.error('Create device error:', err);
    return errorResponse('Internal server error', 500);
  }
}

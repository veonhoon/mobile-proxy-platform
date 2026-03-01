import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest, requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/utils';
import { deviceRegistry } from '@/websocket/device-registry';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = authenticateRequest(req);
  if (!auth || !requireAdmin(auth)) {
    return errorResponse('Unauthorized', 401);
  }

  const device = await prisma.device.findUnique({
    where: { id: params.id },
    include: { proxyPorts: true },
  });

  if (!device) {
    return errorResponse('Device not found', 404);
  }

  return jsonResponse({
    ...device,
    online: deviceRegistry.isOnline(device.id),
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = authenticateRequest(req);
  if (!auth || !requireAdmin(auth)) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const { name } = await req.json();
    const device = await prisma.device.update({
      where: { id: params.id },
      data: { name },
    });

    return jsonResponse(device);
  } catch (err) {
    return errorResponse('Device not found', 404);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = authenticateRequest(req);
  if (!auth || !requireAdmin(auth)) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    await prisma.device.delete({ where: { id: params.id } });
    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse('Device not found', 404);
  }
}

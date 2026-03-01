import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/utils';
import { deviceRegistry } from '@/websocket/device-registry';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = authenticateRequest(req);
  if (!auth) {
    return errorResponse('Unauthorized', 401);
  }

  const device = await prisma.device.findUnique({ where: { id: params.id } });
  if (!device) {
    return errorResponse('Device not found', 404);
  }

  // Only admin or device owner can trigger IP change
  if (auth.role !== 'ADMIN' && device.ownerId !== auth.userId) {
    return errorResponse('Forbidden', 403);
  }

  if (!deviceRegistry.isOnline(device.id)) {
    return errorResponse('Device is not online', 400);
  }

  const sent = deviceRegistry.sendChangeIp(device.id);
  if (!sent) {
    return errorResponse('Failed to send change_ip command', 500);
  }

  return jsonResponse({ success: true, message: 'Change IP command sent to device' });
}

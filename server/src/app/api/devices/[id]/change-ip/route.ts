import { NextRequest } from 'next/server';
import { authenticateRequest, requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/utils';
import { deviceRegistry } from '@/websocket/device-registry';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = authenticateRequest(req);
  if (!auth || !requireAdmin(auth)) {
    return errorResponse('Unauthorized', 401);
  }

  const deviceId = params.id;

  if (!deviceRegistry.isOnline(deviceId)) {
    return errorResponse('Device is not online', 400);
  }

  const sent = deviceRegistry.sendChangeIp(deviceId);
  if (!sent) {
    return errorResponse('Failed to send change_ip command', 500);
  }

  return jsonResponse({ success: true, message: 'Change IP command sent to device' });
}

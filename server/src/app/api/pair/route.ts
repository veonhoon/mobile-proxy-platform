import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { jsonResponse, errorResponse } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const { pairingCode } = await req.json();

    if (!pairingCode || typeof pairingCode !== 'string') {
      return errorResponse('Pairing code is required', 400);
    }

    const code = pairingCode.trim().toUpperCase();
    if (code.length !== 6) {
      return errorResponse('Pairing code must be 6 characters', 400);
    }

    const device = await prisma.device.findUnique({
      where: { pairingCode: code },
    });

    if (!device) {
      return errorResponse('Invalid pairing code', 404);
    }

    return jsonResponse({
      deviceKey: device.deviceKey,
      deviceName: device.name,
    });
  } catch (err) {
    console.error('Pairing error:', err);
    return errorResponse('Internal server error', 500);
  }
}

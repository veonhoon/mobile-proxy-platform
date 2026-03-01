import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest, requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth || !requireAdmin(auth)) {
    return errorResponse('Unauthorized', 401);
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      proxies: { select: { id: true, port: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return jsonResponse(users);
}

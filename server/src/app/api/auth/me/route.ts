import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req);
  if (!auth) {
    return errorResponse('Unauthorized', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  if (!user) {
    return errorResponse('User not found', 404);
  }

  return jsonResponse(user);
}

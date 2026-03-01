import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest, requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/utils';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = authenticateRequest(req);
  if (!auth || !requireAdmin(auth)) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const { role } = await req.json();

    if (role && !['ADMIN', 'USER'].includes(role)) {
      return errorResponse('Invalid role');
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    return jsonResponse(user);
  } catch (err) {
    return errorResponse('User not found', 404);
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

  // Prevent self-deletion
  if (params.id === auth.userId) {
    return errorResponse('Cannot delete your own account');
  }

  try {
    await prisma.user.delete({ where: { id: params.id } });
    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse('User not found', 404);
  }
}

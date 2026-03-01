import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { authenticateRequest, requireAdmin } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/utils';
import { proxyManager } from '@/proxy/proxy-manager';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = authenticateRequest(req);
  if (!auth) {
    return errorResponse('Unauthorized', 401);
  }

  const proxyPort = await prisma.proxyPort.findUnique({
    where: { id: params.id },
    include: {
      device: true,
      assignedTo: { select: { id: true, email: true } },
      logs: { take: 50, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!proxyPort) {
    return errorResponse('Proxy port not found', 404);
  }

  // Non-admin can only see their own proxies
  if (auth.role !== 'ADMIN' && proxyPort.assignedToId !== auth.userId) {
    return errorResponse('Forbidden', 403);
  }

  return jsonResponse(proxyPort);
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
    const body = await req.json();
    const { port, username, password, enabled, assignedToId, deviceId } = body;

    const existing = await prisma.proxyPort.findUnique({ where: { id: params.id } });
    if (!existing) {
      return errorResponse('Proxy port not found', 404);
    }

    // If port changed, check it's available
    if (port && port !== existing.port) {
      const portInUse = await prisma.proxyPort.findFirst({
        where: { port, id: { not: params.id } },
      });
      if (portInUse) {
        return errorResponse('Port already in use', 409);
      }
    }

    const updated = await prisma.proxyPort.update({
      where: { id: params.id },
      data: {
        port: port ?? existing.port,
        username: username ?? existing.username,
        password: password ?? existing.password,
        enabled: enabled ?? existing.enabled,
        assignedToId: assignedToId !== undefined ? assignedToId : existing.assignedToId,
        deviceId: deviceId ?? existing.deviceId,
      },
      include: {
        device: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, email: true } },
      },
    });

    // Restart proxy if running config changed
    if (updated.enabled) {
      await proxyManager.stopProxy(params.id);
      await proxyManager.startProxy({
        port: updated.port,
        deviceId: updated.deviceId,
        username: updated.username,
        password: updated.password,
        proxyPortId: updated.id,
      });
    } else {
      await proxyManager.stopProxy(params.id);
    }

    return jsonResponse(updated);
  } catch (err) {
    console.error('Update proxy error:', err);
    return errorResponse('Internal server error', 500);
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
    // Stop the proxy listener first
    await proxyManager.stopProxy(params.id);
    await prisma.proxyPort.delete({ where: { id: params.id } });
    return jsonResponse({ success: true });
  } catch (err) {
    return errorResponse('Proxy port not found', 404);
  }
}

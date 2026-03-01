import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { comparePassword, signToken } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return errorResponse('Email and password are required');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return errorResponse('Invalid credentials', 401);
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return errorResponse('Invalid credentials', 401);
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return jsonResponse({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    return errorResponse('Internal server error', 500);
  }
}

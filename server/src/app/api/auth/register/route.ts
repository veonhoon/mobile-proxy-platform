import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword, signToken } from '@/lib/auth';
import { jsonResponse, errorResponse } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return errorResponse('Email and password are required');
    }

    if (password.length < 6) {
      return errorResponse('Password must be at least 6 characters');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return errorResponse('Email already registered', 409);
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, password: hashed },
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return jsonResponse({ token, user: { id: user.id, email: user.email, role: user.role } }, 201);
  } catch (err) {
    console.error('Register error:', err);
    return errorResponse('Internal server error', 500);
  }
}

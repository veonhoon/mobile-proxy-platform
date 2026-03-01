'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    } else {
      router.push('/login');
    }
    setLoading(false);
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  }, [router]);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const t = localStorage.getItem('token');
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
          ...(options.headers || {}),
        },
      });

      if (res.status === 401) {
        logout();
        throw new Error('Unauthorized');
      }

      return res;
    },
    [logout]
  );

  return { user, token, loading, logout, authFetch, isAdmin: user?.role === 'ADMIN' };
}

'use client';

import { useAuth } from '@/lib/useAuth';
import Sidebar from '@/components/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar isAdmin={isAdmin} onLogout={logout} email={user.email} />
      <main
        style={{
          marginLeft: 220,
          flex: 1,
          padding: '1.5rem 2rem',
          minHeight: '100vh',
        }}
      >
        {children}
      </main>
    </div>
  );
}

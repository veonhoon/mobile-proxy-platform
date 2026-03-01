'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  isAdmin: boolean;
  onLogout: () => void;
  email: string;
}

export default function Sidebar({ isAdmin, onLogout, email }: SidebarProps) {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', label: 'Overview', icon: '~' },
    ...(isAdmin
      ? [
          { href: '/dashboard/devices', label: 'Devices', icon: '#' },
          { href: '/dashboard/proxies', label: 'Proxies', icon: '>' },
          { href: '/dashboard/users', label: 'Users', icon: '@' },
        ]
      : []),
    { href: '/dashboard/my-devices', label: 'My Devices', icon: '+' },
    { href: '/dashboard/my-proxies', label: 'My Proxies', icon: '*' },
  ];

  return (
    <aside
      style={{
        width: 220,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
      }}
    >
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>MobileProxy</h2>
      </div>

      <nav style={{ flex: 1, padding: '0.75rem' }}>
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                borderRadius: 6,
                marginBottom: 2,
                fontSize: '0.875rem',
                color: active ? 'var(--primary)' : 'var(--text-secondary)',
                background: active ? 'rgba(59,130,246,0.1)' : 'transparent',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontFamily: 'monospace', width: 16, textAlign: 'center' }}>
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          padding: '1rem',
          borderTop: '1px solid var(--border)',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{email}</div>
        <button
          onClick={onLogout}
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

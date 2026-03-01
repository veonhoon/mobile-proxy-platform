'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';

export default function DashboardOverview() {
  const { authFetch, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalDevices: 0,
    onlineDevices: 0,
    totalProxies: 0,
    totalUsers: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      if (isAdmin) {
        const [devRes, proxyRes, userRes] = await Promise.all([
          authFetch('/api/devices'),
          authFetch('/api/proxies'),
          authFetch('/api/users'),
        ]);

        const devices = await devRes.json();
        const proxies = await proxyRes.json();
        const users = await userRes.json();

        setStats({
          totalDevices: devices.length,
          onlineDevices: devices.filter((d: any) => d.online).length,
          totalProxies: proxies.length,
          totalUsers: users.length,
        });
      } else {
        const proxyRes = await authFetch('/api/proxies');
        const proxies = await proxyRes.json();
        setStats({
          totalDevices: 0,
          onlineDevices: 0,
          totalProxies: proxies.length,
          totalUsers: 0,
        });
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stats-grid">
        {isAdmin && (
          <>
            <div className="card stat-card">
              <div className="stat-value">{stats.totalDevices}</div>
              <div className="stat-label">Total Devices</div>
            </div>
            <div className="card stat-card">
              <div className="stat-value" style={{ color: 'var(--success)' }}>
                {stats.onlineDevices}
              </div>
              <div className="stat-label">Online Devices</div>
            </div>
          </>
        )}
        <div className="card stat-card">
          <div className="stat-value">{stats.totalProxies}</div>
          <div className="stat-label">Proxy Ports</div>
        </div>
        {isAdmin && (
          <div className="card stat-card">
            <div className="stat-value">{stats.totalUsers}</div>
            <div className="stat-label">Users</div>
          </div>
        )}
      </div>
    </div>
  );
}

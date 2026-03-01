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
        const [devRes, proxyRes] = await Promise.all([
          authFetch('/api/devices'),
          authFetch('/api/proxies'),
        ]);

        const devices = await devRes.json();
        const proxies = await proxyRes.json();

        setStats({
          totalDevices: devices.length,
          onlineDevices: devices.filter((d: any) => d.online).length,
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
        <div className="card stat-card">
          <div className="stat-value">{stats.totalDevices}</div>
          <div className="stat-label">{isAdmin ? 'Total Devices' : 'My Devices'}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {stats.onlineDevices}
          </div>
          <div className="stat-label">Online Devices</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{stats.totalProxies}</div>
          <div className="stat-label">{isAdmin ? 'Proxy Ports' : 'My Proxies'}</div>
        </div>
        {isAdmin && (
          <div className="card stat-card">
            <div className="stat-value">{stats.totalUsers}</div>
            <div className="stat-label">Users</div>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="card" style={{ marginTop: '2rem', padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Android App</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Download and install the MobileProxy APK on your Android device to use it as a proxy endpoint.
          </p>
          <a
            href="/download/app.apk"
            className="btn btn-primary"
            style={{ display: 'inline-block', textDecoration: 'none' }}
          >
            Download APK
          </a>
          <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <strong>Setup instructions:</strong>
            <ol style={{ paddingLeft: '1.2rem', marginTop: '0.5rem', lineHeight: '1.8' }}>
              <li>Install the APK on your Android phone (enable &quot;Unknown Sources&quot; if needed)</li>
              <li>Open the app and enter the server WebSocket URL (e.g. ws://YOUR_SERVER_IP:3000/ws)</li>
              <li>Enter the 6-character pairing code from the Devices page</li>
              <li>Tap Connect — the device should appear as &quot;Online&quot; in the dashboard</li>
            </ol>
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            For IP rotation, grant the WRITE_SECURE_SETTINGS permission via ADB:
            <br />
            <code style={{ fontSize: '0.75rem' }}>
              adb shell pm grant com.mobileproxy.app android.permission.WRITE_SECURE_SETTINGS
            </code>
          </div>
        </div>
      )}
    </div>
  );
}

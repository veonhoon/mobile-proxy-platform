'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';

interface MyProxy {
  id: string;
  port: number;
  username: string;
  password: string;
  enabled: boolean;
  device: {
    name: string;
    online: boolean;
    carrier: string | null;
    ipAddress: string | null;
  };
}

export default function MyProxiesPage() {
  const { authFetch } = useAuth();
  const [proxies, setProxies] = useState<MyProxy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProxies();
  }, []);

  async function loadProxies() {
    try {
      const res = await authFetch('/api/proxies');
      setProxies(await res.json());
    } catch (err) {
      console.error('Failed to load proxies:', err);
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div>
      <div className="page-header">
        <h1>My Proxies</h1>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : proxies.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
            No proxies assigned to you yet. Contact an admin to get access.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
          {proxies.map((proxy) => (
            <div key={proxy.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600 }}>Port {proxy.port}</span>
                <span className={`badge ${proxy.device.online && proxy.enabled ? 'badge-online' : 'badge-offline'}`}>
                  {proxy.device.online && proxy.enabled ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                <div>Device: {proxy.device.name}</div>
                {proxy.device.carrier && <div>Carrier: {proxy.device.carrier}</div>}
                {proxy.device.ipAddress && <div>Mobile IP: {proxy.device.ipAddress}</div>}
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ marginBottom: '0.25rem' }}>Connection Info</label>
                <div
                  className="copy-text"
                  onClick={() => copyToClipboard(`${proxy.username}:${proxy.password}@SERVER_IP:${proxy.port}`)}
                  style={{ width: '100%' }}
                >
                  {proxy.username}:{proxy.password}@SERVER_IP:{proxy.port}
                </div>
              </div>

              <div>
                <label style={{ marginBottom: '0.25rem' }}>Test Command</label>
                <div
                  className="copy-text"
                  onClick={() =>
                    copyToClipboard(
                      `curl -x http://${proxy.username}:${proxy.password}@SERVER_IP:${proxy.port} http://httpbin.org/ip`
                    )
                  }
                  style={{ width: '100%', fontSize: '0.7rem' }}
                >
                  curl -x http://{proxy.username}:{proxy.password}@SERVER_IP:{proxy.port} http://httpbin.org/ip
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

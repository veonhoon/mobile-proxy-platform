'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/useAuth';

interface Device {
  id: string;
  name: string;
}

interface MyProxy {
  id: string;
  port: number;
  username: string;
  password: string;
  enabled: boolean;
  deviceId: string;
  device: {
    id: string;
    name: string;
    online: boolean;
    carrier: string | null;
    ipAddress: string | null;
  };
}

export default function MyProxiesPage() {
  const { authFetch } = useAuth();
  const [proxies, setProxies] = useState<MyProxy[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  // Create proxy modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ deviceId: '', port: '', username: '', password: '' });

  // Refresh credentials modal state
  const [refreshProxy, setRefreshProxy] = useState<MyProxy | null>(null);
  const [credForm, setCredForm] = useState({ username: '', password: '' });

  const [changingIp, setChangingIp] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadData();
    intervalRef.current = setInterval(loadProxies, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function loadData() {
    await Promise.all([loadProxies(), loadDevices()]);
  }

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

  async function loadDevices() {
    try {
      const res = await authFetch('/api/devices');
      const data = await res.json();
      setDevices(data.map((d: any) => ({ id: d.id, name: d.name })));
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  }

  async function createProxy(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await authFetch('/api/proxies', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: createForm.deviceId,
          port: parseInt(createForm.port),
          username: createForm.username,
          password: createForm.password,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCreate(false);
        setCreateForm({ deviceId: '', port: '', username: '', password: '' });
        loadProxies();
      } else {
        alert(data.error || 'Failed to create proxy');
      }
    } catch (err) {
      console.error('Failed to create proxy:', err);
    }
  }

  async function updateCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!refreshProxy) return;
    try {
      const res = await authFetch(`/api/proxies/${refreshProxy.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          username: credForm.username,
          password: credForm.password,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRefreshProxy(null);
        setCredForm({ username: '', password: '' });
        loadProxies();
      } else {
        alert(data.error || 'Failed to update credentials');
      }
    } catch (err) {
      console.error('Failed to update credentials:', err);
    }
  }

  async function changeIp(deviceId: string) {
    setChangingIp(deviceId);
    try {
      const res = await authFetch(`/api/devices/${deviceId}/change-ip`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to change IP');
      }
    } catch (err) {
      console.error('Failed to change IP:', err);
    } finally {
      setChangingIp(null);
    }
  }

  async function deleteProxy(id: string) {
    if (!confirm('Delete this proxy?')) return;
    try {
      await authFetch(`/api/proxies/${id}`, { method: 'DELETE' });
      loadProxies();
    } catch (err) {
      console.error('Failed to delete proxy:', err);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function openRefreshModal(proxy: MyProxy) {
    setRefreshProxy(proxy);
    setCredForm({ username: proxy.username, password: proxy.password });
  }

  return (
    <div>
      <div className="page-header">
        <h1>My Proxies</h1>
        {devices.length > 0 && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Create Proxy
          </button>
        )}
      </div>

      {/* Create proxy modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Proxy</h2>
            <form onSubmit={createProxy}>
              <div className="form-group">
                <label>Device</label>
                <select
                  value={createForm.deviceId}
                  onChange={(e) => setCreateForm({ ...createForm, deviceId: e.target.value })}
                  required
                >
                  <option value="">Select a device</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Port (1024-65535)</label>
                <input
                  type="number"
                  value={createForm.port}
                  onChange={(e) => setCreateForm({ ...createForm, port: e.target.value })}
                  min={1024}
                  max={65535}
                  placeholder="e.g. 10001"
                  required
                />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  placeholder="Proxy username"
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Proxy password"
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Refresh credentials modal */}
      {refreshProxy && (
        <div className="modal-overlay" onClick={() => setRefreshProxy(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Refresh Credentials</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Port {refreshProxy.port} on {refreshProxy.device.name}
            </p>
            <form onSubmit={updateCredentials}>
              <div className="form-group">
                <label>New Username</label>
                <input
                  value={credForm.username}
                  onChange={(e) => setCredForm({ ...credForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  value={credForm.password}
                  onChange={(e) => setCredForm({ ...credForm, password: e.target.value })}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setRefreshProxy(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : proxies.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
            {devices.length > 0
              ? 'No proxies yet. Click "+ Create Proxy" to create one on your device.'
              : 'No proxies assigned to you yet. Add a device first from "My Devices", or contact an admin.'}
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

              <div style={{ marginBottom: '0.75rem' }}>
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

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => openRefreshModal(proxy)}
                >
                  Refresh Creds
                </button>
                {proxy.device.online && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => changeIp(proxy.device.id)}
                    disabled={changingIp === proxy.device.id}
                  >
                    {changingIp === proxy.device.id ? 'Changing...' : 'Change IP'}
                  </button>
                )}
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => deleteProxy(proxy.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

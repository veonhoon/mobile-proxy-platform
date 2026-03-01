'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';

interface ProxyPort {
  id: string;
  port: number;
  username: string;
  password: string;
  enabled: boolean;
  deviceId: string;
  device: { id: string; name: string; online: boolean; carrier: string | null; ipAddress: string | null };
  assignedTo: { id: string; email: string } | null;
}

interface Device {
  id: string;
  name: string;
  online: boolean;
}

interface User {
  id: string;
  email: string;
}

export default function ProxiesPage() {
  const { authFetch } = useAuth();
  const [proxies, setProxies] = useState<ProxyPort[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    deviceId: '',
    port: '',
    username: '',
    password: '',
    assignedToId: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [proxyRes, deviceRes, userRes] = await Promise.all([
        authFetch('/api/proxies'),
        authFetch('/api/devices'),
        authFetch('/api/users'),
      ]);
      setProxies(await proxyRes.json());
      setDevices(await deviceRes.json());
      setUsers(await userRes.json());
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function createProxy(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await authFetch('/api/proxies', {
        method: 'POST',
        body: JSON.stringify({
          deviceId: form.deviceId,
          port: parseInt(form.port),
          username: form.username,
          password: form.password,
          assignedToId: form.assignedToId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setShowCreate(false);
      setForm({ deviceId: '', port: '', username: '', password: '', assignedToId: '' });
      loadAll();
    } catch (err) {
      setError('Failed to create proxy');
    }
  }

  async function toggleProxy(id: string, enabled: boolean) {
    try {
      await authFetch(`/api/proxies/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !enabled }),
      });
      loadAll();
    } catch (err) {
      console.error('Failed to toggle proxy:', err);
    }
  }

  async function deleteProxy(id: string) {
    if (!confirm('Delete this proxy port?')) return;
    try {
      await authFetch(`/api/proxies/${id}`, { method: 'DELETE' });
      loadAll();
    } catch (err) {
      console.error('Failed to delete proxy:', err);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Proxy Ports</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Create Proxy
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Proxy Port</h2>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={createProxy}>
              <div className="form-group">
                <label>Device</label>
                <select
                  value={form.deviceId}
                  onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
                  required
                >
                  <option value="">Select device...</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.online ? '(Online)' : '(Offline)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Port</label>
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: e.target.value })}
                  placeholder="e.g. 10001"
                  required
                  min={1024}
                  max={65535}
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label>Username</label>
                  <input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Assign to User (optional)</label>
                <select
                  value={form.assignedToId}
                  onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
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

      {/* Proxies table */}
      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Loading...</p>
        ) : proxies.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
            No proxy ports configured. Click &quot;Create Proxy&quot; to add one.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Port</th>
                <th>Device</th>
                <th>Credentials</th>
                <th>Assigned To</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {proxies.map((proxy) => (
                <tr key={proxy.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{proxy.port}</td>
                  <td>
                    {proxy.device.name}
                    <span
                      className={`badge ${proxy.device.online ? 'badge-online' : 'badge-offline'}`}
                      style={{ marginLeft: '0.5rem' }}
                    >
                      {proxy.device.online ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {proxy.username}:{proxy.password}
                  </td>
                  <td>{proxy.assignedTo?.email || '-'}</td>
                  <td>
                    <span className={`badge ${proxy.enabled ? 'badge-online' : 'badge-offline'}`}>
                      {proxy.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => toggleProxy(proxy.id, proxy.enabled)}
                    >
                      {proxy.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteProxy(proxy.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

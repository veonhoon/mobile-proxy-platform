'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';

interface Device {
  id: string;
  name: string;
  deviceKey: string;
  ipAddress: string | null;
  carrier: string | null;
  online: boolean;
  lastSeen: string | null;
  proxyPorts: { id: string; port: number; enabled: boolean }[];
}

export default function DevicesPage() {
  const { authFetch } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [createdDevice, setCreatedDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
  }, []);

  async function loadDevices() {
    try {
      const res = await authFetch('/api/devices');
      const data = await res.json();
      setDevices(data);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  }

  async function createDevice(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await authFetch('/api/devices', {
        method: 'POST',
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreatedDevice(data);
        setNewName('');
        loadDevices();
      }
    } catch (err) {
      console.error('Failed to create device:', err);
    }
  }

  async function deleteDevice(id: string) {
    if (!confirm('Delete this device? All associated proxy ports will be removed.')) return;
    try {
      await authFetch(`/api/devices/${id}`, { method: 'DELETE' });
      loadDevices();
    } catch (err) {
      console.error('Failed to delete device:', err);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Devices</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Add Device
        </button>
      </div>

      {/* Created device key display */}
      {createdDevice && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          Device created! Device Key (save this - shown only once):
          <br />
          <code
            className="copy-text"
            style={{ marginTop: '0.5rem', display: 'inline-block' }}
            onClick={() => navigator.clipboard.writeText(createdDevice.deviceKey)}
          >
            {createdDevice.deviceKey}
          </code>
          <button
            className="btn btn-sm btn-secondary"
            style={{ marginLeft: '0.5rem' }}
            onClick={() => setCreatedDevice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Device</h2>
            <form onSubmit={createDevice}>
              <div className="form-group">
                <label>Device Name</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Phone 1"
                  required
                  autoFocus
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

      {/* Devices table */}
      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Loading...</p>
        ) : devices.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
            No devices yet. Click &quot;Add Device&quot; to register one.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Name</th>
                <th>IP Address</th>
                <th>Carrier</th>
                <th>Proxy Ports</th>
                <th>Last Seen</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id}>
                  <td>
                    <span className={`badge ${device.online ? 'badge-online' : 'badge-offline'}`}>
                      {device.online ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td>{device.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {device.ipAddress || '-'}
                  </td>
                  <td>{device.carrier || '-'}</td>
                  <td>{device.proxyPorts.length}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {device.lastSeen
                      ? new Date(device.lastSeen).toLocaleString()
                      : 'Never'}
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteDevice(device.id)}
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

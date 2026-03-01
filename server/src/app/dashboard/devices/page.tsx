'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/useAuth';

interface Device {
  id: string;
  name: string;
  deviceKey: string;
  pairingCode: string | null;
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
  const [changingIp, setChangingIp] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      const res = await authFetch('/api/devices');
      const data = await res.json();
      setDevices(data);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(loadDevices, 10000);
    return () => clearInterval(interval);
  }, [loadDevices]);

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
        setShowCreate(false);
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

  async function changeIp(id: string) {
    setChangingIp(id);
    try {
      const res = await authFetch(`/api/devices/${id}/change-ip`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to change IP');
      }
    } catch (err) {
      console.error('Failed to change IP:', err);
    } finally {
      setTimeout(() => setChangingIp(null), 10000);
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

      {/* Created device - pairing code display */}
      {createdDevice && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          <div style={{ marginBottom: '0.5rem' }}>
            Device <strong>{createdDevice.name}</strong> created!
          </div>
          {createdDevice.pairingCode && (
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Pairing Code (enter this in the app):
              </span>
              <br />
              <code
                className="copy-text"
                style={{
                  fontSize: '2rem',
                  letterSpacing: '0.3em',
                  fontWeight: 'bold',
                  display: 'inline-block',
                  marginTop: '0.25rem',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                }}
                onClick={() => navigator.clipboard.writeText(createdDevice.pairingCode!)}
                title="Click to copy"
              >
                {createdDevice.pairingCode}
              </code>
            </div>
          )}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Device Key: <code
              className="copy-text"
              style={{ cursor: 'pointer' }}
              onClick={() => navigator.clipboard.writeText(createdDevice.deviceKey)}
              title="Click to copy"
            >{createdDevice.deviceKey}</code>
          </div>
          <button
            className="btn btn-sm btn-secondary"
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
                <th>Pairing Code</th>
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
                  <td>
                    <code
                      style={{
                        letterSpacing: '0.15em',
                        fontWeight: 'bold',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                      }}
                      onClick={() => device.pairingCode && navigator.clipboard.writeText(device.pairingCode)}
                      title="Click to copy"
                    >
                      {device.pairingCode || '-'}
                    </code>
                  </td>
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
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {device.online && (
                        <button
                          className="btn btn-sm"
                          style={{
                            backgroundColor: changingIp === device.id ? '#666' : '#F59E0B',
                            color: '#000',
                          }}
                          onClick={() => changeIp(device.id)}
                          disabled={changingIp === device.id}
                        >
                          {changingIp === device.id ? 'Changing...' : 'Change IP'}
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteDevice(device.id)}
                      >
                        Delete
                      </button>
                    </div>
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

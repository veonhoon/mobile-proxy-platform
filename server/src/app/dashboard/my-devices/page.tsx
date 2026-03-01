'use client';

import { useState, useEffect, useRef } from 'react';
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

export default function MyDevicesPage() {
  const { authFetch } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [createdDevice, setCreatedDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [changingIp, setChangingIp] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadDevices();
    intervalRef.current = setInterval(loadDevices, 10000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
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

  return (
    <div>
      <div className="page-header">
        <h1>My Devices</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Add Device
        </button>
      </div>

      {/* Created device key display */}
      {createdDevice && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          Device created! Pairing Code (save this - shown only once):
          <br />
          <code
            className="copy-text"
            style={{ marginTop: '0.5rem', display: 'inline-block', fontSize: '1.1rem' }}
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
                  placeholder="e.g. My Phone"
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

      {/* Devices grid */}
      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : devices.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
            No devices yet. Click &quot;+ Add Device&quot; to link your phone.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
          {devices.map((device) => (
            <div key={device.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 600 }}>{device.name}</span>
                <span className={`badge ${device.online ? 'badge-online' : 'badge-offline'}`}>
                  {device.online ? 'Online' : 'Offline'}
                </span>
              </div>

              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                {device.ipAddress && <div>IP: {device.ipAddress}</div>}
                {device.carrier && <div>Carrier: {device.carrier}</div>}
                <div>Proxy Ports: {device.proxyPorts.length}</div>
                {device.lastSeen && (
                  <div>Last Seen: {new Date(device.lastSeen).toLocaleString()}</div>
                )}
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ marginBottom: '0.25rem' }}>Pairing Code</label>
                <div
                  className="copy-text"
                  onClick={() => navigator.clipboard.writeText(device.deviceKey)}
                  style={{ width: '100%', fontSize: '0.8rem' }}
                >
                  {device.deviceKey}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {device.online && (
                  <button
                    className="btn btn-primary btn-sm"
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

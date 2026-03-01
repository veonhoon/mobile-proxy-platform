'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';

interface UserRow {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  createdAt: string;
  proxies: { id: string; port: number }[];
}

export default function UsersPage() {
  const { authFetch, user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const res = await authFetch('/api/users');
      setUsers(await res.json());
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleRole(id: string, currentRole: string) {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      await authFetch(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      });
      loadUsers();
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user?')) return;
    try {
      await authFetch(`/api/users/${id}`, { method: 'DELETE' });
      loadUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Users</h1>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>Loading...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Proxies</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'ADMIN' ? 'badge-admin' : ''}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>{u.proxies.length}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ display: 'flex', gap: '0.25rem' }}>
                    {u.id !== user?.id && (
                      <>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleRole(u.id, u.role)}
                        >
                          {u.role === 'ADMIN' ? 'Demote' : 'Promote'}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteUser(u.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {u.id === user?.id && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        (you)
                      </span>
                    )}
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

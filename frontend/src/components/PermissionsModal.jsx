import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { X, UserPlus, Trash2, Shield, AlertCircle, CheckCircle2, User, Clock } from 'lucide-react';

export default function PermissionsModal({ isOpen, onClose, document, onPermissionsUpdated }) {
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedPermission, setSelectedPermission] = useState('read');
  const [userSearch, setUserSearch] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen && document) {
      setPermissions(document.permissions || []);
      setError('');
      setSuccess('');
      fetchUsers();
    }
  }, [isOpen, document]);

  const fetchUsers = async () => {
    try {
      const res = await apiRequest('/auth/users');
      if (res.success) {
        // Exclude current owner from grantable user list
        const filtered = (res.users || []).filter(
          (u) => u._id !== (document.owner._id || document.owner)
        );
        setUsers(filtered);
        if (filtered.length > 0 && !selectedUserId) {
          setSelectedUserId(filtered[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to load user directory', err);
    }
  };

  if (!isOpen || !document) return null;

  const normalizedSearch = userSearch.trim().toLowerCase();
  const filteredUsers = users.filter((u) => {
    const name = (u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const department = (u.department || '').toLowerCase();
    return !normalizedSearch || name.includes(normalizedSearch) || email.includes(normalizedSearch) || department.includes(normalizedSearch);
  });

  const handleGrant = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await apiRequest(`/documents/${document._id}/permissions`, {
        method: 'POST',
        body: {
          targetUserId: selectedUserId,
          permission: selectedPermission
        }
      });

      if (res.success) {
        setPermissions(res.permissions || []);
        setSuccess('Access granted and signed into audit trail.');
        onPermissionsUpdated();
      }
    } catch (err) {
      setError(err.message || 'Failed to grant permission');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = async (targetUserId, targetName, permission) => {
    const current = permissions.find((p) => String(p.user?._id || p.user) === String(targetUserId));
    if (!current || current.permission === permission) return;

    setUpdatingUserId(String(targetUserId));
    setError('');
    setSuccess('');
    try {
      const res = await apiRequest(`/documents/${document._id}/permissions`, {
        method: 'POST',
        body: { targetUserId, permission }
      });
      if (res.success) {
        setPermissions(res.permissions || []);
        setSuccess(`${targetName}'s permission changed to ${permission.toUpperCase()}.`);
        onPermissionsUpdated();
      }
    } catch (err) {
      setError(err.message || 'Failed to update permission');
    } finally {
      setUpdatingUserId('');
    }
  };

  const handleRevoke = async (targetUserId, targetName) => {
    if (!window.confirm(`Revoke all access from ${targetName} immediately?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await apiRequest(`/documents/${document._id}/permissions/${targetUserId}`, {
        method: 'DELETE'
      });

      if (res.success) {
        setPermissions(res.permissions || []);
        setSuccess(`Access revoked immediately from ${targetName}. Next request will return 403 Forbidden.`);
        onPermissionsUpdated();
      }
    } catch (err) {
      setError(err.message || 'Failed to revoke permission');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Access & Revocation Controls</h3>
              <p className="text-xs text-slate-400 truncate max-w-[280px]">{document.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span>{success}</span>
            </div>
          )}

          {/* Guarantee Banner */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-200">Immediate Revocation Guarantee: </span>
              Revoking a user takes effect instantly. Any pending or subsequent download attempt by that user will be refused with 403 Forbidden and logged as unauthorized access.
            </div>
          </div>

          {/* Add Permission Form */}
          <form onSubmit={handleGrant} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Grant New User Access</span>
            </div>

            <div>
              <label htmlFor="employee-search" className="block text-[11px] text-slate-400 mb-1">Search employees by name, email, or department</label>
              <input
                id="employee-search"
                type="search"
                value={userSearch}
                onChange={(e) => {
                  const value = e.target.value;
                  setUserSearch(value);
                  const q = value.trim().toLowerCase();
                  const matches = users.filter((u) => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.department || '').toLowerCase().includes(q));
                  setSelectedUserId(matches[0]?._id || '');
                }}
                placeholder="Search employee..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Select Named User ({filteredUsers.length})</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {filteredUsers.length === 0 && <option value="">No employees found</option>}
                  {filteredUsers.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Permission Level</label>
                <select
                  value={selectedPermission}
                  onChange={(e) => setSelectedPermission(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="read">Read Only (Download & View)</option>
                  <option value="edit">Edit (Modify Metadata + Read)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !selectedUserId}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-lg text-xs transition shadow-md shadow-emerald-500/10 flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span>Authorize User</span>
            </button>
          </form>

          {/* Active Grants List */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
              <span>Active Grants ({permissions.length})</span>
              <span className="text-[10px] text-slate-500">Per-document granularity</span>
            </div>

            {permissions.length === 0 ? (
              <div className="p-4 text-center rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-500">
                No external users granted. Only document owner can reach this file.
              </div>
            ) : (
              <div className="space-y-2">
                {permissions.map((p) => {
                  const targetUser = p.user;
                  const userId = targetUser?._id || targetUser;
                  const userName = targetUser?.name || 'Authorized User';
                  const userEmail = targetUser?.email || 'user@company.com';
                  const userDept = targetUser?.department || 'Staff';

                  return (
                    <div
                      key={userId}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-white flex items-center gap-1.5">
                            <span>{userName}</span>
                            <span className="text-[10px] text-slate-500">({userDept})</span>
                          </div>
                          <div className="text-[11px] text-slate-400">{userEmail}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                                p.permission === 'edit'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}
                            >
                              {p.permission}
                            </span>
                            {p.grantedAt && (
                              <span className="text-[10px] text-slate-600 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {new Date(p.grantedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-3">
                        <label className="sr-only" htmlFor={`permission-${userId}`}>Permission for {userName}</label>
                        <select
                          id={`permission-${userId}`}
                          value={p.permission}
                          onChange={(e) => handlePermissionChange(userId, userName, e.target.value)}
                          disabled={loading || updatingUserId === String(userId)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-[11px] text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                          title="Change this user's permission"
                        >
                          <option value="read">Read</option>
                          <option value="edit">Edit</option>
                        </select>
                        <button
                          onClick={() => handleRevoke(userId, userName)}
                          disabled={loading || updatingUserId === String(userId)}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg border border-transparent hover:border-rose-900/60 transition disabled:opacity-50"
                          title={`Revoke access for ${userName}`}
                          aria-label={`Revoke access for ${userName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

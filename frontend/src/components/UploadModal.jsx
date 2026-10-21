import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { X, UploadCloud, FileText, AlertCircle, ShieldCheck, CheckCircle2, Users, Lock } from 'lucide-react';

export default function UploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Contracts');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [accessScope, setAccessScope] = useState('owner');
  const [availableUsers, setAvailableUsers] = useState([]);
  const [recipients, setRecipients] = useState({});
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    if (isOpen && accessScope === 'selected' && availableUsers.length === 0) {
      setUsersLoading(true);
      apiRequest('/auth/users')
        .then((res) => setAvailableUsers((res.users || []).filter((u) => u.role !== 'admin')))
        .catch((err) => setError(err.message || 'Could not load users for sharing.'))
        .finally(() => setUsersLoading(false));
    }
  }, [isOpen, accessScope]);

  if (!isOpen) return null;

  const normalizedUserSearch = userSearch.trim().toLowerCase();
  const filteredUsers = availableUsers.filter((u) => {
    const name = (u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const department = (u.department || '').toLowerCase();
    return !normalizedUserSearch || name.includes(normalizedUserSearch) || email.includes(normalizedUserSearch) || department.includes(normalizedUserSearch);
  });

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.size > 25 * 1024 * 1024) {
        setError('Selected file exceeds the 25 MB size limit.');
        setFile(null);
        return;
      }
      setError('');
      setFile(selected);
      if (!title) {
        // Pre-fill title without extension
        const rawName = selected.name.replace(/\.[^/.]+$/, '');
        setTitle(rawName.replace(/[_-]/g, ' '));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('category', category);
      formData.append('tags', tags);
      const initialGrants = accessScope === 'selected'
        ? Object.entries(recipients).filter(([, permission]) => permission).map(([userId, permission]) => ({ userId, permission }))
        : [];
      formData.append('initialGrants', JSON.stringify(initialGrants));
      formData.append('file', file);

      const res = await apiRequest('/documents', {
        method: 'POST',
        body: formData,
        isFormData: true
      });

      if (res.success) {
        onUploadSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Upload Confidential Document</h3>
              <p className="text-xs text-slate-400">Validated against magic bytes and hashed with SHA-256</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* File Picker */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Select File (PDF, DOCX, XLSX, Images, TXT)</label>
            <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-4 text-center cursor-pointer bg-slate-950/40 relative">
              <input
                type="file"
                required
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium text-white">{file.name}</span>
                  <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <UploadCloud className="w-6 h-6 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-400">Click or drag & drop file here</p>
                  <p className="text-[10px] text-slate-600">Max size 25 MB. Server verifies authentic magic bytes.</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Document Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Master Services Agreement 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Contracts">Contracts</option>
                <option value="Salary & HR">Salary & HR</option>
                <option value="Technical Drawings">Technical Drawings</option>
                <option value="Audit & Regulatory">Audit & Regulatory</option>
                <option value="Financials">Financials</option>
                <option value="Legal">Legal</option>
                <option value="General">General</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Tags (Comma-separated)</label>
              <input
                type="text"
                placeholder="confidential, board, 2026"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <label className="text-xs font-semibold text-slate-200">Access Scope</label>
            </div>
            <select
              value={accessScope}
              onChange={(e) => setAccessScope(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="owner">Owner only (default)</option>
              <option value="selected">Selected people only</option>
            </select>
            {accessScope === 'owner' ? (
              <p className="text-[11px] text-slate-400">Only your account can view or download this document until you explicitly grant access.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-400">Search registered users by name, email, or department, then choose their permission. No other user will receive access.</p>
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search employees..."
                  aria-label="Search employees by name, email, or department"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
                {usersLoading ? <p className="text-xs text-slate-400">Loading users…</p> :
                  availableUsers.length === 0 ? <p className="text-xs text-amber-300">No eligible users found.</p> :
                  filteredUsers.length === 0 ? <p className="text-xs text-amber-300">No employees match your search.</p> :
                  <div className="max-h-36 overflow-y-auto space-y-2">
                    {filteredUsers.map((u) => (
                      <div key={u._id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 p-2">
                        <label className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={Boolean(recipients[u._id])}
                            onChange={(e) => setRecipients((prev) => {
                              const next = { ...prev };
                              if (e.target.checked) next[u._id] = 'read';
                              else delete next[u._id];
                              return next;
                            })}
                          />
                          <span className="min-w-0">
                            <span className="block text-xs text-white truncate">{u.name}</span>
                            <span className="block text-[10px] text-slate-400 truncate">{u.email}</span>
                          </span>
                        </label>
                        {recipients[u._id] && (
                          <select
                            aria-label={`Permission for ${u.email}`}
                            value={recipients[u._id]}
                            onChange={(e) => setRecipients((prev) => ({ ...prev, [u._id]: e.target.value }))}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white"
                          >
                            <option value="read">Read</option>
                            <option value="edit">Edit</option>
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                }
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Confidentiality Description</label>
            <textarea
              rows={2}
              placeholder="Provide context or distribution restrictions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !file}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-lg text-xs sm:text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Validating & encrypting file...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Securely Store in Vault</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

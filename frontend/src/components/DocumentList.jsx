import React, { useState, useEffect } from 'react';
import { apiRequest, downloadFile, viewFile } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Filter,
  Download,
  Eye,
  Trash2,
  Edit3,
  FileText,
  Lock,
  Calendar,
  User,
  ShieldAlert,
  CheckCircle,
  AlertCircle,
  FileCheck
} from 'lucide-react';

export default function DocumentList({ onOpenUpload, onOpenPermissions, onOpenEdit }) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category && category !== 'ALL') params.append('category', category);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await apiRequest(`/documents?${params.toString()}`);
      if (res.success) {
        setDocuments(res.documents || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [category, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDocuments();
  };

  const handleView = async (doc) => {
    try {
      setActionMessage({ type: 'info', text: `Checking access to '${doc.originalFilename}'...` });
      await viewFile(doc._id);
      setActionMessage({ type: 'success', text: 'Document opened after server-side permission verification.' });
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Unable to view document.' });
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const handleDownload = async (doc) => {
    try {
      setActionMessage({ type: 'info', text: `Verifying permissions and streaming '${doc.originalFilename}'...` });
      await downloadFile(doc._id, doc.originalFilename);
      setActionMessage({ type: 'success', text: `Downloaded '${doc.originalFilename}' successfully. Event recorded in audit trail.` });
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Download forbidden or failed.' });
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Are you sure you want to permanently delete '${doc.title}'? This action will be audited.`)) {
      return;
    }

    try {
      const res = await apiRequest(`/documents/${doc._id}`, { method: 'DELETE' });
      if (res.success) {
        setActionMessage({ type: 'success', text: `Document deleted. Event signed into audit trail.` });
        fetchDocuments();
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Failed to delete document' });
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'Salary & HR':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/60';
      case 'Contracts':
        return 'bg-blue-950/80 text-blue-300 border-blue-800/60';
      case 'Technical Drawings':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60';
      case 'Financials':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
      case 'Audit & Regulatory':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getPermissionBadge = (perm, isOwner) => {
    if (isOwner) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
          👑 Document Owner
        </span>
      );
    }
    if (perm === 'edit') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800">
          ✏️ Edit & Read Access
        </span>
      );
    }
    if (perm === 'read') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
          👁️ Read Only Access
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950 text-rose-300 border border-rose-800">
        🔒 Unauthorized
      </span>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-7 px-1 sm:px-2">
      {/* Alert toast notification */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-center justify-between transition shadow-lg ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-200'
              : actionMessage.type === 'error'
              ? 'bg-rose-950/80 border-rose-700 text-rose-200'
              : 'bg-slate-900 border-slate-700 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            {actionMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
            {actionMessage.type === 'info' && <FileCheck className="w-4 h-4 text-sky-400" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-xs opacity-70 hover:opacity-100 ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Page Title & Controls */}
      <div className="flex flex-col gap-5 border-b border-slate-800/80 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
            Secure Documents
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-300">
              {documents.length} visible
            </span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Strict per-document access grants. Downloads re-validate server permissions in real time.
          </p>
        </div>

        {(user?.role === 'owner' || user?.role === 'admin') && (
          <button
            onClick={onOpenUpload}
            className="self-start rounded-xl border border-emerald-400/30 bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-950 md:self-auto"
          >
            <span>+ Upload document</span>
          </button>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm shadow-black/10 backdrop-blur sm:p-5">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by title, description, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-700/90 bg-slate-950/80 py-3 pl-10 pr-4 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/10"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-800/80 pt-4 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>Category:</span>
          </div>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-400 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="Contracts">Contracts</option>
            <option value="Salary & HR">Salary & HR</option>
            <option value="Technical Drawings">Technical Drawings</option>
            <option value="Audit & Regulatory">Audit & Regulatory</option>
            <option value="Financials">Financials</option>
            <option value="Legal">Legal</option>
            <option value="General">General</option>
          </select>

          <div className="flex items-center gap-1.5 text-slate-400 ml-auto">
            <Calendar className="w-3.5 h-3.5" />
            <span>Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-300 focus:border-emerald-400 focus:outline-none"
            />
            <span className="text-slate-600">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-300 focus:border-emerald-400 focus:outline-none"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-[11px] text-slate-400 hover:text-white underline ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Document Grid */}
      {loading ? (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-400 text-sm">Evaluating server-side authorization matrix...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No documents reachable</h3>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-md mx-auto">
            Zero-Trust is active: you only see documents you uploaded or documents explicitly shared with you by an owner.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => {
            const isOwner = doc.owner?._id === user?._id || doc.myPermission === 'owner';
            const canEdit = isOwner || doc.myPermission === 'edit';

            return (
              <div
                key={doc._id}
                className="group flex min-h-[300px] flex-col justify-between rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-sm shadow-black/20 transition duration-200 hover:-translate-y-0.5 hover:border-slate-700 hover:shadow-xl hover:shadow-black/20"
              >
                <div>
                  {/* Category and Permission Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${getCategoryColor(doc.category)}`}>
                      {doc.category}
                    </span>
                    <div>{getPermissionBadge(doc.myPermission, isOwner)}</div>
                  </div>

                  {/* Title & Description */}
                  <h4 className="mt-4 line-clamp-2 text-lg font-semibold leading-6 text-slate-50 transition group-hover:text-emerald-300">
                    {doc.title}
                  </h4>
                  <p className="mt-2 line-clamp-2 min-h-[40px] text-sm leading-5 text-slate-400">
                    {doc.description || 'No description provided.'}
                  </p>

                  {/* Metadata Chips */}
                  <div className="mt-5 space-y-3 border-t border-slate-800/80 pt-4 text-xs text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate max-w-[150px]">{doc.originalFilename}</span>
                      </span>
                      <span>{(doc.sizeBytes / 1024).toFixed(1)} KB</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>Owner: {doc.owner?.name || 'Unknown'}</span>
                      </span>
                      <span className="text-slate-500">v{doc.version || 1}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                      </span>
                      <span className="text-slate-500">
                        {doc.permissions?.length || 0} user grant(s)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-800/80 pt-4">
                  <button
                    onClick={() => handleView(doc)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-2.5 text-xs font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-700"
                    title="View supported file types after server-side permission verification"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold text-emerald-300 transition hover:border-emerald-400/40 hover:bg-emerald-500/15"
                    title="Download file with real-time server verification"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>

                  {canEdit && (
                    <button
                      onClick={() => onOpenEdit(doc)}
                      className="rounded-xl border border-slate-800 p-2.5 text-slate-400 transition hover:border-sky-500/30 hover:bg-sky-500/10 hover:text-sky-300"
                      title="Edit metadata"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}

                  {isOwner && (
                    <button
                      onClick={() => handleDelete(doc)}
                      className="rounded-xl border border-slate-800 p-2.5 text-slate-400 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

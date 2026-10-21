import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import { X, Edit3, AlertCircle, Shield } from 'lucide-react';

export default function EditModal({ isOpen, onClose, document, onEditSuccess, onOpenPermissions }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Contracts');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && document) {
      setTitle(document.title || '');
      setDescription(document.description || '');
      setCategory(document.category || 'Contracts');
      setTags(Array.isArray(document.tags) ? document.tags.join(', ') : '');
      setError('');
    }
  }, [isOpen, document]);

  if (!isOpen || !document) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await apiRequest(`/documents/${document._id}`, {
        method: 'PUT',
        body: {
          title,
          description,
          category,
          tags
        }
      });

      if (res.success) {
        onEditSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to update document');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Edit Document Metadata</h3>
              <p className="text-xs text-slate-400">Current Version: v{document.version || 1}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Document Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
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
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onOpenPermissions?.(document)}
              className="w-full py-2.5 px-4 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold rounded-lg text-xs sm:text-sm transition flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4" />
              Manage Access
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-lg text-xs sm:text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Recording modification...' : 'Save & Increment Version'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { apiRequest } from '../api/client';
import { X, UploadCloud, FileText, AlertCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function UploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Contracts');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

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

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, FileText, Activity, ShieldAlert, LogOut, CheckCircle2, User } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenUpload }) {
  const { user, logout } = useAuth();

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60 flex items-center gap-1">
            🛡️ Administrator
          </span>
        );
      case 'owner':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
            💼 Document Owner
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-950/80 text-sky-300 border border-sky-700/60 flex items-center gap-1">
            👁️ Document Viewer
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Zero-Trust Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('documents')}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Trust<span className="text-emerald-400">Vault</span>
              </span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-emerald-900/60 text-[11px] text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Zero-Trust Enforced</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 transition ${
                activeTab === 'documents'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Documents</span>
            </button>

            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 transition ${
                  activeTab === 'audit'
                    ? 'bg-slate-800 text-amber-400 border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Audit Trail & Security</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('threats')}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 transition ${
                activeTab === 'threats'
                  ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden sm:inline">Threat Model</span>
              <span className="sm:hidden">Threats</span>
            </button>
          </nav>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            {(user?.role === 'owner' || user?.role === 'admin') && onOpenUpload && (
              <button
                onClick={onOpenUpload}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-lg transition shadow-md shadow-emerald-500/10"
              >
                <span>+ Upload</span>
              </button>
            )}

            <div className="hidden lg:flex flex-col items-end">
              <span className="text-xs font-medium text-white">{user?.name}</span>
              <div className="mt-0.5">{getRoleBadge(user?.role)}</div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, Mail, User, Building, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function AuthModal() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('Executive');
  const [role, setRole] = useState('owner');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register({ name, email, password, department, role });
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  // One-click demo credentials loader
  const fillDemoCredentials = (demoRole) => {
    setIsRegister(false);
    setError('');
    if (demoRole === 'admin') {
      setEmail('admin@trustvault.security');
      setPassword('AdminPassword@2026!');
    } else if (demoRole === 'owner') {
      setEmail('owner@trustvault.security');
      setPassword('OwnerPassword@2026!');
    } else if (demoRole === 'viewer') {
      setEmail('viewer@trustvault.security');
      setPassword('ViewerPassword@2026!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 text-slate-950 shadow-lg shadow-emerald-500/20 mb-4">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            Trust<span className="text-emerald-400">Vault</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Zero-Trust Document Sharing & Cryptographic Audit Trail
          </p>
        </div>

        {/* Demo Roles Quick-Switch Banner */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 mb-6 shadow-xl backdrop-blur">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Instant Demo Logins (Click to autofill)</span>
            <span className="text-emerald-400 text-[10px] bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded">3 Roles Ready</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillDemoCredentials('admin')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 hover:border-emerald-500/50 text-left transition flex flex-col"
            >
              <span className="text-[11px] font-semibold text-amber-400">🛡️ Admin</span>
              <span className="text-[10px] text-slate-400 truncate">Audit & Logs</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemoCredentials('owner')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 hover:border-emerald-500/50 text-left transition flex flex-col"
            >
              <span className="text-[11px] font-semibold text-emerald-400">💼 Owner</span>
              <span className="text-[10px] text-slate-400 truncate">Upload & Grants</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemoCredentials('viewer')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 hover:border-emerald-500/50 text-left transition flex flex-col"
            >
              <span className="text-[11px] font-semibold text-sky-400">👁️ Viewer</span>
              <span className="text-[10px] text-slate-400 truncate">Read & Revocation</span>
            </button>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur">
          <div className="flex border-b border-slate-800 pb-4 mb-6">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(''); }}
              className={`flex-1 text-center font-medium text-sm pb-2 border-b-2 transition ${
                !isRegister ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(''); }}
              className={`flex-1 text-center font-medium text-sm pb-2 border-b-2 transition ${
                isRegister ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Register Account
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Department</label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Legal, Finance"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Account Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="owner">Document Owner</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Corporate Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-lg text-sm transition shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating with TrustVault...</span>
              ) : (
                <>
                  <span>{isRegister ? 'Create Secure Account' : 'Authenticate & Enter Vault'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Guarantee Notice */}
          <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              All logins and authorization events are immutably signed into the SHA-256 cryptographic audit chain.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { apiRequest } from '../api/client';
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  FileText,
  Key,
  Users,
  Database,
  ExternalLink
} from 'lucide-react';

export default function AdminAuditDashboard() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');
  const [actorEmail, setActorEmail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchStats = async () => {
    try {
      const res = await apiRequest('/audit/stats');
      if (res.success) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to load security statistics', err);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', 25);
      if (actionFilter && actionFilter !== 'ALL') params.append('action', actionFilter);
      if (outcomeFilter && outcomeFilter !== 'ALL') params.append('outcome', outcomeFilter);
      if (actorEmail) params.append('actorEmail', actorEmail);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await apiRequest(`/audit?${params.toString()}`);
      if (res.success) {
        setLogs(res.logs || []);
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIntegrity = async () => {
    setVerifying(true);
    setVerificationResult(null);
    try {
      const res = await apiRequest('/audit/verify');
      if (res.success) {
        setVerificationResult(res.verification);
        fetchStats();
        fetchLogs();
      }
    } catch (err) {
      setVerificationResult({
        isValid: false,
        reason: err.message || 'Verification failed to execute'
      });
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    fetchStats();
    handleVerifyIntegrity(); // Run automated integrity check on mount
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, outcomeFilter, startDate, endDate]);

  const getActionBadge = (action) => {
    if (action.includes('DENIED') || action === 'AUTH_LOGIN_FAILED') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
          ⛔ {action}
        </span>
      );
    }
    if (action.includes('PERMISSION')) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-950 text-sky-300 border border-sky-800">
          🔑 {action}
        </span>
      );
    }
    if (action === 'INTEGRITY_VERIFICATION_CHECK') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-800">
          🔍 {action}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
        ✓ {action}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Title & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Cryptographic Audit Trail
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800">
              Admin Exclusive
            </span>
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Immutable SHA-256 hash-chained log. Proves every access grant, download, change, and refused attempt.
          </p>
        </div>

        <button
          onClick={handleVerifyIntegrity}
          disabled={verifying}
          className="self-start md:self-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 text-emerald-400 font-semibold text-xs rounded-lg transition shadow-sm flex items-center gap-2 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
          <span>{verifying ? 'Re-verifying Cryptographic Chain...' : 'Verify Audit Chain Integrity'}</span>
        </button>
      </div>

      {/* Verification Status Banner */}
      {verificationResult && (
        <div
          className={`p-4 rounded-xl border backdrop-blur flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg ${
            verificationResult.isValid
              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
              : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {verificationResult.isValid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-sm font-semibold flex items-center gap-2">
                <span>
                  {verificationResult.isValid
                    ? 'Cryptographic Hash Chain Fully Verified (Zero Tampering Detected)'
                    : 'AUDIT CHAIN CORRUPTION / TAMPERING DETECTED!'}
                </span>
                <span className="text-xs opacity-70">({verificationResult.totalChecked} records checked)</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {verificationResult.isValid
                  ? verificationResult.message
                  : `Integrity failure: ${verificationResult.reason}`}
              </p>
              {verificationResult.latestHash && (
                <div className="mt-1 font-mono text-[10px] text-slate-400 truncate max-w-xl">
                  Latest Block Digest: {verificationResult.latestHash}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* System Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Audit Entries Chained</span>
            <Database className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats?.totalAuditEntries ?? total}</div>
          <div className="text-[10px] text-emerald-400 mt-1">SHA-256 Merkle Chained</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Unauthorized Access Refused</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400">{stats?.deniedAttempts ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-1">Recorded with full telemetry</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Registered Users</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats?.totalUsers ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-1">RBAC Partitioned</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Catalogued Documents</span>
            <FileText className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats?.totalDocuments ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-1">Private Storage Only</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 backdrop-blur space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter by actor email..."
              value={actorEmail}
              onChange={(e) => setActorEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Actions</option>
              <option value="DOCUMENT_UPLOAD">Upload</option>
              <option value="DOCUMENT_DOWNLOAD_SUCCESS">Download (Success)</option>
              <option value="DOCUMENT_DOWNLOAD_DENIED">Download (DENIED)</option>
              <option value="DOCUMENT_VIEW_METADATA_DENIED">Metadata View (DENIED)</option>
              <option value="PERMISSION_GRANTED">Permission Granted</option>
              <option value="PERMISSION_REVOKED">Permission Revoked</option>
              <option value="AUTH_LOGIN_SUCCESS">Login (Success)</option>
              <option value="AUTH_LOGIN_FAILED">Login (Failed)</option>
              <option value="INTEGRITY_VERIFICATION_CHECK">Integrity Check</option>
            </select>
          </div>

          <div>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Outcomes (Success & Denied)</option>
              <option value="SUCCESS">Success Only</option>
              <option value="DENIED">Refused / Denied Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px]">
              <tr>
                <th className="px-3.5 py-3">Seq #</th>
                <th className="px-3.5 py-3">Timestamp</th>
                <th className="px-3.5 py-3">Action</th>
                <th className="px-3.5 py-3">Outcome</th>
                <th className="px-3.5 py-3">Actor (Who)</th>
                <th className="px-3.5 py-3">Resource / Target</th>
                <th className="px-3.5 py-3">Details</th>
                <th className="px-3.5 py-3">SHA-256 Digest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                    Loading cryptographic audit blocks...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-500">
                    No audit records matching filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-800/40 transition font-mono text-[11px]">
                    <td className="px-3.5 py-2.5 text-slate-500">#{log.sequenceNumber}</td>
                    <td className="px-3.5 py-2.5 text-slate-400 whitespace-nowrap font-sans">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">{getActionBadge(log.action)}</td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          log.outcome === 'SUCCESS'
                            ? 'bg-emerald-950/60 text-emerald-400'
                            : 'bg-rose-950/60 text-rose-400'
                        }`}
                      >
                        {log.outcome}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 font-sans">
                      <div className="font-medium text-white">{log.actor?.email}</div>
                      <div className="text-[10px] text-slate-500">
                        role: {log.actor?.role} • {log.actor?.ipAddress}
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 font-sans">
                      {log.document?.title && (
                        <div className="text-slate-200 truncate max-w-[140px]" title={log.document.title}>
                          {log.document.title}
                        </div>
                      )}
                      {log.targetUser?.email && (
                        <div className="text-sky-400 text-[10px]">
                          Target: {log.targetUser.email} ({log.targetUser.grantedPermission})
                        </div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-400 font-sans max-w-[200px] truncate" title={log.details}>
                      {log.details || '—'}
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-[10px] text-slate-500 max-w-[120px] truncate" title={log.hash}>
                      {log.hash ? log.hash.substring(0, 14) + '...' : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing {logs.length} of {total} records
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white"
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

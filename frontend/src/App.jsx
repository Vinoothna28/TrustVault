import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthModal from './components/AuthModal';
import Navbar from './components/Navbar';
import DocumentList from './components/DocumentList';
import UploadModal from './components/UploadModal';
import PermissionsModal from './components/PermissionsModal';
import EditModal from './components/EditModal';
import AdminAuditDashboard from './components/AdminAuditDashboard';
import ThreatsGuide from './components/ThreatsGuide';

function MainApp() {
  const { isAuthenticated, loading, user } = useAuth();
  const [activeTab, setActiveTab] = useState('documents');

  // Modal states
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDocForPermissions, setSelectedDocForPermissions] = useState(null);
  const [selectedDocForEdit, setSelectedDocForEdit] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm">Connecting to TrustVault Secure Core...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthModal />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenUpload={() => setIsUploadOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'documents' && (
          <DocumentList
            key={refreshTrigger}
            onOpenUpload={() => setIsUploadOpen(true)}
            onOpenPermissions={(doc) => setSelectedDocForPermissions(doc)}
            onOpenEdit={(doc) => setSelectedDocForEdit(doc)}
          />
        )}

        {activeTab === 'audit' && user?.role === 'admin' && (
          <AdminAuditDashboard />
        )}

        {activeTab === 'threats' && (
          <ThreatsGuide />
        )}
      </main>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => setRefreshTrigger((prev) => prev + 1)}
      />

      {/* Permissions & Revocation Modal */}
      <PermissionsModal
        isOpen={!!selectedDocForPermissions}
        document={selectedDocForPermissions}
        onClose={() => setSelectedDocForPermissions(null)}
        onPermissionsUpdated={() => setRefreshTrigger((prev) => prev + 1)}
      />

      {/* Edit Metadata Modal */}
      <EditModal
        isOpen={!!selectedDocForEdit}
        document={selectedDocForEdit}
        onClose={() => setSelectedDocForEdit(null)}
        onEditSuccess={() => setRefreshTrigger((prev) => prev + 1)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>TrustVault Security Engine • Cryptographic SHA-256 Audit Trail • Zero-Trust Access</span>
          <span>Hiring Challenge 2026</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

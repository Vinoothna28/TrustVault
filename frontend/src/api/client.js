const API_BASE_URL = import.meta.env.VITE_API_URL ||
'https://trustvault-backend-uwbw.onrender.com/api';

/**
 * Custom API client with automatic token attachment and error extraction
 */
export async function apiRequest(endpoint, { method = 'GET', body = null, isFormData = false } = {}) {
  const token = localStorage.getItem('trustvault_token');
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!isFormData && body) {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : null),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  // Handle unauthorized / expired session
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
    localStorage.removeItem('trustvault_token');
    localStorage.removeItem('trustvault_user');
    window.location.reload();
    throw new Error('Session expired. Please log in again.');
  }

  const data = await response.json().catch(() => ({
    success: false,
    message: 'Invalid server response'
  }));

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

/**
 * Authenticated document file download helper (pipes stream to browser download)
 */
export async function downloadFile(documentId, filename) {
  const token = localStorage.getItem('trustvault_token');
  const headers = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/download`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Download failed' }));
    throw new Error(errorData.message || `Download failed: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'document.pdf';
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}


/**
 * Open a protected PDF/image/text document in a new tab.
 * The browser receives a blob only after the backend validates the current grant.
 */
export async function viewFile(documentId) {
  const tab = window.open('about:blank', '_blank');
  if (!tab) throw new Error('Allow pop-ups to view this document.');

  try {
    const token = localStorage.getItem('trustvault_token');
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/download?view=1`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({ message: 'Document viewing failed.' }));
      throw new Error(data.message || `View failed: HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    tab.location.href = url;
    // Keep the URL alive while the tab is reading it; revoke after a conservative delay.
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab.close();
    throw error;
  }
}

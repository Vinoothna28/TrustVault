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

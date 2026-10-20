const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Validates magic number signatures of uploaded buffer to prevent
 * content-type spoofing (e.g. uploading an executable renamed as a .pdf).
 */
const validateFileSignature = (buffer, reportedMimeType) => {
  if (!buffer || buffer.length < 4) {
    return { isValid: false, reason: 'File buffer is empty or too short' };
  }

  const headerHex = buffer.slice(0, 12).toString('hex').toLowerCase();

  // PDF: 25 50 44 46 (%PDF)
  if (reportedMimeType === 'application/pdf') {
    if (headerHex.startsWith('25504446')) {
      return { isValid: true, detectedType: 'pdf' };
    }
    return { isValid: false, reason: 'File content does not match PDF magic byte signature' };
  }

  // PNG: 89 50 4e 47 0d 0a 1a 0a
  if (reportedMimeType === 'image/png') {
    if (headerHex.startsWith('89504e470d0a1a0a')) {
      return { isValid: true, detectedType: 'png' };
    }
    return { isValid: false, reason: 'File content does not match PNG magic byte signature' };
  }

  // JPEG: ff d8 ff
  if (reportedMimeType === 'image/jpeg' || reportedMimeType === 'image/jpg') {
    if (headerHex.startsWith('ffd8ff')) {
      return { isValid: true, detectedType: 'jpeg' };
    }
    return { isValid: false, reason: 'File content does not match JPEG magic byte signature' };
  }

  // ZIP / DOCX / XLSX: 50 4b 03 04 (PK..)
  if (
    reportedMimeType === 'application/zip' ||
    reportedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    reportedMimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    if (headerHex.startsWith('504b0304')) {
      return { isValid: true, detectedType: 'zip/office' };
    }
    return { isValid: false, reason: 'File content does not match ZIP/DOCX/XLSX magic byte signature' };
  }

  // Plain Text / CSV: check that it doesn't contain binary null bytes and is UTF-8
  if (reportedMimeType === 'text/plain' || reportedMimeType === 'text/csv') {
    const slice = buffer.slice(0, 4096);
    for (let i = 0; i < slice.length; i++) {
      if (slice[i] === 0) {
        return { isValid: false, reason: 'Plain text file contains illegal null bytes (binary disguised as text)' };
      }
    }
    return { isValid: true, detectedType: 'text' };
  }

  // Reject unsupported MIME types by default (Whitelisting approach)
  return {
    isValid: false,
    reason: `Unsupported file type '${reportedMimeType}'. Allowed formats: PDF, PNG, JPEG, DOCX, XLSX, TXT, CSV.`
  };
};

/**
 * Sanitize original filename to prevent path traversal and shell injection
 */
const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return 'unnamed_document.dat';
  }
  // Strip path traversal sequences, directory separators, and control characters
  const base = path.basename(filename);
  const sanitized = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.+/g, '.') // collapse multiple dots
    .substring(0, 150); // limit length

  return sanitized || 'document.dat';
};

/**
 * Compute SHA-256 checksum of a file buffer
 */
const computeBufferChecksum = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

module.exports = {
  validateFileSignature,
  sanitizeFilename,
  computeBufferChecksum
};

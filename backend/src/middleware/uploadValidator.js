const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  validateFileSignature,
  sanitizeFilename,
  computeBufferChecksum
} = require('../utils/fileSecurity');

// Ensure storage directory exists
const getStorageDir = () => {
  const dir = path.resolve(
    process.cwd(),
    process.env.STORAGE_PATH || 'storage/documents'
  );
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Use memory storage for in-memory buffer inspection before disk write
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_BYTES, 10) || 25 * 1024 * 1024 // 25 MB
  }
}).single('file');

/**
 * Upload Validation & Secure Storage Middleware:
 * Inspects uploaded file buffer magic bytes, sanitizes filename,
 * writes to an isolated directory using an unguessable UUID filename,
 * and computes SHA-256 integrity checksum.
 */
const validateAndStoreUpload = (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File size exceeds maximum permitted limit (25 MB).'
        });
      }
      return res.status(400).json({
        success: false,
        message: `File upload error: ${err.message}`
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. A document file is required.'
      });
    }

    const { buffer, originalname, mimetype, size } = req.file;

    // 1. Magic bytes validation (prevent file-type spoofing)
    const signatureCheck = validateFileSignature(buffer, mimetype);
    if (!signatureCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: `Security validation failed: ${signatureCheck.reason}`
      });
    }

    // 2. Sanitize original filename (prevent path traversal / control chars)
    const cleanOriginalName = sanitizeFilename(originalname);

    // 3. Generate unguessable UUID storage key (never use user-supplied filename on disk)
    const ext = path.extname(cleanOriginalName) || '.dat';
    const storageKey = `${crypto.randomUUID()}${ext}`;
    const storageDir = getStorageDir();
    const destinationPath = path.join(storageDir, storageKey);

    try {
      // 4. Securely write to isolated storage disk
      fs.writeFileSync(destinationPath, buffer);

      // 5. Compute SHA-256 checksum of saved file
      const checksumSha256 = computeBufferChecksum(buffer);

      req.fileInfo = {
        storageKey,
        originalFilename: cleanOriginalName,
        mimeType: mimetype,
        sizeBytes: size,
        checksumSha256,
        destinationPath
      };

      next();
    } catch (writeErr) {
      console.error(`[validateAndStoreUpload ERROR] Failed to write file: ${writeErr.message}`);
      return res.status(500).json({
        success: false,
        message: 'Failed to securely store document file.'
      });
    }
  });
};

module.exports = {
  validateAndStoreUpload,
  getStorageDir
};

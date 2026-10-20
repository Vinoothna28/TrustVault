const express = require('express');
const {
  uploadDocument,
  listDocuments,
  getDocumentById,
  downloadDocument,
  updateDocument,
  deleteDocument,
  grantPermission,
  revokePermission
} = require('../controllers/documentController');
const { authenticateToken, requireRoles } = require('../middleware/auth');
const { checkDocumentAccess } = require('../middleware/checkPermission');
const { validateAndStoreUpload } = require('../middleware/uploadValidator');

const router = express.Router();

// Upload document (Owner or Admin role required)
router.post(
  '/',
  authenticateToken,
  requireRoles('owner', 'admin'),
  validateAndStoreUpload,
  uploadDocument
);

// List visible documents (filtered by owner/permission dynamically)
router.get('/', authenticateToken, listDocuments);

// Get single document metadata (requires read access)
router.get('/:id', authenticateToken, checkDocumentAccess('read'), getDocumentById);

// Download document file (strictly checks permission on EVERY download request)
router.get('/:id/download', authenticateToken, checkDocumentAccess('read'), downloadDocument);

// Update document metadata (requires edit access)
router.put('/:id', authenticateToken, checkDocumentAccess('edit'), updateDocument);

// Delete document (strictly owner only)
router.delete('/:id', authenticateToken, checkDocumentAccess('owner'), deleteDocument);

// Grant per-document permission (strictly owner only)
router.post('/:id/permissions', authenticateToken, checkDocumentAccess('owner'), grantPermission);

// Revoke per-document permission (strictly owner only) - supports both DELETE and POST
router.delete(
  '/:id/permissions/:targetUserId',
  authenticateToken,
  checkDocumentAccess('owner'),
  revokePermission
);
router.post(
  '/:id/permissions/revoke',
  authenticateToken,
  checkDocumentAccess('owner'),
  revokePermission
);

module.exports = router;

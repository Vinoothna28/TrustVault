const Document = require('../models/Document');
const { logAuditEvent } = require('../utils/auditLogger');

/**
 * Resource-specific Authorization Middleware:
 * Validates document permissions dynamically per request.
 * Required level can be: 'read', 'edit', or 'owner'.
 */
const checkDocumentAccess = (requiredLevel = 'read') => {
  return async (req, res, next) => {
    try {
      const documentId = req.params.id;
      if (!documentId || !documentId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid document ID format.'
        });
      }

      const document = await Document.findOne({
        _id: documentId,
        isDeleted: false
      }).populate('owner', 'name email role department');

      if (!document) {
        return res.status(404).json({
          success: false,
          message: 'Document not found or has been deleted.'
        });
      }

      const userIdStr = req.user._id.toString();
      const ownerIdStr = document.owner._id ? document.owner._id.toString() : document.owner.toString();
      const isOwner = userIdStr === ownerIdStr;

      // Check per-document explicit permission grants
      const userGrant = document.permissions.find(
        (p) => p.user && p.user.toString() === userIdStr
      );

      let isAuthorized = false;
      let effectivePermission = null;

      if (isOwner) {
        isAuthorized = true;
        effectivePermission = 'owner';
      } else if (userGrant) {
        effectivePermission = userGrant.permission;
        if (requiredLevel === 'read') {
          // Both 'read' and 'edit' grants allow reading
          isAuthorized = true;
        } else if (requiredLevel === 'edit') {
          isAuthorized = userGrant.permission === 'edit';
        } else if (requiredLevel === 'owner') {
          // Strictly owner only for deletion and permission delegation
          isAuthorized = false;
        }
      }

      // If unauthorized, log denied access attempt immediately to audit trail
      if (!isAuthorized) {
        let deniedAction = 'DOCUMENT_VIEW_METADATA_DENIED';
        if (req.path.includes('/download')) {
          deniedAction = 'DOCUMENT_DOWNLOAD_DENIED';
        } else if (req.method === 'PUT' || req.method === 'PATCH') {
          deniedAction = 'DOCUMENT_EDIT_DENIED';
        } else if (req.method === 'DELETE') {
          deniedAction = 'DOCUMENT_DELETE_DENIED';
        } else if (req.path.includes('/permissions')) {
          deniedAction = 'PERMISSION_CHANGE_DENIED';
        }

        await logAuditEvent({
          action: deniedAction,
          outcome: 'DENIED',
          actor: {
            userId: req.user._id,
            email: req.user.email,
            role: req.user.role,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
          },
          document: {
            documentId: document._id,
            title: document.title,
            category: document.category
          },
          details: `User requested '${requiredLevel}' access but held '${effectivePermission || 'none'}'. Route: ${req.originalUrl}`
        });

        return res.status(403).json({
          success: false,
          message: `Forbidden: You do not have '${requiredLevel}' access to this document.`
        });
      }

      // Attach document and calculated permission to request context
      req.document = document;
      req.effectivePermission = effectivePermission;
      next();
    } catch (error) {
      console.error(`[checkDocumentAccess ERROR] ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Internal authorization evaluation error.'
      });
    }
  };
};

module.exports = {
  checkDocumentAccess
};

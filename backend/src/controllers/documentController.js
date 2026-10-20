const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const User = require('../models/User');
const { logAuditEvent } = require('../utils/auditLogger');
const { getStorageDir } = require('../middleware/uploadValidator');

/**
 * Upload a new confidential document
 */
const uploadDocument = async (req, res) => {
  try {
    const { title, description, category, tags } = req.body;
    const fileInfo = req.fileInfo;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Document title is required.'
      });
    }

    if (!fileInfo) {
      return res.status(400).json({
        success: false,
        message: 'File upload is missing or invalid.'
      });
    }

    const parsedTags = tags
      ? (typeof tags === 'string' ? tags.split(',') : tags).map((t) => t.trim()).filter(Boolean)
      : [];

    const newDoc = new Document({
      title: title.trim(),
      description: description ? description.trim() : '',
      category: category || 'General',
      owner: req.user._id,
      storageKey: fileInfo.storageKey,
      originalFilename: fileInfo.originalFilename,
      mimeType: fileInfo.mimeType,
      sizeBytes: fileInfo.sizeBytes,
      checksumSha256: fileInfo.checksumSha256,
      tags: parsedTags,
      permissions: []
    });

    await newDoc.save();

    await logAuditEvent({
      action: 'DOCUMENT_UPLOAD',
      outcome: 'SUCCESS',
      actor: {
        userId: req.user._id,
        email: req.user.email,
        role: req.user.role,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      },
      document: {
        documentId: newDoc._id,
        title: newDoc.title,
        category: newDoc.category
      },
      details: `Uploaded file '${fileInfo.originalFilename}' (${(fileInfo.sizeBytes / 1024).toFixed(1)} KB, SHA-256: ${fileInfo.checksumSha256.substring(0, 16)}...)`
    });

    const populated = await Document.findById(newDoc._id)
      .populate('owner', 'name email department role');

    return res.status(201).json({
      success: true,
      message: 'Document securely uploaded and catalogued.',
      document: populated
    });
  } catch (error) {
    console.error(`[uploadDocument ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to process document upload.'
    });
  }
};

/**
 * List documents visible to the requesting user
 * Filters by access rules: User must be owner OR have explicit permission grant.
 * Supports query filters: search, category, owner, startDate, endDate.
 */
const listDocuments = async (req, res) => {
  try {
    const { search, category, ownerId, startDate, endDate } = req.query;
    const userId = req.user._id;

    // Strict access control: Document is visible only if user is owner or explicitly granted access
    const baseFilter = {
      isDeleted: false,
      $or: [
        { owner: userId },
        { 'permissions.user': userId }
      ]
    };

    // Category filter
    if (category && category !== 'ALL') {
      baseFilter.category = category;
    }

    // Owner filter
    if (ownerId && ownerId.match(/^[0-9a-fA-F]{24}$/)) {
      baseFilter.owner = ownerId;
    }

    // Date range filter
    if (startDate || endDate) {
      baseFilter.createdAt = {};
      if (startDate) {
        baseFilter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        baseFilter.createdAt.$lte = end;
      }
    }

    // Keyword search filter (title and description)
    if (search && typeof search === 'string' && search.trim().length > 0) {
      const sanitizedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      baseFilter.$and = [
        {
          $or: [
            { title: { $regex: sanitizedSearch, $options: 'i' } },
            { description: { $regex: sanitizedSearch, $options: 'i' } }
          ]
        }
      ];
    }

    const documents = await Document.find(baseFilter)
      .populate('owner', 'name email department role')
      .populate('permissions.user', 'name email department role')
      .populate('permissions.grantedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Map each document with the requesting user's calculated permission level
    const enhancedDocs = documents.map((doc) => {
      const isOwner = doc.owner._id.toString() === userId.toString();
      let myPermission = isOwner ? 'owner' : null;

      if (!isOwner) {
        const grant = doc.permissions.find(
          (p) => p.user && p.user._id.toString() === userId.toString()
        );
        if (grant) {
          myPermission = grant.permission;
        }
      }

      return {
        ...doc,
        myPermission
      };
    });

    return res.status(200).json({
      success: true,
      count: enhancedDocs.length,
      documents: enhancedDocs
    });
  } catch (error) {
    console.error(`[listDocuments ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve documents.'
    });
  }
};

/**
 * Retrieve metadata for a single document
 */
const getDocumentById = async (req, res) => {
  try {
    const document = await Document.findById(req.document._id)
      .populate('owner', 'name email department role')
      .populate('permissions.user', 'name email department role')
      .populate('permissions.grantedBy', 'name email');

    await logAuditEvent({
      action: 'DOCUMENT_VIEW_METADATA_SUCCESS',
      outcome: 'SUCCESS',
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
      details: `Viewed metadata (permission level: '${req.effectivePermission}')`
    });

    return res.status(200).json({
      success: true,
      document: {
        ...document.toJSON(),
        myPermission: req.effectivePermission
      }
    });
  } catch (error) {
    console.error(`[getDocumentById ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to load document metadata.'
    });
  }
};

/**
 * Download document file with dynamic, real-time permission enforcement
 */
const downloadDocument = async (req, res) => {
  try {
    const document = req.document;
    const storageDir = getStorageDir();
    const filePath = path.join(storageDir, document.storageKey);

    // Verify file exists on private storage disk
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Underlying document file is missing from secure storage.'
      });
    }

    // Audit log successful download with user and document details
    await logAuditEvent({
      action: 'DOCUMENT_DOWNLOAD_SUCCESS',
      outcome: 'SUCCESS',
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
      details: `Downloaded '${document.originalFilename}' (${(document.sizeBytes / 1024).toFixed(1)} KB)`
    });

    // Enforce anti-caching headers so browser cannot retain copy without revalidation
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(document.originalFilename)}"`
    );

    // Stream file securely to client
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error(`[downloadDocument ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to stream document file.'
    });
  }
};

/**
 * Update document details (requires 'edit' or 'owner' permission)
 */
const updateDocument = async (req, res) => {
  try {
    const document = req.document;
    const { title, description, category, tags } = req.body;

    const changes = [];
    if (title && title.trim() !== document.title) {
      changes.push(`title: '${document.title}' -> '${title.trim()}'`);
      document.title = title.trim();
    }
    if (description !== undefined && description !== document.description) {
      changes.push('description updated');
      document.description = description.trim();
    }
    if (category && category !== document.category) {
      changes.push(`category: '${document.category}' -> '${category}'`);
      document.category = category;
    }
    if (tags !== undefined) {
      const parsedTags = Array.isArray(tags)
        ? tags
        : tags.split(',').map((t) => t.trim()).filter(Boolean);
      document.tags = parsedTags;
      changes.push('tags updated');
    }

    document.version += 1;
    await document.save();

    await logAuditEvent({
      action: 'DOCUMENT_EDIT_SUCCESS',
      outcome: 'SUCCESS',
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
      details: `Document modified (v${document.version}): ${changes.join(', ') || 'No major changes'}`
    });

    return res.status(200).json({
      success: true,
      message: 'Document metadata updated successfully.',
      document
    });
  } catch (error) {
    console.error(`[updateDocument ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to update document.'
    });
  }
};

/**
 * Soft delete document (Strictly owner only)
 */
const deleteDocument = async (req, res) => {
  try {
    const document = req.document;
    document.isDeleted = true;
    await document.save();

    await logAuditEvent({
      action: 'DOCUMENT_DELETE_SUCCESS',
      outcome: 'SUCCESS',
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
      details: 'Document marked as deleted by owner'
    });

    return res.status(200).json({
      success: true,
      message: 'Document deleted successfully.'
    });
  } catch (error) {
    console.error(`[deleteDocument ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete document.'
    });
  }
};

/**
 * Grant per-document access to a named user (Strictly owner only)
 */
const grantPermission = async (req, res) => {
  try {
    const document = req.document;
    const { targetUserId, permission } = req.body;

    if (!targetUserId || !targetUserId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Valid target user ID is required.'
      });
    }

    if (!['read', 'edit'].includes(permission)) {
      return res.status(400).json({
        success: false,
        message: "Permission must be either 'read' or 'edit'."
      });
    }

    // Cannot grant permissions to document owner (owner already has full rights)
    if (targetUserId.toString() === document.owner._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'User is already the document owner.'
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser || !targetUser.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Target user does not exist or is inactive.'
      });
    }

    // Check if permission already exists for this user
    const existingIndex = document.permissions.findIndex(
      (p) => p.user && p.user.toString() === targetUserId.toString()
    );

    if (existingIndex >= 0) {
      document.permissions[existingIndex].permission = permission;
      document.permissions[existingIndex].grantedBy = req.user._id;
      document.permissions[existingIndex].grantedAt = new Date();
    } else {
      document.permissions.push({
        user: targetUser._id,
        permission,
        grantedBy: req.user._id,
        grantedAt: new Date()
      });
    }

    await document.save();

    await logAuditEvent({
      action: 'PERMISSION_GRANTED',
      outcome: 'SUCCESS',
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
      targetUser: {
        userId: targetUser._id,
        email: targetUser.email,
        grantedPermission: permission
      },
      details: `Granted '${permission}' access to ${targetUser.email} (${targetUser.name})`
    });

    const updated = await Document.findById(document._id)
      .populate('owner', 'name email department role')
      .populate('permissions.user', 'name email department role')
      .populate('permissions.grantedBy', 'name email');

    return res.status(200).json({
      success: true,
      message: `Granted '${permission}' access to ${targetUser.name}.`,
      permissions: updated.permissions
    });
  } catch (error) {
    console.error(`[grantPermission ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to grant permission.'
    });
  }
};

/**
 * Revoke permission from a named user immediately (Strictly owner only)
 * The revocation takes effect on the very next request.
 */
const revokePermission = async (req, res) => {
  try {
    const document = req.document;
    const targetUserId = req.params.targetUserId || req.body.targetUserId;

    if (!targetUserId || !targetUserId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Valid target user ID is required.'
      });
    }

    const targetUser = await User.findById(targetUserId);

    const initialCount = document.permissions.length;
    document.permissions = document.permissions.filter(
      (p) => p.user && p.user.toString() !== targetUserId.toString()
    );

    if (document.permissions.length === initialCount) {
      return res.status(404).json({
        success: false,
        message: 'Specified user had no existing permission grant on this document.'
      });
    }

    await document.save();

    await logAuditEvent({
      action: 'PERMISSION_REVOKED',
      outcome: 'SUCCESS',
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
      targetUser: {
        userId: targetUserId,
        email: targetUser ? targetUser.email : 'unknown',
        grantedPermission: 'REVOKED'
      },
      details: `Revoked all permissions from ${targetUser ? targetUser.email : targetUserId}. Immediate revocation effective.`
    });

    const updated = await Document.findById(document._id)
      .populate('owner', 'name email department role')
      .populate('permissions.user', 'name email department role')
      .populate('permissions.grantedBy', 'name email');

    return res.status(200).json({
      success: true,
      message: 'Permission revoked immediately.',
      permissions: updated.permissions
    });
  } catch (error) {
    console.error(`[revokePermission ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to revoke permission.'
    });
  }
};

module.exports = {
  uploadDocument,
  listDocuments,
  getDocumentById,
  downloadDocument,
  updateDocument,
  deleteDocument,
  grantPermission,
  revokePermission
};

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    sequenceNumber: {
      type: Number,
      required: true,
      unique: true,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    action: {
      type: String,
      required: true,
      enum: [
        'AUTH_LOGIN_SUCCESS',
        'AUTH_LOGIN_FAILED',
        'AUTH_REGISTER_SUCCESS',
        'DOCUMENT_UPLOAD',
        'DOCUMENT_VIEW_METADATA_SUCCESS',
        'DOCUMENT_VIEW_METADATA_DENIED',
        'DOCUMENT_DOWNLOAD_SUCCESS',
        'DOCUMENT_DOWNLOAD_DENIED',
        'DOCUMENT_EDIT_SUCCESS',
        'DOCUMENT_EDIT_DENIED',
        'DOCUMENT_DELETE_SUCCESS',
        'DOCUMENT_DELETE_DENIED',
        'PERMISSION_GRANTED',
        'PERMISSION_REVOKED',
        'PERMISSION_CHANGE_DENIED',
        'INTEGRITY_VERIFICATION_CHECK'
      ],
      index: true
    },
    outcome: {
      type: String,
      enum: ['SUCCESS', 'DENIED'],
      required: true,
      index: true
    },
    actor: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      email: {
        type: String,
        default: 'anonymous'
      },
      role: {
        type: String,
        default: 'unknown'
      },
      ipAddress: {
        type: String,
        default: 'unknown'
      },
      userAgent: {
        type: String,
        default: 'unknown'
      }
    },
    document: {
      documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        default: null
      },
      title: {
        type: String,
        default: null
      },
      category: {
        type: String,
        default: null
      }
    },
    targetUser: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      email: {
        type: String,
        default: null
      },
      grantedPermission: {
        type: String,
        default: null
      }
    },
    details: {
      type: String,
      default: ''
    },
    // Tamper-evident cryptographic chaining
    previousHash: {
      type: String,
      required: true
    },
    hash: {
      type: String,
      required: true
    }
  },
  {
    timestamps: false // Timestamps are strictly locked to immutable audit record timestamp
  }
);

// Prevent updates and deletions at Mongoose model level for defense-in-depth
auditLogSchema.pre('updateOne', function () {
  throw new Error('AuditLog is append-only: updates are strictly forbidden');
});
auditLogSchema.pre('updateMany', function () {
  throw new Error('AuditLog is append-only: updates are strictly forbidden');
});
auditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('AuditLog is append-only: updates are strictly forbidden');
});
auditLogSchema.pre('findOneAndDelete', function () {
  throw new Error('AuditLog is append-only: deletions are strictly forbidden');
});
auditLogSchema.pre('deleteMany', function () {
  throw new Error('AuditLog is append-only: bulk deletions are strictly forbidden');
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;

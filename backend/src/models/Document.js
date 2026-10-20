const mongoose = require('mongoose');

const permissionEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    permission: {
      type: String,
      enum: ['read', 'edit'],
      required: true
    },
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    grantedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: ''
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'Contracts',
        'Salary & HR',
        'Technical Drawings',
        'Audit & Regulatory',
        'Financials',
        'Legal',
        'General'
      ],
      default: 'General',
      index: true
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // The internal unguessable filename on isolated storage disk (UUID)
    storageKey: {
      type: String,
      required: true,
      unique: true
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true
    },
    mimeType: {
      type: String,
      required: true
    },
    sizeBytes: {
      type: Number,
      required: true
    },
    checksumSha256: {
      type: String,
      required: true
    },
    permissions: [permissionEntrySchema],
    version: {
      type: Number,
      default: 1
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound text index for search by title, description, category
documentSchema.index({ title: 'text', description: 'text', category: 'text' });

const Document = mongoose.model('Document', documentSchema);
module.exports = Document;

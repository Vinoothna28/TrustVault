require('dotenv').config();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Document = require('../models/Document');
const AuditLog = require('../models/AuditLog');
const connectDB = require('../config/db');
const { logAuditEvent } = require('../utils/auditLogger');
const { getStorageDir } = require('../middleware/uploadValidator');

/**
 * Helper to generate a minimal valid PDF buffer with proper %PDF-1.4 header
 */
const createDummyPdfBuffer = (title, content) => {
  const pdfHeader = '%PDF-1.4\n';
  const pdfBody = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n` +
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n` +
    `5 0 obj\n<< /Length 120 >>\nstream\nBT\n/F1 14 Tf\n50 700 Td\n(${title}) Tj\n0 -30 Td\n(${content}) Tj\nET\nendstream\nendobj\n`;
  const pdfXref = `xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \n0000000281 00000 n \n` +
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n450\n%%EOF\n`;

  return Buffer.from(pdfHeader + pdfBody + pdfXref, 'utf-8');
};

const seedDatabase = async () => {
  try {
    console.log('[TrustVault Seed] Connecting to database...');
    await connectDB();

    console.log('[TrustVault Seed] Clearing existing test data...');
    await User.deleteMany({});
    await Document.deleteMany({});
    // Delete audit log collection directly (bypassing Mongoose update/delete hooks)
    await AuditLog.collection.drop().catch(() => {});

    console.log('[TrustVault Seed] Creating standard three accounts...');

    // 1. Administrator
    const adminUser = new User({
      name: 'System Security Administrator',
      email: 'admin@trustvault.security',
      password: 'AdminPassword@2026!',
      role: 'admin',
      department: 'Security & Compliance'
    });
    await adminUser.save();

    // 2. Document Owner
    const ownerUser = new User({
      name: 'Elena Vance (General Counsel & Owner)',
      email: 'owner@trustvault.security',
      password: 'OwnerPassword@2026!',
      role: 'owner',
      department: 'Executive Legal'
    });
    await ownerUser.save();

    // 3. Document Viewer
    const viewerUser = new User({
      name: 'David Miller (Regulatory Auditor)',
      email: 'viewer@trustvault.security',
      password: 'ViewerPassword@2026!',
      role: 'viewer',
      department: 'External Audit'
    });
    await viewerUser.save();

    console.log('[TrustVault Seed] Users seeded successfully:');
    console.log(`  Admin : admin@trustvault.security / AdminPassword@2026!`);
    console.log(`  Owner : owner@trustvault.security / OwnerPassword@2026!`);
    console.log(`  Viewer: viewer@trustvault.security / ViewerPassword@2026!`);

    const storageDir = getStorageDir();

    // Create Sample Confidential Documents
    const seedDocsData = [
      {
        title: 'Executive Compensation & Bonus Schedule 2026',
        description: 'Highly confidential C-level executive compensation structure and retention bonuses.',
        category: 'Salary & HR',
        filename: 'Executive_Compensation_2026.pdf',
        contentSummary: 'CONFIDENTIAL: Restrict distribution. Board and Owner eyes only.',
        grantToViewer: null // Viewer has NO access. Trying to read should produce 403 Forbidden!
      },
      {
        title: 'Enterprise Vendor Master Services Agreement',
        description: 'Executed legal master services agreement with Cloud Infrastructure Provider.',
        category: 'Contracts',
        filename: 'Enterprise_MSA_Executed.pdf',
        contentSummary: 'Section 4: Audit Rights. Section 7: Data Protection & SLA Guarantees.',
        grantToViewer: 'read' // Viewer granted READ access
      },
      {
        title: 'TrustVault Core Security Architecture Blueprint',
        description: 'Complete architecture specifications, zero-trust token flows, and cryptographic chaining designs.',
        category: 'Technical Drawings',
        filename: 'TrustVault_Security_Architecture.pdf',
        contentSummary: 'Diagram 3.1: SHA-256 Audit Chaining & Merkle Integrity Model.',
        grantToViewer: 'edit' // Viewer granted EDIT access
      }
    ];

    console.log('[TrustVault Seed] Uploading sample documents and establishing cryptographic audit chain...');

    for (const item of seedDocsData) {
      const buffer = createDummyPdfBuffer(item.title, item.contentSummary);
      const storageKey = `${crypto.randomUUID()}.pdf`;
      const diskPath = path.join(storageDir, storageKey);
      fs.writeFileSync(diskPath, buffer);

      const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

      const permissions = [];
      if (item.grantToViewer) {
        permissions.push({
          user: viewerUser._id,
          permission: item.grantToViewer,
          grantedBy: ownerUser._id,
          grantedAt: new Date()
        });
      }

      const doc = new Document({
        title: item.title,
        description: item.description,
        category: item.category,
        owner: ownerUser._id,
        storageKey,
        originalFilename: item.filename,
        mimeType: 'application/pdf',
        sizeBytes: buffer.length,
        checksumSha256,
        permissions
      });

      await doc.save();

      // Log upload event
      await logAuditEvent({
        action: 'DOCUMENT_UPLOAD',
        outcome: 'SUCCESS',
        actor: {
          userId: ownerUser._id,
          email: ownerUser.email,
          role: ownerUser.role,
          ipAddress: '127.0.0.1',
          userAgent: 'TrustVault-Seed-Script/1.0'
        },
        document: {
          documentId: doc._id,
          title: doc.title,
          category: doc.category
        },
        details: `Seeded document '${item.filename}' (${buffer.length} bytes, SHA-256: ${checksumSha256.substring(0, 16)}...)`
      });

      // Log permission grant event if granted
      if (item.grantToViewer) {
        await logAuditEvent({
          action: 'PERMISSION_GRANTED',
          outcome: 'SUCCESS',
          actor: {
            userId: ownerUser._id,
            email: ownerUser.email,
            role: ownerUser.role,
            ipAddress: '127.0.0.1',
            userAgent: 'TrustVault-Seed-Script/1.0'
          },
          document: {
            documentId: doc._id,
            title: doc.title,
            category: doc.category
          },
          targetUser: {
            userId: viewerUser._id,
            email: viewerUser.email,
            grantedPermission: item.grantToViewer
          },
          details: `Initial setup: granted '${item.grantToViewer}' access to ${viewerUser.email}`
        });
      }
    }

    console.log('[TrustVault Seed] All documents and audit records seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error(`[TrustVault Seed ERROR] ${err.message}`);
    process.exit(1);
  }
};

seedDatabase();

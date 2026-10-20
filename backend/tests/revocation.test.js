const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Document = require('../src/models/Document');
const AuditLog = require('../src/models/AuditLog');
const { setupTestDB, createTestUser } = require('./setup');

setupTestDB();

describe('Immediate Permission Revocation Tests', () => {
  let owner, ownerToken;
  let viewer, viewerToken;
  let document;

  const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n');

  beforeEach(async () => {
    await User.deleteMany({});
    await Document.deleteMany({});
    await AuditLog.collection.drop().catch(() => {});

    // Create Owner
    const ownerData = await createTestUser({
      name: 'Legal Counsel',
      email: 'counsel@test.com',
      password: 'OwnerPassword123!',
      role: 'owner'
    });
    owner = ownerData.user;
    ownerToken = ownerData.token;

    // Create Viewer
    const viewerData = await createTestUser({
      name: 'Contractor Bob',
      email: 'bob.contractor@partner.com',
      password: 'BobPassword123!',
      role: 'viewer'
    });
    viewer = viewerData.user;
    viewerToken = viewerData.token;

    // Upload document
    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'Project Blueprints - Highly Confidential')
      .field('category', 'Technical Drawings')
      .attach('file', validPdfBuffer, 'blueprint.pdf');

    document = uploadRes.body.document;
  });

  it('SECURITY TEST: Taking access away works immediately on the next request', async () => {
    // Step 1: Owner grants read access to Contractor Bob
    const grantRes = await request(app)
      .post(`/api/documents/${document._id}/permissions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        targetUserId: viewer._id.toString(),
        permission: 'read'
      });

    expect(grantRes.statusCode).toBe(200);

    // Step 2: Contractor Bob can access the document
    const allowedDownload = await request(app)
      .get(`/api/documents/${document._id}/download`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(allowedDownload.statusCode).toBe(200);

    // Step 3: Owner revokes access immediately
    const revokeRes = await request(app)
      .delete(`/api/documents/${document._id}/permissions/${viewer._id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(revokeRes.statusCode).toBe(200);
    expect(revokeRes.body.message).toMatch(/revoked immediately/i);

    // Step 4: Bob immediately tries to download again using the same JWT token
    const blockedDownload = await request(app)
      .get(`/api/documents/${document._id}/download`)
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(blockedDownload.statusCode).toBe(403);
    expect(blockedDownload.body.message).toMatch(/Forbidden/i);

    // Step 5: Verify the audit trail captured the revocation and the subsequent denied download
    const logs = await AuditLog.find({
      'document.documentId': document._id
    }).sort({ sequenceNumber: 1 });

    const revokeLog = logs.find((l) => l.action === 'PERMISSION_REVOKED');
    const deniedLog = logs.find((l) => l.action === 'DOCUMENT_DOWNLOAD_DENIED');

    expect(revokeLog).toBeDefined();
    expect(revokeLog.targetUser.userId.toString()).toBe(viewer._id.toString());
    expect(deniedLog).toBeDefined();
    expect(deniedLog.actor.userId.toString()).toBe(viewer._id.toString());
    expect(deniedLog.sequenceNumber).toBeGreaterThan(revokeLog.sequenceNumber);
  });
});

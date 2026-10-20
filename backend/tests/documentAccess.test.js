const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const User = require('../src/models/User');
const Document = require('../src/models/Document');
const AuditLog = require('../src/models/AuditLog');
const { setupTestDB, createTestUser } = require('./setup');

setupTestDB();

describe('Document Access Control & Negative Authorization Tests', () => {
  let owner, ownerToken;
  let unauthorizedViewer, unauthorizedToken;
  let authorizedViewer, authorizedToken;
  let admin, adminToken;
  let testDocument;

  // Real minimal valid PDF buffer (%PDF-1.4 header)
  const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n');
  // Disguised executable buffer (MZ header of an EXE or bash script)
  const fakePdfBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00#!/bin/bash\nrm -rf /');

  beforeEach(async () => {
    await User.deleteMany({});
    await Document.deleteMany({});
    await AuditLog.collection.drop().catch(() => {});

    // Create Owner
    const ownerData = await createTestUser({
      name: 'Document Owner',
      email: 'owner@test.com',
      password: 'OwnerPassword123!',
      role: 'owner'
    });
    owner = ownerData.user;
    ownerToken = ownerData.token;

    // Create Unauthorized Viewer
    const unauthData = await createTestUser({
      name: 'Unauthorized Viewer',
      email: 'unauth@test.com',
      password: 'ViewerPassword123!',
      role: 'viewer'
    });
    unauthorizedViewer = unauthData.user;
    unauthorizedToken = unauthData.token;

    // Create Authorized Viewer (will be granted 'read')
    const authData = await createTestUser({
      name: 'Authorized Viewer',
      email: 'authorized@test.com',
      password: 'ViewerPassword123!',
      role: 'viewer'
    });
    authorizedViewer = authData.user;
    authorizedToken = authData.token;

    // Create System Admin
    const adminData = await createTestUser({
      name: 'System Admin',
      email: 'admin@test.com',
      password: 'AdminPassword123!',
      role: 'admin'
    });
    admin = adminData.user;
    adminToken = adminData.token;

    // Owner uploads a confidential document
    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'Confidential Quarterly Financials')
      .field('category', 'Financials')
      .field('description', 'Q3 earnings report')
      .attach('file', validPdfBuffer, 'Financials_Q3.pdf');

    expect(uploadRes.statusCode).toBe(201);
    testDocument = uploadRes.body.document;

    // Grant 'read' permission specifically to authorizedViewer
    await request(app)
      .post(`/api/documents/${testDocument._id}/permissions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        targetUserId: authorizedViewer._id.toString(),
        permission: 'read'
      });
  });

  it('Owner CAN view metadata and download their own document', async () => {
    const metaRes = await request(app)
      .get(`/api/documents/${testDocument._id}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(metaRes.statusCode).toBe(200);
    expect(metaRes.body.document.title).toBe('Confidential Quarterly Financials');

    const downloadRes = await request(app)
      .get(`/api/documents/${testDocument._id}/download`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(downloadRes.statusCode).toBe(200);
    expect(downloadRes.headers['content-type']).toMatch(/pdf/);
  });

  it('SECURITY TEST 1: Unauthorized viewer CANNOT view document metadata (IDOR protection)', async () => {
    const res = await request(app)
      .get(`/api/documents/${testDocument._id}`)
      .set('Authorization', `Bearer ${unauthorizedToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Forbidden/i);
  });

  it('SECURITY TEST 2: Unauthorized viewer CANNOT download document file directly', async () => {
    const res = await request(app)
      .get(`/api/documents/${testDocument._id}/download`)
      .set('Authorization', `Bearer ${unauthorizedToken}`);

    expect(res.statusCode).toBe(403);

    // Verify audit trail recorded this denied attempt
    const deniedLog = await AuditLog.findOne({
      action: 'DOCUMENT_DOWNLOAD_DENIED',
      outcome: 'DENIED',
      'actor.userId': unauthorizedViewer._id
    });

    expect(deniedLog).not.toBeNull();
    expect(deniedLog.document.documentId.toString()).toBe(testDocument._id.toString());
  });

  it('SECURITY TEST 3: User with read-only permission CANNOT edit or modify the document', async () => {
    const editRes = await request(app)
      .put(`/api/documents/${testDocument._id}`)
      .set('Authorization', `Bearer ${authorizedToken}`)
      .send({
        title: 'Tampered Title Attempt'
      });

    expect(editRes.statusCode).toBe(403);
    expect(editRes.body.message).toMatch(/Forbidden/i);

    // Verify original title was NOT changed in database
    const unmodifiedDoc = await Document.findById(testDocument._id);
    expect(unmodifiedDoc.title).toBe('Confidential Quarterly Financials');
  });

  it('SECURITY TEST 4: User with read-only permission CANNOT delete the document', async () => {
    const delRes = await request(app)
      .delete(`/api/documents/${testDocument._id}`)
      .set('Authorization', `Bearer ${authorizedToken}`);

    expect(delRes.statusCode).toBe(403);

    const doc = await Document.findById(testDocument._id);
    expect(doc.isDeleted).toBe(false);
  });

  it('SECURITY TEST 5: System Admin CANNOT view or download confidential document without permission (Separation of Duties)', async () => {
    // Admin attempts to view confidential document metadata
    const viewRes = await request(app)
      .get(`/api/documents/${testDocument._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(viewRes.statusCode).toBe(403);

    // Admin attempts to download confidential document
    const dlRes = await request(app)
      .get(`/api/documents/${testDocument._id}/download`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(dlRes.statusCode).toBe(403);
  });

  it('SECURITY TEST 6: Upload of executable masquerading as a PDF is rejected by magic byte validator', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${ownerToken}`)
      .field('title', 'Trojan Disguised as PDF')
      .field('category', 'Contracts')
      .attach('file', fakePdfBuffer, {
        filename: 'malicious.pdf',
        contentType: 'application/pdf'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/magic byte signature/i);
  });
});

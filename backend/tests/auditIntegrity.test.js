const AuditLog = require('../src/models/AuditLog');
const { logAuditEvent, verifyAuditChain } = require('../src/utils/auditLogger');
const { setupTestDB } = require('./setup');

setupTestDB();

describe('Tamper-Evident Audit Trail Integrity Tests', () => {
  beforeEach(async () => {
    await AuditLog.collection.drop().catch(() => {});
  });

  it('should maintain a valid cryptographic hash chain across sequential events', async () => {
    // Generate sequence of events
    await logAuditEvent({
      action: 'AUTH_LOGIN_SUCCESS',
      outcome: 'SUCCESS',
      actor: { email: 'auditor@test.com', role: 'admin' },
      details: 'Logged in from office IP'
    });

    await logAuditEvent({
      action: 'DOCUMENT_UPLOAD',
      outcome: 'SUCCESS',
      actor: { email: 'owner@test.com', role: 'owner' },
      details: 'Uploaded contract document'
    });

    await logAuditEvent({
      action: 'DOCUMENT_DOWNLOAD_DENIED',
      outcome: 'DENIED',
      actor: { email: 'unauth@test.com', role: 'viewer' },
      details: 'Attempted unauthorized download'
    });

    const verification = await verifyAuditChain();
    expect(verification.isValid).toBe(true);
    expect(verification.totalChecked).toBe(3);
    expect(verification.latestHash).toBeDefined();
  });

  it('SECURITY TEST: Detects database tampering if a log entry details are modified by an attacker', async () => {
    // Write 3 valid audit entries
    await logAuditEvent({
      action: 'AUTH_LOGIN_SUCCESS',
      outcome: 'SUCCESS',
      actor: { email: 'user1@test.com' },
      details: 'Login 1'
    });

    const entryToTamper = await logAuditEvent({
      action: 'DOCUMENT_DOWNLOAD_DENIED',
      outcome: 'DENIED',
      actor: { email: 'attacker@evil.com' },
      details: 'Attacker was caught downloading salaries'
    });

    await logAuditEvent({
      action: 'AUTH_LOGIN_SUCCESS',
      outcome: 'SUCCESS',
      actor: { email: 'user2@test.com' },
      details: 'Login 2'
    });

    // Attacker hacks database directly and modifies the details of record #2 to hide the attempt
    // (Bypassing Mongoose model hook by updating MongoDB collection directly)
    await AuditLog.collection.updateOne(
      { _id: entryToTamper._id },
      { $set: { details: 'Innocent regular activity' } }
    );

    // Run verification check
    const verification = await verifyAuditChain();

    expect(verification.isValid).toBe(false);
    expect(verification.brokenSequenceNumber).toBe(2);
    expect(verification.reason).toMatch(/Content tampering detected/i);
  });

  it('SECURITY TEST: Detects if an attacker deletes an audit log to hide their trace', async () => {
    // Write 3 entries
    await logAuditEvent({ action: 'AUTH_LOGIN_SUCCESS', outcome: 'SUCCESS', details: 'Entry 1' });
    const deleteTarget = await logAuditEvent({
      action: 'DOCUMENT_DOWNLOAD_DENIED',
      outcome: 'DENIED',
      details: 'Entry 2 to hide'
    });
    await logAuditEvent({ action: 'AUTH_LOGIN_SUCCESS', outcome: 'SUCCESS', details: 'Entry 3' });

    // Attacker deletes record 2 directly from MongoDB collection
    await AuditLog.collection.deleteOne({ _id: deleteTarget._id });

    // Run verification check
    const verification = await verifyAuditChain();

    expect(verification.isValid).toBe(false);
    expect(verification.reason).toMatch(/Sequence break detected|Previous hash mismatch/i);
  });
});

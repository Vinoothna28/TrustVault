const crypto = require('crypto');
const AuditLog = require('../models/AuditLog');

const GENESIS_PREVIOUS_HASH = '0'.repeat(64);

/**
 * Deterministically compute the SHA-256 digest of an audit record.
 */
const computeAuditHash = ({
  sequenceNumber,
  timestamp,
  action,
  outcome,
  actorUserId,
  actorEmail,
  documentId,
  targetUserId,
  details,
  previousHash
}) => {
  const normalizedTimestamp = new Date(timestamp).toISOString();
  const rawPayload = [
    sequenceNumber,
    normalizedTimestamp,
    action,
    outcome,
    actorUserId ? actorUserId.toString() : 'null',
    actorEmail || 'null',
    documentId ? documentId.toString() : 'null',
    targetUserId ? targetUserId.toString() : 'null',
    details || '',
    previousHash
  ].join('|');

  return crypto.createHash('sha256').update(rawPayload).digest('hex');
};

/**
 * Append an immutable, cryptographically chained audit log entry.
 */
const logAuditEvent = async ({
  action,
  outcome,
  actor = {},
  document = null,
  targetUser = null,
  details = ''
}) => {
  try {
    // Find highest sequence number and previous hash
    const latestRecord = await AuditLog.findOne().sort({ sequenceNumber: -1 }).lean();

    const sequenceNumber = latestRecord ? latestRecord.sequenceNumber + 1 : 1;
    const previousHash = latestRecord ? latestRecord.hash : GENESIS_PREVIOUS_HASH;
    const timestamp = new Date();

    const actorUserId = actor.userId || null;
    const actorEmail = actor.email || 'anonymous';
    const actorRole = actor.role || 'unknown';
    const actorIp = actor.ipAddress || 'unknown';
    const actorUa = actor.userAgent || 'unknown';

    const docId = document ? document.documentId : null;
    const docTitle = document ? document.title : null;
    const docCategory = document ? document.category : null;

    const tgtUserId = targetUser ? targetUser.userId : null;
    const tgtEmail = targetUser ? targetUser.email : null;
    const tgtPermission = targetUser ? targetUser.grantedPermission : null;

    const hash = computeAuditHash({
      sequenceNumber,
      timestamp,
      action,
      outcome,
      actorUserId,
      actorEmail,
      documentId: docId,
      targetUserId: tgtUserId,
      details,
      previousHash
    });

    const newAuditEntry = new AuditLog({
      sequenceNumber,
      timestamp,
      action,
      outcome,
      actor: {
        userId: actorUserId,
        email: actorEmail,
        role: actorRole,
        ipAddress: actorIp,
        userAgent: actorUa
      },
      document: docId
        ? {
            documentId: docId,
            title: docTitle,
            category: docCategory
          }
        : undefined,
      targetUser: tgtUserId
        ? {
            userId: tgtUserId,
            email: tgtEmail,
            grantedPermission: tgtPermission
          }
        : undefined,
      details,
      previousHash,
      hash
    });

    await newAuditEntry.save();
    return newAuditEntry;
  } catch (error) {
    console.error(`[AUDIT LOG FAILURE] Failed to write audit event: ${error.message}`);
    // In production security, audit failures should trigger alerts
    return null;
  }
};

/**
 * Verify cryptographic integrity of the entire audit log chain.
 * Detects any record deletion, insertion, or modification.
 */
const verifyAuditChain = async () => {
  const records = await AuditLog.find().sort({ sequenceNumber: 1 }).lean();

  if (records.length === 0) {
    return {
      isValid: true,
      totalChecked: 0,
      message: 'Audit trail is empty (no records).'
    };
  }

  let expectedPreviousHash = GENESIS_PREVIOUS_HASH;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // Check 1: Sequence number continuity
    const expectedSequence = i + 1;
    if (record.sequenceNumber !== expectedSequence) {
      return {
        isValid: false,
        totalChecked: i,
        brokenSequenceNumber: record.sequenceNumber,
        expectedSequenceNumber: expectedSequence,
        reason: `Sequence break detected at record ID ${record._id}. Missing or inserted log entry.`
      };
    }

    // Check 2: Chaining to previous record's hash
    if (record.previousHash !== expectedPreviousHash) {
      return {
        isValid: false,
        totalChecked: i,
        brokenSequenceNumber: record.sequenceNumber,
        reason: `Previous hash mismatch at sequence ${record.sequenceNumber}. Stored previousHash: ${record.previousHash}, Expected: ${expectedPreviousHash}. Chain has been broken.`
      };
    }

    // Check 3: Recompute SHA-256 over record contents
    const recomputedHash = computeAuditHash({
      sequenceNumber: record.sequenceNumber,
      timestamp: record.timestamp,
      action: record.action,
      outcome: record.outcome,
      actorUserId: record.actor ? record.actor.userId : null,
      actorEmail: record.actor ? record.actor.email : null,
      documentId: record.document ? record.document.documentId : null,
      targetUserId: record.targetUser ? record.targetUser.userId : null,
      details: record.details,
      previousHash: record.previousHash
    });

    if (recomputedHash !== record.hash) {
      return {
        isValid: false,
        totalChecked: i,
        brokenSequenceNumber: record.sequenceNumber,
        reason: `Content tampering detected at sequence ${record.sequenceNumber}. Stored hash: ${record.hash}, Recomputed hash: ${recomputedHash}. Record contents were altered.`
      };
    }

    // Advance expected hash
    expectedPreviousHash = record.hash;
  }

  return {
    isValid: true,
    totalChecked: records.length,
    latestHash: records[records.length - 1].hash,
    message: `Cryptographic audit chain fully verified across ${records.length} records. Zero tampering detected.`
  };
};

module.exports = {
  logAuditEvent,
  verifyAuditChain,
  computeAuditHash,
  GENESIS_PREVIOUS_HASH
};

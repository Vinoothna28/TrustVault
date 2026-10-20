const AuditLog = require('../models/AuditLog');
const Document = require('../models/Document');
const User = require('../models/User');
const { verifyAuditChain, logAuditEvent } = require('../utils/auditLogger');

/**
 * Get audit logs with filtering and pagination (Administrator Only)
 */
const getAuditLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      outcome,
      startDate,
      endDate,
      actorEmail,
      documentId
    } = req.query;

    const filter = {};

    if (action && action !== 'ALL') {
      filter.action = action;
    }

    if (outcome && outcome !== 'ALL') {
      filter.outcome = outcome;
    }

    if (actorEmail) {
      filter['actor.email'] = { $regex: actorEmail.trim(), $options: 'i' };
    }

    if (documentId && documentId.match(/^[0-9a-fA-F]{24}$/)) {
      filter['document.documentId'] = documentId;
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.timestamp.$lte = end;
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
    const skip = (pageNum - 1) * limitNum;

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ sequenceNumber: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      logs
    });
  } catch (error) {
    console.error(`[getAuditLogs ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit trail records.'
    });
  }
};

/**
 * Verify cryptographic hash chain integrity of the audit log (Administrator Only)
 */
const checkIntegrity = async (req, res) => {
  try {
    const verification = await verifyAuditChain();

    // Log the verification execution
    await logAuditEvent({
      action: 'INTEGRITY_VERIFICATION_CHECK',
      outcome: verification.isValid ? 'SUCCESS' : 'DENIED',
      actor: {
        userId: req.user._id,
        email: req.user.email,
        role: req.user.role,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      },
      details: `Audit chain integrity verification performed: ${verification.isValid ? 'PASSED' : 'FAILED'}. Records checked: ${verification.totalChecked}.`
    });

    return res.status(200).json({
      success: true,
      verification
    });
  } catch (error) {
    console.error(`[checkIntegrity ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Cryptographic chain verification execution failed.'
    });
  }
};

/**
 * Get dashboard security metrics and summary (Administrator Only)
 */
const getSecurityStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalDocuments,
      totalAuditEntries,
      deniedAttempts,
      recentDenied
    ] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Document.countDocuments({ isDeleted: false }),
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ outcome: 'DENIED' }),
      AuditLog.find({ outcome: 'DENIED' })
        .sort({ sequenceNumber: -1 })
        .limit(5)
        .lean()
    ]);

    // Aggregate actions by category
    const actionCounts = await AuditLog.aggregate([
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalDocuments,
        totalAuditEntries,
        deniedAttempts,
        actionCounts,
        recentDenied
      }
    });
  } catch (error) {
    console.error(`[getSecurityStats ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to aggregate security statistics.'
    });
  }
};

module.exports = {
  getAuditLogs,
  checkIntegrity,
  getSecurityStats
};

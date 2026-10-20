const express = require('express');
const {
  getAuditLogs,
  checkIntegrity,
  getSecurityStats
} = require('../controllers/auditController');
const { authenticateToken, requireRoles } = require('../middleware/auth');

const router = express.Router();

// All audit routes strictly require 'admin' role
router.use(authenticateToken, requireRoles('admin'));

router.get('/', getAuditLogs);
router.get('/verify', checkIntegrity);
router.get('/stats', getSecurityStats);

module.exports = router;

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication Middleware:
 * Verifies JWT token in Authorization header and attaches authenticated user to req.user.
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No Bearer token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'trustvault_dev_fallback_secret_key_2026';

    const decoded = jwt.verify(token, secret);

    // Retrieve active user from database
    const user = await User.findById(decoded.id).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account associated with this token no longer exists.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This user account has been deactivated.'
      });
    }

    // Attach user to request (omit password hash)
    req.user = user.toJSON();
    req.user._id = user._id; // keep ObjectId intact for DB comparisons
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication session expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token.'
    });
  }
};

/**
 * Role-Based Access Control Middleware:
 * Restricts endpoint to specified system roles.
 */
const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Action requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: '${req.user.role}'.`
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRoles
};

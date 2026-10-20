const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logAuditEvent } = require('../utils/auditLogger');

/**
 * Generate signed JWT token
 */
const generateToken = (user) => {
  const secret = process.env.JWT_SECRET || 'trustvault_dev_fallback_secret_key_2026';
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role
    },
    secret,
    { expiresIn }
  );
};

/**
 * Register a new user account
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    // Role assignment rules: only allow 'owner' or 'viewer' on public registration.
    // 'admin' role cannot be self-assigned on public register endpoint.
    let assignedRole = 'viewer';
    if (role === 'owner') {
      assignedRole = 'owner';
    } else if (role === 'viewer') {
      assignedRole = 'viewer';
    }

    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role: assignedRole,
      department: department || 'General'
    });

    await user.save();

    await logAuditEvent({
      action: 'AUTH_REGISTER_SUCCESS',
      outcome: 'SUCCESS',
      actor: {
        userId: user._id,
        email: user.email,
        role: user.role,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      },
      details: `User registered with role '${user.role}' in department '${user.department}'`
    });

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error(`[Register ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error during registration.'
    });
  }
};

/**
 * Login user with email and password
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      // Audit log failed login attempt
      await logAuditEvent({
        action: 'AUTH_LOGIN_FAILED',
        outcome: 'DENIED',
        actor: {
          userId: user ? user._id : null,
          email: email.toLowerCase(),
          role: user ? user.role : 'unknown',
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent')
        },
        details: 'Invalid credentials supplied'
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated.'
      });
    }

    const token = generateToken(user);

    await logAuditEvent({
      action: 'AUTH_LOGIN_SUCCESS',
      outcome: 'SUCCESS',
      actor: {
        userId: user._id,
        email: user.email,
        role: user.role,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      },
      details: `Successful login as '${user.role}'`
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: user.toJSON()
    });
  } catch (error) {
    console.error(`[Login ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.'
    });
  }
};

/**
 * Get profile of currently authenticated user
 */
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
};

/**
 * List all active users (for permission granting dropdowns)
 */
const listUsers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true })
      .select('name email role department')
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error(`[listUsers ERROR] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve user directory.'
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  listUsers
};

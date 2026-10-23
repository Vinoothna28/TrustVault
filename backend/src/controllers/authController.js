
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function normalizeEmail(email) {
  return typeof email === 'string'
    ? email.trim().toLowerCase()
    : '';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createAuthToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    department: user.department,
    role: user.role,
    isActive: user.isActive
  };
}

// Register a new account without email verification.
exports.register = async (req, res) => {
  try {
    const name = typeof req.body.name === 'string'
      ? req.body.name.trim()
      : '';

    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    const department = typeof req.body.department === 'string'
      ? req.body.department.trim()
      : 'General';

    if (!name || !email || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid email address.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }

    if (name.length > 100 || department.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name or department is too long.'
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists. Please sign in.'
      });
    }

    const user = new User({
      name,
      email,
      password,
      department: department || 'General',
      role: 'viewer',
      isActive: true
    });

    await user.save();

    const authToken = createAuthToken(user);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token: authToken,
      user: publicUser(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    console.error('[Auth] Registration failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Registration failed.'
    });
  }
};

// Sign in without email verification.
exports.login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!email || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account is disabled. Contact your administrator.'
      });
    }

    const authToken = createAuthToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token: authToken,
      user: publicUser(user)
    });
  } catch (error) {
    console.error('[Auth] Login failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Login failed.'
    });
  }
};

// Return the current authenticated user's profile.
exports.getMe = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication context.'
      });
    }

    const user = await User.findById(userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account unavailable. Please sign in again.'
      });
    }

    return res.status(200).json({
      success: true,
      user: publicUser(user)
    });
  } catch (error) {
    console.error('[Auth] Current-user lookup failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve account details.'
    });
  }
};

// List users for active administrators only.
exports.listUsers = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.user?._id;
    const requester = userId
      ? await User.findById(userId)
      : null;

    if (
      !requester ||
      !requester.isActive ||
      requester.role !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Administrator access is required.'
      });
    }

    const users = await User.find({})
      .select('name email department role isActive createdAt')
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('[Auth] User listing failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve users.'
    });
  }
};

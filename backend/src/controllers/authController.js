
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendVerificationEmail } = require('../utils/email');

const COMPANY_DOMAIN = 'snovasys.com';
const TOKEN_EXPIRY_MS = 30 * 60 * 1000;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isCompanyEmail(email) {
  const parts = email.split('@');
  return parts.length === 2 &&
    parts[0].length > 0 &&
    parts[1] === COMPANY_DOMAIN;
}

function createVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  return { token, tokenHash };
}

function createAuthToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    { id: user._id.toString(), role: user.role },
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
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified
  };
}

exports.register = async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    const department =
      typeof req.body.department === 'string'
        ? req.body.department.trim()
        : 'General';

    if (!name || !email || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Name, company email, and password are required.'
      });
    }

    if (!isCompanyEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Registration is restricted to @snovasys.com email addresses.'
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
        message: 'An account with this email already exists. Try signing in or requesting verification again.'
      });
    }

    const { token, tokenHash } = createVerificationToken();

    // Public registration always creates a viewer.
    // Never accept an admin/owner role from req.body.
    const user = new User({
      name,
      email,
      password,
      department: department || 'General',
      role: 'viewer',
      isActive: true,
      isEmailVerified: false,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: new Date(Date.now() + TOKEN_EXPIRY_MS)
    });

    await user.save();

    try {
      await sendVerificationEmail(email, token);
    } catch (emailError) {
      // Keep the account unverified. The user can request a new email.
      console.error('[Auth] Verification email could not be sent:', emailError.message);

      return res.status(503).json({
        success: false,
        message: 'Your account was created but the verification email could not be sent. Please request a new verification email later.'
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Account created. Check your Snovasys email for the verification link.',
      email: email
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

exports.verifyEmail = async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);
    const token = req.query.token;

    if (!isCompanyEmail(email) ||
        typeof token !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or incomplete verification link.'
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      email,
      isEmailVerified: false,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpires: { $gt: new Date() }
    }).select('+emailVerificationTokenHash +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This verification link is invalid, expired, or already used. Request a new link.'
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now sign in.'
    });
  } catch (error) {
    console.error('[Auth] Email verification failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Email verification failed.'
    });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!isCompanyEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Enter your registered Snovasys company email.'
      });
    }

    const user = await User.findOne({ email })
      .select('+emailVerificationTokenHash +emailVerificationExpires');

    // Use a generic response so the endpoint does not reveal account existence.
    const genericResponse = {
      success: true,
      message: 'If an unverified account exists, a verification email will be sent.'
    };

    if (!user || user.isEmailVerified || !user.isActive) {
      return res.status(200).json(genericResponse);
    }

    const { token, tokenHash } = createVerificationToken();

    user.emailVerificationTokenHash = tokenHash;
    user.emailVerificationExpires = new Date(Date.now() + TOKEN_EXPIRY_MS);
    await user.save();

    try {
      await sendVerificationEmail(email, token);
    } catch (emailError) {
      console.error('[Auth] Resend email failed:', emailError.message);
      return res.status(503).json({
        success: false,
        message: 'Unable to send the verification email right now. Please try again later.'
      });
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error('[Auth] Resend verification failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to process the request.'
    });
  }
};

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

    if (!isCompanyEmail(email)) {
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

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Verify your Snovasys email before signing in.'
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

    if (!user || !user.isActive || !user.isEmailVerified) {
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

exports.listUsers = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId || req.user?._id;
    const requester = userId ? await User.findById(userId) : null;

    if (!requester || !requester.isActive ||
        !requester.isEmailVerified || requester.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Administrator access is required.'
      });
    }

    const users = await User.find({})
      .select('name email department role isActive isEmailVerified createdAt')
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

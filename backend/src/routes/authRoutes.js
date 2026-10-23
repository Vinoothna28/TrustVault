
const express = require('express');
const rateLimit = require('express-rate-limit');

const {
  register,
  login,
  getMe,
  listUsers
} = require('../controllers/authController');

const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.'
  }
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration attempts. Please try again later.'
  }
});

router.post('/register', registrationLimiter, register);
router.post('/login', loginLimiter, login);
router.get('/me', authenticateToken, getMe);
router.get('/users', authenticateToken, listUsers);

module.exports = router;

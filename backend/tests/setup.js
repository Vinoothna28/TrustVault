const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Document = require('../src/models/Document');
const AuditLog = require('../src/models/AuditLog');

const setupTestDB = () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = 'test_secret_key_trustvault_automated_testing_2026';
    process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trustvault_test';
    await connectDB();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });
};

const createTestUser = async ({ name, email, password, role = 'viewer', department = 'General' }) => {
  const user = new User({
    name,
    email: email.toLowerCase(),
    password,
    role,
    department
  });
  await user.save();
  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'test_secret_key_trustvault_automated_testing_2026',
    { expiresIn: '1h' }
  );
  return { user, token };
};

module.exports = {
  setupTestDB,
  createTestUser
};

const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const { setupTestDB } = require('./setup');

setupTestDB();

describe('Authentication & Role Security Tests', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await AuditLog.collection.drop().catch(() => {});
  });

  it('should successfully register a new user with default role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Employee',
        email: 'alice@company.com',
        password: 'Password123!',
        department: 'Operations'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('viewer');
    expect(res.body.user.password).toBeUndefined();
  });

  it('SECURITY: should prevent self-escalation to admin on public registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Attacker Malicious',
        email: 'attacker@evil.com',
        password: 'AttackerPassword123!',
        role: 'admin' // Attempt privilege escalation
      });

    expect(res.statusCode).toBe(201);
    // Role must be clamped to viewer, NOT admin
    expect(res.body.user.role).toBe('viewer');

    const dbUser = await User.findOne({ email: 'attacker@evil.com' });
    expect(dbUser.role).toBe('viewer');
  });

  it('should reject registration with duplicate email address', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User One',
        email: 'duplicate@test.com',
        password: 'Password123!'
      });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'User Two',
        email: 'duplicate@test.com',
        password: 'Password123!'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it('should record an audit event when login fails due to bad credentials', async () => {
    // Register valid user first
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Target User',
        email: 'target@test.com',
        password: 'CorrectPassword123!'
      });

    // Attempt login with wrong password
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'target@test.com',
        password: 'WRONG_PASSWORD!'
      });

    expect(res.statusCode).toBe(401);

    // Verify audit log has recorded the failed login attempt
    const failedLog = await AuditLog.findOne({
      action: 'AUTH_LOGIN_FAILED',
      outcome: 'DENIED'
    });

    expect(failedLog).not.toBeNull();
    expect(failedLog.actor.email).toBe('target@test.com');
  });
});

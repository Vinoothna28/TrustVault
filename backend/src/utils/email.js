
const nodemailer = require('nodemailer');

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error('Email service is not configured');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

async function sendVerificationEmail(email, token) {
  const baseUrl = process.env.API_BASE_URL;

  if (!baseUrl) {
    throw new Error('API_BASE_URL is not configured');
  }

  const verificationUrl = new URL('/api/auth/verify-email', baseUrl);
  verificationUrl.searchParams.set('token', token);
  verificationUrl.searchParams.set('email', email);

  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Verify your TrustVault company email',
    text: [
      'Verify your email to activate your TrustVault account.',
      '',
      `Open this link: ${verificationUrl.toString()}`,
      '',
      'This link expires in 30 minutes and can only be used once.',
      'If you did not request this account, you can ignore this email.'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2>Verify your company email</h2>
        <p>Confirm your Snovasys email address to activate your TrustVault account.</p>
        <p>
          <a href="${verificationUrl.toString()}"
             style="display:inline-block;padding:12px 18px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px">
            Verify email
          </a>
        </p>
        <p>This link expires in 30 minutes and can only be used once.</p>
        <p>If you did not request this account, ignore this email.</p>
      </div>
    `
  });
}

module.exports = { sendVerificationEmail };

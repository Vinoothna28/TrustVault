
const nodemailer = require('nodemailer');

function createTransporter() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      'Email service is not configured. Check SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in Render.'
    );
  }

  const port = Number(SMTP_PORT);

  if (![465, 587].includes(port)) {
    throw new Error('SMTP_PORT must be 465 or 587.');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });
}

async function sendVerificationEmail(email, token) {
  const baseUrl = process.env.API_BASE_URL;
  const sender = process.env.EMAIL_FROM;

  if (!baseUrl) {
    throw new Error('API_BASE_URL is not configured in Render.');
  }

  if (!sender) {
    throw new Error('EMAIL_FROM is not configured in Render.');
  }

  const verificationUrl = new URL(
    '/api/auth/verify-email',
    baseUrl
  );

  verificationUrl.searchParams.set('token', token);
  verificationUrl.searchParams.set('email', email);

  const transporter = createTransporter();

  try {
    console.log('[Email] Checking SMTP connection...');

    await transporter.verify();

    console.log('[Email] SMTP connection and authentication succeeded.');

    const result = await transporter.sendMail({
      from: {
        name: 'TrustVault',
        address: sender
      },
      to: email,
      subject: 'Verify your TrustVault email',
      text: [
        'Verify your email to activate your TrustVault account.',
        '',
        `Open this link: ${verificationUrl.toString()}`,
        '',
        'This link expires in 30 minutes and can only be used once.',
        'If you did not request this account, ignore this email.'
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
          <h2>Verify your TrustVault email</h2>
          <p>Confirm your email address to activate your TrustVault account.</p>
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

    console.log('[Email] Verification email accepted by SMTP server.', {
      messageId: result.messageId,
      acceptedCount: result.accepted.length,
      rejectedCount: result.rejected.length
    });

    if (result.accepted.length === 0) {
      throw new Error('SMTP server did not accept the recipient.');
    }

    return result;
  } catch (error) {
    console.error('[Email] Verification email failed.', {
      message: error.message,
      code: error.code || null,
      command: error.command || null,
      responseCode: error.responseCode || null,
      response: error.response || null
    });

    throw error;
  } finally {
    transporter.close();
  }
}

module.exports = { sendVerificationEmail };

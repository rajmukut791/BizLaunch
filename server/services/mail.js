const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const deliveries = new Map();
const isTest = () =>
  process.env.NODE_ENV === 'test' && /^bizlaunch_(test|e2e)_/.test(mongoose.connection.name || '');
const available = () =>
  isTest() || Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.MAIL_FROM);
async function sendLink(user, purpose, token) {
  const url = new URL(
    '/' + (purpose === 'verification' ? 'verify-email' : 'reset-password'),
    process.env.CLIENT_URL,
  );
  url.searchParams.set('token', token);
  const subject =
    purpose === 'verification' ? 'Verify your BizLaunch email' : 'Reset your BizLaunch password';
  if (isTest()) {
    deliveries.set(user.email, { purpose, token, url: url.href });
    return;
  }
  if (!available()) throw new Error('Email delivery is unavailable');
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD.replace(/\s/g, '') },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to: user.email,
    subject,
    text:
      subject +
      '\n\n' +
      url.href +
      '\n\nExpires in ' +
      (purpose === 'verification' ? '24 hours' : '30 minutes') +
      '. Ignore this email if you did not request it.',
  });
}
module.exports = {
  available,
  sendLink,
  isTest,
  testDelivery: (address) => (isTest() ? deliveries.get(address) : undefined),
};

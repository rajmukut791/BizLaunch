const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
function accountEmail(user, purpose, url) {
  const verification = purpose === 'verification';
  const seller = user.role === 'seller';
  const subject = verification
    ? 'Welcome to BizLaunch — verify your email'
    : 'Your secure BizLaunch password reset';
  const title = verification
    ? 'One small step.<br>A world of possibility.'
    : 'Let’s get you<br>back to business.';
  const introduction = verification
    ? seller
      ? 'Your ideas deserve a place to grow. Confirm your email to start building your store, meet your customers and bring your business to life.'
      : user.role === 'admin'
        ? 'Your workspace is almost ready. Confirm your email to securely access your BizLaunch administration tools.'
        : 'Great finds and independent brands are waiting for you. Confirm your email to start exploring, discover your next favorite and follow your orders with confidence.'
    : 'We received a request to reset your password. Use the secure button below to choose a new one and return to your workspace.';
  const action = verification ? 'Verify my email' : 'Reset my password';
  const expiry = verification ? '24 hours' : '30 minutes';
  const greeting = 'Hi ' + (user.name || 'there') + ',';
  const next = verification
    ? seller
      ? 'Verify your email → Sign in → Create your business'
      : user.role === 'admin'
        ? 'Verify your email → Sign in → Open your workspace'
        : 'Verify your email → Sign in → Discover your next favorite'
    : 'Choose a new password → Sign in securely';
  const safeUrl = escapeHtml(url);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f7f5;font-family:Arial,Helvetica,sans-serif;color:#203c34;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(introduction)} This link expires in ${expiry}.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f7f5;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;"><tr><td style="padding:0 8px 22px;font-size:24px;font-weight:800;color:#087f6b;">↗ BizLaunch<span style="color:#203c34;">.</span></td></tr>
<tr><td style="background:#fff;border:1px solid #dce9e2;border-radius:24px;overflow:hidden;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td style="padding:36px 28px;background:#e4f5ee;background-image:linear-gradient(130deg,#d9f5e9,#e9f1ff);border-radius:24px 24px 0 0;">
<span style="font-size:11px;font-weight:700;letter-spacing:1.8px;color:#087f6b;">${verification ? 'WELCOME TO YOUR NEXT CHAPTER' : 'YOUR ACCOUNT, PROTECTED'}</span>
<h1 style="font-size:34px;line-height:1.16;letter-spacing:-1px;margin:20px 0 12px;color:#153f34;">${title}</h1>
<p style="font-size:14px;line-height:1.6;margin:0;color:#41665a;">${verification ? 'Built for independent brands. Made for you.' : 'A fresh start, with security at every step.'}</p>
</td></tr>
<tr><td style="padding:30px 28px;">
<p style="margin:0 0 14px;font-size:17px;font-weight:700;">${escapeHtml(greeting)}</p>
<p style="margin:0 0 26px;font-size:15px;line-height:1.8;color:#557067;">${escapeHtml(introduction)}</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#087f6b" style="border-radius:12px;"><a href="${safeUrl}" style="display:inline-block;padding:17px 28px;border:1px solid #087f6b;border-radius:12px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;">${action} &nbsp; ↗</a></td></tr></table>
<p style="font-size:12px;color:#73897f;margin:15px 0 26px;">Secure, single-use link · Expires in ${expiry}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5faf7;border:1px solid #e1eee6;border-radius:14px;"><tr><td style="padding:18px;"><p style="font-size:11px;font-weight:700;letter-spacing:1px;color:#087f6b;margin:0 0 10px;">WHAT HAPPENS NEXT</p><p style="font-size:13px;line-height:1.8;color:#3c6154;margin:0;">${escapeHtml(next)}</p></td></tr></table>
<p style="font-size:12px;line-height:1.8;color:#73897f;margin:24px 0 8px;">Button not opening? Copy this link into your browser:</p>
<p style="font-size:12px;line-height:1.7;word-break:break-all;margin:0;"><a href="${safeUrl}" style="color:#087f6b;word-break:break-all;">${safeUrl}</a></p>
<hr style="border:0;border-top:1px solid #e9f0eb;margin:26px 0 18px;">
<p style="font-size:12px;line-height:1.8;color:#73897f;margin:0;">If you didn’t request this email, you can safely ignore it. Keep this link private. BizLaunch will never ask you to share your password by email.</p>
</td></tr></table></td></tr>
<tr><td align="center" style="padding:24px 12px;color:#81958c;font-size:12px;line-height:1.8;">Your ambition. Your community. Your BizLaunch.<br>Sent securely by BizLaunch.</td></tr>
</table></td></tr></table></body></html>`;
  return {
    subject,
    html,
    text:
      greeting +
      '\n\n' +
      introduction +
      '\n\n' +
      action +
      ': ' +
      url +
      '\n\nThis single-use link expires in ' +
      expiry +
      '.\n\n' +
      next +
      '\n\nIf you did not request this email, ignore it. Keep this link private. BizLaunch will never ask you to share your password by email.',
  };
}
module.exports = { accountEmail };

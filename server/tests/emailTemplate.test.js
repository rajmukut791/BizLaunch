const { test } = require('node:test');
const assert = require('node:assert/strict');
const { accountEmail } = require('../services/emailTemplate');
test('verification emails escape user content and include an accessible plain-text link', () => {
  const url = 'https://bizlaunch.example/verify-email?token=example&source=mail';
  const message = accountEmail(
    { name: '<img src=x onerror=alert(1)>', role: 'seller', password: 'never-include-this' },
    'verification',
    url,
  );
  assert.ok(message.html.includes('&lt;img'));
  assert.ok(!message.html.includes('<img'));
  assert.ok(!JSON.stringify(message).includes('never-include-this'));
  assert.ok(message.html.includes('token=example&amp;source=mail'));
  assert.ok(message.text.includes(url));
  assert.ok(message.html.includes('Verify my email'));
  assert.ok(message.text.includes('24 hours'));
});
test('seller, customer and password reset messages provide appropriate next steps', () => {
  const url = 'https://bizlaunch.example/verification';
  const seller = accountEmail({ name: 'Seller', role: 'seller' }, 'verification', url);
  const customer = accountEmail({ name: 'Customer', role: 'customer' }, 'verification', url);
  const reset = accountEmail({ name: 'Customer', role: 'customer' }, 'reset', url);
  assert.ok(seller.text.includes('Create your business'));
  assert.ok(customer.text.includes('Discover your next favorite'));
  assert.ok(reset.text.includes('30 minutes'));
  assert.ok(reset.html.includes('Reset my password'));
  assert.ok(!reset.html.includes('Verify my email'));
});

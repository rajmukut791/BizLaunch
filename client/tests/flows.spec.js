import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const screenshots = '../artifacts';
async function login(page, role) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(role + '@bizlaunch.demo');
  await page.getByLabel('Password', { exact: true }).fill('BizLaunch123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(
    role === 'seller' ? /\/seller$/ : role === 'admin' ? /\/admin$/ : /\/dashboard$/,
  );
  await expect(page.locator('.loading')).toHaveCount(0, { timeout: 15000 });
}
test('desktop marketplace, product discovery, search, filter and storefront', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Discover good things/ })).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(12);
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: screenshots + '/home-desktop.png', fullPage: true });
  await page.goto('/marketplace');
  await page.getByLabel('Search products').fill('Canvas');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(2);
  await page.getByRole('link', { name: /Everyday Canvas Tote/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Everyday Canvas Tote', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: /By The Everyday Studio/ }).click();
  await expect(
    page.getByRole('heading', { name: 'The Everyday Studio', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(12);
  expect(errors).toEqual([]);
});
test('mobile marketplace and premium login layout fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: screenshots + '/home-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(
    page.getByRole('navigation').getByRole('link', { name: 'Marketplace', exact: true }),
  ).toBeVisible();
  await page.goto('/login');
  await expect(page.getByLabel('Email address')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: screenshots + '/login-mobile.png', fullPage: true });
});
test('customer registration, coupon confirmation, checkout, tracking and cancellation', async ({
  page,
}) => {
  await page.goto('/register');
  await page.getByLabel('Full name', { exact: true }).fill('Browser Customer');
  await page.getByLabel('Email address').fill('browser-customer@test.example');
  await page.getByLabel('Password', { exact: true }).fill('BrowserSecret123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('BrowserSecret123!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/verify-email/);
  const delivery = await (
    await page.request.get('/api/auth/test-delivery?email=browser-customer@test.example')
  ).json();
  await page.goto('/verify-email?token=' + delivery.token);
  await page.getByRole('button', { name: 'Verify my email' }).click();
  await expect(page.getByText('Your email is verified. You can now sign in.')).toBeVisible();
  await page.goto('/login');
  await page.getByLabel('Email address').fill('browser-customer@test.example');
  await page.getByLabel('Password', { exact: true }).fill('BrowserSecret123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/marketplace');
  await page.getByRole('link', { name: /Everyday Canvas Tote/ }).click();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.goto('/cart');
  await expect(page.getByText('Everyday Canvas Tote', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Continue to checkout/ }).click();
  await page.getByLabel('Phone', { exact: true }).fill('01712345678');
  await page.getByLabel('Street address').fill('House 10, Browser Test Road');
  await page.getByLabel('City', { exact: true }).fill('Dhaka');
  await page.getByLabel('Coupon code (optional)').fill('LAUNCH10');
  await page.getByRole('button', { name: 'Review order total' }).click();
  await expect(page.getByText('Confirmed total', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Confirm order/ }).click();
  await expect(page).toHaveURL(/\/orders\/[a-f0-9]+$/);
  await expect(page.getByText('placed', { exact: true }).first()).toBeVisible();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancel these items' }).click();
  await expect(page.locator('.badge.cancelled')).toBeVisible();
  await page.goto('/notifications');
  await expect(page.getByText('Order placed', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark all read' }).click();
  await expect(page.locator('.notification.unread')).toHaveCount(0);
});
test('seller can create products, upload images and manage the workspace', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await login(page, 'seller');
  await expect(page.getByRole('heading', { name: 'Hello, Ayesha.' })).toBeVisible();
  await page.screenshot({ path: screenshots + '/seller-dashboard.png', fullPage: true });
  await page.goto('/seller/products');
  await page.getByRole('button', { name: 'New product' }).click();
  await page.getByLabel('Product name', { exact: true }).fill('Browser Test Product');
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Home & living' });
  await page
    .getByLabel('Description', { exact: true })
    .fill('A product created through the browser test.');
  await page.getByLabel('Selling price (BDT)').fill('850');
  await page.getByLabel('Unit cost (BDT)').fill('350');
  await page.getByLabel('Stock', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Create product', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'Browser Test Product' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Images (0)', exact: true }).click();
  await row.getByLabel('PNG, JPEG or WebP · up to 5 MB').setInputFiles({
    name: 'test.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jV9sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await row.getByRole('button', { name: 'Upload image', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Images (1)', exact: true })).toBeVisible();
  for (const [path, heading] of [
    ['business', 'My business'],
    ['inventory', 'Inventory'],
    ['orders', 'Orders'],
    ['expenses', 'Expenses'],
    ['analytics', 'Analytics & business health'],
    ['coupons', 'Coupons'],
    ['reports', 'Business reports'],
  ]) {
    await page.goto('/seller/' + path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.locator('.loading')).toHaveCount(0);
    await expect(page.getByText('Unable to load', { exact: true })).toHaveCount(0);
  }
});
test('seller expense, coupon and report export work through real forms', async ({ page }) => {
  await login(page, 'seller');
  await page.goto('/seller/expenses');
  await page.getByLabel('Title', { exact: true }).fill('Browser marketing expense');
  await page.getByLabel('Amount (BDT)').fill('120');
  await page.getByRole('button', { name: 'Record expense', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'Browser marketing expense', exact: true }),
  ).toBeVisible();
  await page.goto('/seller/coupons');
  await page.getByLabel('Code', { exact: true }).fill('BROWSER15');
  await page.getByLabel('Discount (%)').fill('15');
  await page.getByLabel('Expires at').fill('2027-12-31T23:59');
  await page.getByRole('button', { name: 'Create coupon', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'BROWSER15', exact: true })).toBeVisible();
  await page.goto('/seller/reports');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('bizlaunch-report.json');
});
test('admin dashboard, category management, verification, users and reports load', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'admin');
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();
  await page.goto('/admin/categories');
  const form = page.locator('form').first();
  await form.getByLabel('Name', { exact: true }).fill('Browser Category');
  await form.getByLabel('Description', { exact: true }).fill('A browser created category');
  await form.getByRole('button', { name: 'Add category', exact: true }).click();
  await expect(page.locator('input[value="Browser Category"]')).toBeVisible();
  for (const [path, heading] of [
    ['businesses', 'Business verification'],
    ['users', 'Users'],
    ['orders', 'Orders'],
    ['reports', 'Customer reports'],
  ]) {
    await page.goto('/admin/' + path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.locator('.loading')).toHaveCount(0);
    await expect(page.getByText('Unable to load', { exact: true })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('forgot password emails a link and reset restores access', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.getByLabel('Email address').fill('browser-customer@test.example');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(
    page.getByText('If an eligible account exists, a password reset link has been sent.'),
  ).toBeVisible();
  const delivery = await (
    await page.request.get('/api/auth/test-delivery?email=browser-customer@test.example')
  ).json();
  await page.goto('/reset-password?token=' + delivery.token);
  await page.getByLabel('New password', { exact: true }).fill('UpdatedBrowser123!');
  await page.getByLabel('Confirm password').fill('UpdatedBrowser123!');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByText('Password updated. Sign in with your new password.')).toBeVisible();
  await page.goto('/login');
  await page.getByLabel('Email address').fill('browser-customer@test.example');
  await page.getByLabel('Password', { exact: true }).fill('UpdatedBrowser123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('admin maintenance studio previews, pauses and reopens the marketplace', async ({
  page,
  browser,
}) => {
  await login(page, 'admin');
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: screenshots + '/admin-premium-dashboard.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto('/admin/maintenance');
  await expect(
    page.getByRole('heading', { name: 'Maintenance studio', exact: true }),
  ).toBeVisible();
  const headline = 'A little care. A better BizLaunch.';
  await page.getByLabel('Maintenance headline').fill(headline);
  await page
    .getByLabel('Message for customers & sellers')
    .fill(
      'We are making a few thoughtful improvements. Your account and orders are safe. Please check back shortly.',
    );
  await page.getByRole('button', { name: 'Preview your message' }).click();
  await expect(
    page.locator('.maintenance-preview').getByRole('heading', { name: headline }),
  ).toBeVisible();
  await page.screenshot({
    path: screenshots + '/admin-maintenance-studio.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByLabel('Marketplace mode').selectOption('true');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Save maintenance settings' }).click();
  await expect(page.locator('.maintenance-control .badge')).toHaveText('Online');
  await expect(page.getByText('Maintenance settings saved', { exact: true })).toHaveCount(0);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Save maintenance settings' }).click();
  await expect(page.locator('.maintenance-control .badge')).toHaveText('Maintenance');
  const visitorContext = await browser.newContext({
    baseURL: 'http://localhost:5174',
    viewport: { width: 1440, height: 1000 },
  });
  const visitor = await visitorContext.newPage();
  try {
    await visitor.goto('/');
    await expect(visitor.getByRole('heading', { name: headline })).toBeVisible();
    await visitor.screenshot({
      path: screenshots + '/maintenance-public-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });
    expect((await visitor.request.get('/api/products')).status()).toBe(503);
    await visitor.setViewportSize({ width: 390, height: 844 });
    expect(await visitor.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await visitor.screenshot({
      path: screenshots + '/maintenance-public-mobile.png',
      fullPage: true,
      animations: 'disabled',
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await page.getByLabel('Marketplace mode').selectOption('false');
    await page.getByRole('button', { name: 'Save maintenance settings' }).click();
    await expect(page.locator('.maintenance-control .badge')).toHaveText('Online');
    await visitor.reload();
    await expect(visitor.getByRole('heading', { name: /Discover good things/ })).toBeVisible();
    expect((await visitor.request.get('/api/products')).status()).toBe(200);
    await expect(page.getByText('Marketplace opened', { exact: true })).toBeVisible();
  } finally {
    await visitorContext.close();
  }
});

test('orders filter, next page and customer-to-admin refund workflow', async ({
  page,
  browser,
}) => {
  await login(page, 'admin');
  await page.goto('/admin/orders');
  await page.getByLabel('Orders per page').selectOption('5');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  const first = await page.locator('tbody tr').first().innerText();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  expect(await page.locator('tbody tr').first().innerText()).not.toEqual(first);
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page.getByLabel('Customer, email or order').fill('BL-DEMO-006');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page
    .locator('tbody')
    .getByRole('link', { name: /Manage/ })
    .click();
  const orderPath = new URL(page.url()).pathname;
  const context = await browser.newContext();
  const customer = await context.newPage();
  try {
    await login(customer, 'customer');
    await customer.goto(orderPath);
    await customer.getByText('Request a refund', { exact: true }).click();
    await customer.getByLabel('Refund amount (BDT)').fill('100');
    await customer.getByLabel('Refund reason').fill('The product finish was damaged on arrival.');
    await customer.getByRole('button', { name: 'Submit refund request' }).click();
    await expect(customer.locator('.refund-case .badge')).toHaveText('requested');
    await page.goto('/admin/orders');
    await page.getByRole('button', { name: 'Review refund requests' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page
      .locator('tbody')
      .getByRole('link', { name: /Manage/ })
      .click();
    await page.getByLabel('Review note').fill('Approved after checking the reported damage.');
    await page.getByRole('button', { name: 'Save refund decision' }).click();
    await expect(page.locator('.refund-case .badge')).toHaveText('approved');
    await page.getByLabel('Payout reference / receipt').fill('DEMO-CASH-REFUND-001');
    await page.getByLabel('Review note').fill('Customer received the refund in cash.');
    await page.getByRole('checkbox').check();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Record refund payout' }).click();
    await expect(page.locator('.refund-case .badge')).toHaveText('completed');
    await expect(page.getByText('Refunds paid')).toBeVisible();
    await customer.reload();
    await expect(customer.locator('.refund-case .badge')).toHaveText('completed');
    await page.screenshot({ path: screenshots + '/order-refund-admin.png', fullPage: true });
    await page.goto('/admin/orders');
    await page.screenshot({ path: screenshots + '/orders-admin.png', fullPage: true });
    await customer.setViewportSize({ width: 390, height: 844 });
    await customer.goto('/orders');
    await expect(customer.locator('tbody tr')).toHaveCount(6);
    expect(await customer.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await customer.screenshot({ path: screenshots + '/orders-mobile.png', fullPage: true });
  } finally {
    await context.close();
  }
});

test('customer wishlist, profile photo and review moderation work through the UI', async ({
  page,
  browser,
}) => {
  await login(page, 'customer');
  await page.goto('/marketplace');
  await page.getByRole('link', { name: /Everyday Classic Watch/ }).click();
  const productPath = new URL(page.url()).pathname;
  await page.getByRole('button', { name: 'Save to wishlist' }).click();
  await expect(page.getByText('Saved to wishlist', { exact: true })).toBeVisible();
  await page.goto('/wishlist');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.goto('/profile');
  await page.getByLabel('Profile photo', { exact: true }).setInputFiles({
    name: 'profile.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1cAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByRole('button', { name: 'Upload profile photo' }).click();
  await expect(page.locator('.header .avatar img')).toBeVisible();
  const context = await browser.newContext(),
    admin = await context.newPage();
  try {
    await login(admin, 'admin');
    await admin.goto('/admin/reviews');
    const review = admin
      .locator('section.panel')
      .filter({ has: admin.getByRole('heading', { name: 'Everyday Classic Watch', exact: true }) });
    await review
      .getByLabel('Moderation reason')
      .fill('Temporary moderation check for an isolated test.');
    await review.getByRole('button', { name: 'Hide review' }).click();
    await page.goto(productPath);
    await expect(
      page.getByText('No reviews yet. Delivered purchases can leave the first review.'),
    ).toBeVisible();
    await review
      .getByLabel('Moderation reason')
      .fill('Review restored after the moderation check.');
    await review.getByRole('button', { name: 'Restore review' }).click();
    await page.reload();
    await expect(page.locator('.review.panel')).toHaveCount(1);
  } finally {
    await context.close();
  }
});
test('seller branding wizard creates a complete store and uploads its identity', async ({
  page,
}) => {
  await page.goto('/register');
  await page.getByLabel('Full name', { exact: true }).fill('Launch Wizard Seller');
  await page.getByLabel('Email address').fill('wizard-seller@test.example');
  await page.getByLabel('Password', { exact: true }).fill('WizardSecret123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('WizardSecret123!');
  await page.getByLabel('I want to').selectOption('seller');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/verify-email/);
  const delivery = await (
    await page.request.get('/api/auth/test-delivery?email=wizard-seller@test.example')
  ).json();
  await page.goto('/verify-email?token=' + delivery.token);
  await page.getByRole('button', { name: 'Verify my email' }).click();
  await page.goto('/login');
  await page.getByLabel('Email address').fill('wizard-seller@test.example');
  await page.getByLabel('Password', { exact: true }).fill('WizardSecret123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/seller$/);
  await page.goto('/seller/business');
  await page.getByLabel('Business name', { exact: true }).fill('Coral Workshop');
  await page.getByLabel('Business category', { exact: true }).fill('Handmade');
  await page
    .getByLabel('Tell your story')
    .fill('Small handmade objects, thoughtfully made in Dhaka.');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Store theme').selectOption('coral');
  await page.getByLabel('Business logo', { exact: true }).setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1cAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Business phone', { exact: true }).fill('01712345678');
  await page
    .getByLabel('Business address', { exact: true })
    .fill('House 22, Dhaka workshop district');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Store URL', { exact: true }).fill('coral-workshop');
  await page
    .getByLabel('Return policy')
    .fill('Contact us within seven days to arrange an inspected return.');
  await page.getByRole('button', { name: 'Create business', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Coral Workshop', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Business logo', exact: true })).toBeVisible();
  await page.screenshot({ path: screenshots + '/business-branding.png', fullPage: true });
});
test('customer return is inspected by the seller and appears in admin transaction monitoring', async ({
  page,
  browser,
}) => {
  await login(page, 'customer');
  await page.goto('/orders');
  await page
    .locator('tbody tr')
    .filter({ hasText: 'BL-DEMO-006' })
    .getByRole('link', { name: /View/ })
    .click();
  const orderPath = new URL(page.url()).pathname;
  await page.getByText('Request store return', { exact: true }).click();
  await page
    .getByLabel('Return reason', { exact: true })
    .fill('All items returned for a full quality inspection.');
  await page.getByRole('button', { name: 'Submit return request' }).click();
  await expect(page.locator('.refund-case .badge').filter({ hasText: /^requested$/ })).toHaveCount(
    1,
  );
  const context = await browser.newContext(),
    seller = await context.newPage();
  try {
    await login(seller, 'seller');
    await seller.goto(orderPath);
    await seller.getByLabel('Return review note').fill('Approved for physical inspection.');
    await seller.getByRole('button', { name: 'Save return decision' }).click();
    await seller.getByLabel('Inspection outcome').selectOption('true');
    await seller.getByLabel('All items from this store have been physically received.').check();
    await seller
      .getByLabel('Return review note')
      .fill('All items received and inspected as saleable.');
    seller.once('dialog', (dialog) => dialog.accept());
    await seller.getByRole('button', { name: 'Confirm return receipt' }).click();
    await expect(seller.locator('.tracking .badge')).toHaveText('returned');
    await seller.goto('/seller/inventory/history');
    await expect(seller.getByRole('cell', { name: /BL-DEMO-006 inspected return/ })).toBeVisible();
  } finally {
    await context.close();
  }
  await page.reload();
  await expect(page.locator('.tracking .badge')).toHaveText('returned');
  const adminContext = await browser.newContext(),
    admin = await adminContext.newPage();
  try {
    await login(admin, 'admin');
    await admin.goto('/admin/transactions');
    await expect(admin.getByRole('heading', { name: 'Payments & refunds' })).toBeVisible();
    await expect(admin.locator('tbody tr').filter({ hasText: 'BL-DEMO-006' })).toBeVisible();
    await admin.goto('/admin/analytics');
    await expect(admin.getByRole('heading', { name: 'Marketplace performance' })).toBeVisible();
    await expect(admin.locator('.recharts-surface')).toBeVisible();
    await expect(admin.getByRole('heading', { name: 'Business performance' })).toBeVisible();
    await admin.screenshot({ path: screenshots + '/platform-analytics.png', fullPage: true });
  } finally {
    await adminContext.close();
  }
});
test('owner invites a verified inventory colleague and finance stays inaccessible', async ({
  page,
  browser,
}) => {
  await login(page, 'seller');
  await page.goto('/seller/team');
  await page.getByLabel('Staff email').fill('browser-customer@test.example');
  await page.getByLabel('Position', { exact: true }).selectOption('inventory');
  await page.getByRole('button', { name: 'Send staff invitation' }).click();
  await expect(page.getByText('Invitation emailed', { exact: true })).toBeVisible();
  const invitation = await (
    await page.request.get('/api/auth/test-delivery?email=browser-customer@test.example')
  ).json();
  const context = await browser.newContext(),
    staff = await context.newPage();
  try {
    await staff.goto('/login');
    await staff.getByLabel('Email address').fill('browser-customer@test.example');
    await staff.getByLabel('Password', { exact: true }).fill('UpdatedBrowser123!');
    await staff.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(staff).toHaveURL(/dashboard/);
    await staff.goto('/team-invite?token=' + invitation.token);
    await staff.getByRole('button', { name: 'Accept staff invitation' }).click();
    await expect(staff).toHaveURL(/login/);
    await staff.getByLabel('Email address').fill('browser-customer@test.example');
    await staff.getByLabel('Password', { exact: true }).fill('UpdatedBrowser123!');
    await staff.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(staff).toHaveURL(/\/seller$/);
    await expect(staff.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
    expect((await staff.request.get('/api/seller/analytics')).status()).toBe(403);
    await staff.goto('/seller/inventory/history');
    await expect(
      staff.getByRole('heading', { name: 'Inventory history', exact: true }),
    ).toBeVisible();
    await staff.screenshot({ path: screenshots + '/staff-inventory.png', fullPage: true });
    const member = page
      .locator('section.panel')
      .filter({ hasText: 'browser-customer@test.example' })
      .last();
    page.once('dialog', (dialog) => dialog.accept());
    await member.getByRole('button', { name: 'Revoke access' }).click();
    expect((await staff.request.get('/api/seller/products')).status()).toBe(401);
  } finally {
    await context.close();
  }
});
test('sales insights, CRM, review replies, fixed coupons and general settings load', async ({
  page,
  browser,
}) => {
  await login(page, 'seller');
  await page.goto('/seller/customers');
  await expect(page.getByRole('heading', { name: 'Your customers' })).toBeVisible();
  await page.getByLabel('Search customers').fill('Rafi');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('cell', { name: /Rafi Ahmed/ })).toBeVisible();
  await page.goto('/seller/analytics');
  await expect(page.getByRole('heading', { name: 'Daily performance' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Slow-moving inventory' })).toBeVisible();
  await page.screenshot({ path: screenshots + '/seller-insights.png', fullPage: true });
  await page.goto('/seller/coupons');
  await page.getByLabel('Code', { exact: true }).fill('FIXEDBROWSER');
  await page.getByLabel('Discount type').selectOption('fixed');
  await page.getByLabel('Discount amount (BDT)').fill('50');
  await page.getByLabel('Expires at').fill('2027-12-31T23:59');
  await page.getByRole('button', { name: 'Create coupon', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'FIXEDBROWSER', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/seller/analytics');
  await expect(page.getByRole('heading', { name: 'Daily performance' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    admin = await context.newPage();
  try {
    await login(admin, 'admin');
    await admin.goto('/admin/settings');
    await expect(admin.getByRole('heading', { name: 'Integration readiness' })).toBeVisible();
    expect(await admin.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  } finally {
    await context.close();
  }
});

test('public category and store directories remain usable on mobile', async ({ page }) => {
  await page.goto('/categories');
  await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible();
  await expect(page.locator('main .panel').first()).toBeVisible();
  await page.locator('main .panel').first().click();
  await expect(page).toHaveURL(/marketplace\?category=/);
  await page.goto('/stores');
  await expect(page.getByRole('heading', { name: 'Independent stores' })).toBeVisible();
  await page.getByRole('link', { name: /The Everyday Studio/ }).click();
  await expect(
    page.getByRole('heading', { name: 'The Everyday Studio', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /^about$/i }).click();
  await expect(page.getByRole('heading', { name: 'About The Everyday Studio' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/categories');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.goto('/stores');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

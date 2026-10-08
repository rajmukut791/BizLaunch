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
  await expect(page.locator('.loading')).toHaveCount(0);
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
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
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
  await row
    .getByLabel('PNG, JPEG or WebP · up to 5 MB')
    .setInputFiles({
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

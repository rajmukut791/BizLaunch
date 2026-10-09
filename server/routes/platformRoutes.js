const router = require('express').Router();
const Settings = require('../models/PlatformSettings');
const { settings, publicStatus, defaults } = require('../services/maintenance');
const { protect, roles } = require('../middleware/auth');
const { text, number, fail } = require('../utils/validation');
router.get('/platform/status', async (req, res) => {
  res
    .set('Cache-Control', 'no-store')
    .json({ success: true, maintenance: publicStatus(await settings()) });
});
router.get('/admin/maintenance', protect, roles('admin'), async (req, res) => {
  await settings();
  const current = await Settings.findById('platform').populate('history.changedBy', 'name').lean();
  res.set('Cache-Control', 'no-store').json({ success: true, maintenance: current || defaults });
});
router.patch('/admin/maintenance', protect, roles('admin'), async (req, res) => {
  const data = req.body || {};
  if (typeof data.enabled !== 'boolean') fail(400, 'Choose whether maintenance is enabled');
  const title = text(data.title, 'Title', 3, 90),
    message = text(data.message, 'Message', 10, 600);
  const version = number(data.version, 'Settings version', 0, 100000000, true);
  let endsAt = null;
  if (data.endsAt) {
    if (typeof data.endsAt !== 'string') fail(400, 'Choose a valid end time');
    endsAt = new Date(data.endsAt);
    if (
      !Number.isFinite(endsAt.getTime()) ||
      endsAt <= new Date() ||
      endsAt > new Date(Date.now() + 30 * 86400000)
    )
      fail(400, 'End time must be in the next 30 days');
  }
  if (!data.enabled) endsAt = null;
  await Settings.updateOne(
    { _id: 'platform' },
    { $setOnInsert: { ...defaults, _id: 'platform' } },
    { upsert: true },
  );
  const current = await Settings.findOneAndUpdate(
    { _id: 'platform', version },
    {
      $set: { enabled: data.enabled, title, message, endsAt },
      $inc: { version: 1 },
      $push: {
        history: {
          $each: [
            {
              enabled: data.enabled,
              title,
              message,
              endsAt,
              changedBy: req.user._id,
              changedAt: new Date(),
            },
          ],
          $slice: -20,
        },
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).populate('history.changedBy', 'name');
  if (!current) fail(409, 'Another admin updated these settings. Reload and try again.');
  res.json({ success: true, maintenance: current });
});
const config = (data) => ({
  platformName: data.platformName || 'BizLaunch',
  supportEmail: data.supportEmail || '',
  supportPhone: data.supportPhone || '',
  allowRegistration: data.allowRegistration !== false,
  version: data.version || 0,
});
router.get('/platform/config', async (req, res) =>
  res.set('Cache-Control', 'no-store').json({ success: true, config: config(await settings()) }),
);
router.get('/admin/settings', protect, roles('admin'), async (req, res) => {
  const current = await Settings.findById('platform')
    .populate('settingsHistory.changedBy', 'name')
    .lean();
  res.json({
    success: true,
    settings: { ...config(current || {}), history: current?.settingsHistory || [] },
    integrations: {
      'Gmail SMTP': require('../services/mail').available(),
      Cloudinary: !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
      ),
      'Local image uploads': true,
      'Socket.IO notifications': true,
      MongoDB: require('mongoose').connection.readyState === 1,
    },
  });
});
router.patch('/admin/settings', protect, roles('admin'), async (req, res) => {
  const body = req.body || {},
    platformName = text(body.platformName, 'Platform name', 2, 30),
    supportPhone = text(body.supportPhone || '', 'Support phone', 0, 30),
    supportEmail = body.supportEmail ? require('../utils/validation').email(body.supportEmail) : '';
  if (typeof body.allowRegistration !== 'boolean') fail(400, 'Choose registration availability');
  const version = number(body.version, 'Settings version', 0, 100000000, true);
  await Settings.updateOne(
    { _id: 'platform' },
    { $setOnInsert: { ...defaults, _id: 'platform' } },
    { upsert: true },
  );
  const data = {
    platformName,
    supportEmail,
    supportPhone,
    allowRegistration: body.allowRegistration,
  };
  const updated = await Settings.findOneAndUpdate(
    { _id: 'platform', version },
    {
      $set: data,
      $inc: { version: 1 },
      $push: {
        settingsHistory: {
          $each: [{ ...data, changedBy: req.user._id, changedAt: new Date() }],
          $slice: -20,
        },
      },
    },
    { returnDocument: 'after', runValidators: true },
  );
  if (!updated) fail(409, 'Settings changed. Reload before saving');
  res.json({ success: true, config: config(updated) });
});
module.exports = router;

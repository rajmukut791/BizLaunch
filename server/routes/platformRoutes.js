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
module.exports = router;

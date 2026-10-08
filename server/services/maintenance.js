const Settings = require('../models/PlatformSettings');
const defaults = {
  enabled: false,
  title: 'A little care. A better BizLaunch.',
  message:
    'We are making a few thoughtful improvements. Your account and orders are safe. Please check back shortly.',
  endsAt: null,
  version: 0,
  history: [],
};
async function settings() {
  let current = await Settings.findById('platform').lean();
  if (current?.enabled && current.endsAt && new Date(current.endsAt) <= new Date()) {
    await Settings.updateOne(
      { _id: 'platform', enabled: true, endsAt: { $ne: null, $lte: new Date() } },
      {
        $set: { enabled: false, endsAt: null },
        $inc: { version: 1 },
        $push: {
          history: {
            $each: [
              {
                enabled: false,
                title: 'Scheduled maintenance completed',
                message: 'The scheduled maintenance window ended automatically.',
                changedBy: null,
                changedAt: new Date(),
              },
            ],
            $slice: -20,
          },
        },
      },
    );
    current = await Settings.findById('platform').lean();
  }
  return current || defaults;
}
const publicStatus = (settings) => ({
  enabled: settings.enabled,
  title: settings.title,
  message: settings.message,
  endsAt: settings.endsAt,
  updatedAt: settings.updatedAt || null,
});
module.exports = { settings, publicStatus, defaults };

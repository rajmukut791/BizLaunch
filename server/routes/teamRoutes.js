const router = require('express').Router(),
  crypto = require('node:crypto');
const Member = require('../models/BusinessMember'),
  User = require('../models/User');
const { protect, roles } = require('../middleware/auth'),
  { fail, id, email, oneOf, text } = require('../utils/validation'),
  { ownedBusiness, notify } = require('../services/commerce'),
  { grants } = require('../services/team');
const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');
router.use(['/seller/team', '/team-invites'], protect);
router.get('/seller/team', roles('seller'), async (req, res) =>
  res.json({
    success: true,
    members: await Member.find({ business: (await ownedBusiness(req.user))._id })
      .populate('user', 'name email')
      .sort({ createdAt: -1 }),
  }),
);
router.post('/seller/team', roles('seller'), async (req, res) => {
  const business = await ownedBusiness(req.user),
    address = email(req.body?.email),
    job = oneOf(req.body?.job, Object.keys(grants), 'staff position');
  const account = await User.findOne({ email: address });
  if (account && !['customer', 'staff'].includes(account.role))
    fail(400, 'Invite a customer account or a new email address');
  const existing = await Member.findOne({ business: business._id, email: address });
  if (existing?.status === 'active') fail(409, 'This staff member is already active');
  const token = crypto.randomBytes(32).toString('hex'),
    expiresAt = new Date(Date.now() + 7 * 86400000);
  const member = await Member.findOneAndUpdate(
    { business: business._id, email: address },
    {
      $set: {
        job,
        permissions: grants[job],
        status: 'invited',
        tokenHash: hash(token),
        expiresAt,
        invitedBy: req.user.id,
      },
      $unset: { user: 1, joinedAt: 1 },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
  const url = new URL('/team-invite', process.env.CLIENT_URL);
  url.searchParams.set('token', token);
  try {
    await require('../services/mail').sendMessage(
      address,
      {
        subject: 'Join ' + business.name + ' on BizLaunch',
        text:
          'You are invited as ' +
          job +
          ' to ' +
          business.name +
          '. Register or sign in with this email, verify your mailbox, then accept: ' +
          url.href +
          '\nThis invitation expires in seven days.',
      },
      { purpose: 'team', token, url: url.href },
    );
  } catch (error) {
    await Member.deleteOne({ _id: member._id, status: 'invited', tokenHash: hash(token) });
    throw error;
  }
  res.status(201).json({ success: true, message: 'Staff invitation sent' });
});
router.patch('/seller/team/:id', roles('seller'), async (req, res) => {
  const business = await ownedBusiness(req.user),
    member = await Member.findOne({ _id: id(req.params.id), business: business._id });
  if (!member) fail(404, 'Staff member not found');
  if (req.body?.status === 'revoked') {
    member.status = 'revoked';
    member.tokenHash = undefined;
    await member.save();
    if (member.user)
      await User.updateOne(
        { _id: member.user, role: 'staff' },
        { $set: { role: 'customer' }, $inc: { tokenVersion: 1 } },
      );
  } else {
    member.job = oneOf(req.body?.job, Object.keys(grants), 'staff position');
    member.permissions = grants[member.job];
    await member.save();
    if (member.user) await User.updateOne({ _id: member.user }, { $inc: { tokenVersion: 1 } });
  }
  res.json({ success: true, message: 'Staff access updated' });
});
router.post('/team-invites/accept', async (req, res) => {
  if (!['customer', 'staff'].includes(req.user.role))
    fail(403, 'Use the invited customer/staff account');
  const token = text(req.body?.token, 'Invitation token', 64, 64);
  if (!/^[a-f0-9]{64}$/.test(token)) fail(400, 'Invalid invitation');
  const member = await Member.findOne({
    email: req.user.email,
    status: 'invited',
    tokenHash: hash(token),
    expiresAt: { $gt: new Date() },
  });
  if (!member) fail(400, 'Invitation is invalid, expired or belongs to another email');
  if (await Member.exists({ user: req.user.id, status: 'active' }))
    fail(409, 'This account already belongs to a business');
  const business = await require('../models/commerce').Business.findById(member.business);
  const owner = business && (await User.findById(business.owner));
  if (!business?.active || owner?.status !== 'active')
    fail(403, 'Business staff invitations are unavailable');
  await require('../controllers/checkoutController').atomic(async (session) => {
    await Member.findById(member._id).session(session);
    const updated = await Member.findOneAndUpdate(
      { _id: member._id, status: 'invited', tokenHash: hash(token) },
      {
        $set: { user: req.user.id, status: 'active', joinedAt: new Date() },
        $unset: { tokenHash: 1, expiresAt: 1 },
      },
      { session, returnDocument: 'after' },
    );
    if (!updated) fail(409, 'Invitation was already accepted');
    try {
      await User.updateOne(
        { _id: req.user.id },
        { $set: { role: 'staff' }, $inc: { tokenVersion: 1 } },
        { session },
      );
    } catch (error) {
      if (!session)
        await Member.updateOne(
          { _id: member._id, status: 'active' },
          {
            $set: { status: 'invited', tokenHash: hash(token), expiresAt: member.expiresAt },
            $unset: { user: 1, joinedAt: 1 },
          },
        );
      throw error;
    }
  });
  await notify(
    business.owner,
    'Staff member joined',
    req.user.name + ' joined your business.',
    '/seller/team',
  );
  res.clearCookie('bizlaunch_session', {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  res.json({ success: true, message: 'Invitation accepted. Sign in to your staff workspace.' });
});
module.exports = router;

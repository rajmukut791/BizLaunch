const Member = require('../models/BusinessMember'),
  { Business } = require('../models/commerce'),
  { fail } = require('../utils/validation');
const grants = {
  manager: ['products', 'inventory', 'orders', 'customers', 'finance', 'reviews', 'settings'],
  sales: ['orders', 'customers', 'reviews'],
  inventory: ['inventory'],
};
async function memberFor(user) {
  const member = await Member.findOne({ user: user._id, status: 'active' });
  const business = member && (await Business.findById(member.business).populate('owner', 'status'));
  if (!member || !business?.active || business.owner?.status !== 'active')
    fail(403, 'Your staff access is unavailable');
  return member;
}
function staffAccess(req, res, next) {
  if (req.user.role !== 'staff') return next();
  const routePath = req.originalUrl.split('?')[0].replace(/^\/api/, '');
  if (/^\/(profile|notifications|team-invites)(\/|$)/.test(routePath)) return next();
  const paths = [
    [/^\/seller\/business$/, 'settings'],
    [/^\/seller\/business\/images$/, 'settings'],
    [/^\/seller\/inventory/, 'inventory'],
    [/^\/seller\/products/, 'products'],
    [/^\/(seller\/orders|orders)(\/|$)/, 'orders'],
    [/^\/seller\/customers/, 'customers'],
    [/^\/seller\/reviews/, 'reviews'],
    [/^\/seller\/(analytics|insights|expenses|reports)/, 'finance'],
    [/^\/seller\/coupons/, 'products'],
  ];
  const permission = paths.find(([pattern]) => pattern.test(routePath))?.[1],
    allowed = req.member.permissions;
  const basicBusiness = routePath === '/seller/business' && req.method === 'GET',
    inventoryRead =
      routePath === '/seller/products' && req.method === 'GET' && allowed.includes('inventory');
  if (!basicBusiness && !inventoryRead && (!permission || !allowed.includes(permission)))
    fail(403, 'Your staff permissions do not allow this action');
  req.staff = true;
  req.user.staffBusiness = req.member.business;
  req.user.role = 'seller';
  next();
}
module.exports = { grants, memberFor, staffAccess };

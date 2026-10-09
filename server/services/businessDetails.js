const { fail, text, email, oneOf } = require('../utils/validation');
function businessDetails(body = {}) {
  const data = {};
  for (const [key, max] of [
    ['category', 80],
    ['type', 60],
    ['deliveryOptions', 500],
    ['returnPolicy', 2000],
  ])
    if (body[key] !== undefined) data[key] = text(body[key], key, 0, max);
  if (body.theme !== undefined)
    data.theme = oneOf(body.theme, ['sage', 'midnight', 'coral'], 'store theme');
  if (body.currency !== undefined) data.currency = oneOf(body.currency, ['BDT'], 'currency');
  if (body.email !== undefined) data.email = body.email ? email(body.email) : '';
  if (body.socialLinks !== undefined) {
    if (
      !body.socialLinks ||
      typeof body.socialLinks !== 'object' ||
      Array.isArray(body.socialLinks)
    )
      fail(400, 'Social links must be an object');
    data.socialLinks = {};
    for (const key of ['website', 'facebook', 'instagram'])
      if (body.socialLinks[key]) {
        const value = text(body.socialLinks[key], key, 1, 500);
        let url;
        try {
          url = new URL(value);
        } catch {
          fail(400, 'Enter a valid ' + key + ' URL');
        }
        if (url.protocol !== 'https:') fail(400, 'Social links must use HTTPS');
        data.socialLinks[key] = url.href;
      }
  }
  return data;
}
module.exports = businessDetails;

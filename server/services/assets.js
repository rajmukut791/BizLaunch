const { randomUUID } = require('node:crypto'),
  path = require('node:path'),
  fs = require('node:fs/promises');
const { fail } = require('../utils/validation');
async function saveImage(file) {
  if (!file) fail(400, 'Choose an image');
  const buffer = file.buffer;
  let extension;
  if (
    buffer.length > 24 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    extension = 'png';
  else if (buffer.length > 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    extension = 'jpg';
  else if (
    buffer.length > 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  )
    extension = 'webp';
  else fail(400, 'Only PNG, JPEG and WebP images are accepted');
  if (buffer.length > 5 * 1024 * 1024) fail(400, 'Maximum image size is 5 MB');
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET &&
    process.env.NODE_ENV !== 'test'
  ) {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    const result = await cloudinary.uploader.upload(
      'data:image/' +
        (extension === 'jpg' ? 'jpeg' : extension) +
        ';base64,' +
        buffer.toString('base64'),
      { folder: 'bizlaunch', resource_type: 'image', timeout: 15000 },
    );
    return result.secure_url;
  }
  const filename = randomUUID() + '.' + extension,
    folder = path.join(__dirname, '../uploads');
  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, filename), buffer, { flag: 'wx' });
  return '/uploads/' + filename;
}
module.exports = { saveImage };

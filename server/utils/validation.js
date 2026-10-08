const mongoose = require('mongoose');
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function text(value, label, min = 1, max = 200) {
  if (typeof value !== 'string') fail(400, `${label} must be text`);
  const result = value.trim();
  if (result.length < min || result.length > max)
    fail(400, `${label} must contain ${min}–${max} characters`);
  return result;
}
function number(value, label, min = 0, max = 100000000, integer = false) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    fail(400, `${label} is invalid`);
  return integer ? value : Math.round(value * 100) / 100;
}
function id(value) {
  if (typeof value !== 'string' || !mongoose.isObjectIdOrHexString(value))
    fail(400, 'Invalid record ID');
  return value;
}
function email(value) {
  const result = text(value, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail(400, 'Enter a valid email');
  return result;
}
function password(value) {
  const result = text(value, 'Password', 8, 72);
  if (Buffer.byteLength(result) > 72) fail(400, 'Password cannot exceed 72 bytes');
  return result;
}
function oneOf(value, values, label) {
  if (!values.includes(value)) fail(400, `Invalid ${label}`);
  return value;
}
const money = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
module.exports = { fail, text, number, id, email, password, oneOf, money };

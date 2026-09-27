import crypto from 'node:crypto';

const TOKEN_HOURS = 12;

// Signing key is derived from the admin password, so changing the password logs everyone out.
const secret = () => crypto.createHash('sha256').update(`booking-admin:${process.env.ADMIN_PASSWORD}`).digest();
const sign = (payload) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export function checkPassword(password) {
  return Boolean(process.env.ADMIN_PASSWORD) && safeEqual(password ?? '', process.env.ADMIN_PASSWORD);
}

export function issueToken() {
  const payload = String(Date.now() + TOKEN_HOURS * 3600000);
  return `${payload}.${sign(payload)}`;
}

export function isAuthorised(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const [payload, sig] = token.split('.');
  return Boolean(payload && sig) && safeEqual(sig, sign(payload)) && Number(payload) > Date.now();
}

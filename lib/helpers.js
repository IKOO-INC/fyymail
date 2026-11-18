'use strict';

/** Ambil daftar origin yang diizinkan dari env */
function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || '*';
  if (raw.trim() === '*') return ['*'];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Pasang header CORS + tangani preflight OPTIONS. Return true kalau request sudah ditangani (OPTIONS). */
function handleCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = getAllowedOrigins();
  const allowAll = allowed.includes('*');

  if (allowAll) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

/** Kirim JSON response */
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

/** Baca body JSON dari request Vercel (sudah ter-parse atau string) */
function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

/** Ambil query dari URL (fallback kalau req.query belum ada) */
function getQuery(req) {
  if (req.query && typeof req.query === 'object' && Object.keys(req.query).length) return req.query;
  try {
    const url = req.url || '';
    const qs = url.includes('?') ? url.split('?')[1] : '';
    if (!qs) return {};
    return Object.fromEntries(new URLSearchParams(qs));
  } catch { return {}; }
}

/** Gabung query + body → support GET (?email=...) dan POST */
function getParams(req) {
  return { ...getQuery(req), ...getBody(req) };
}

/** Validasi format email sederhana */
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const e = email.trim();
  if (e.length < 5 || e.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/** Samarkan email untuk log/response: a***@domain.com */
function maskEmail(email) {
  const e = normalizeEmail(email);
  const [user, domain] = e.split('@');
  if (!user || !domain) return '***';
  const visible = user.slice(0, 1);
  return `${visible}***@${domain}`;
}

/** Rate limit sederhana in-memory per key (per instance serverless).
 *  Untuk production multi-instance, gunakan Redis (lihat lib/otp-store.js).
 */
const rateLimitStore = new Map();

function checkRateLimit(key, max, windowSeconds) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs };
  }
  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt };
}

module.exports = {
  handleCors,
  json,
  getBody,
  getQuery,
  getParams,
  isValidEmail,
  normalizeEmail,
  maskEmail,
  checkRateLimit,
  getAllowedOrigins,
};

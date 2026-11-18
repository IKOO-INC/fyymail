'use strict';

const crypto = require('crypto');

/** Ambil daftar API key yang valid dari env (pisahkan koma) */
function getApiKeys() {
  const raw = process.env.API_KEYS || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Perbandingan aman (timing-safe) */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function getQuery(req) {
  if (req.query && typeof req.query === 'object') return req.query;
  try {
    const url = req.url || '';
    const qs = url.includes('?') ? url.split('?')[1] : '';
    return Object.fromEntries(new URLSearchParams(qs));
  } catch { return {}; }
}

/**
 * Cek x-api-key: header x-api-key / Authorization Bearer, atau query ?key= / ?apiKey= / ?x-api-key=
 * Query param memudahkan tes GET langsung dari browser.
 */
function isAuthorized(req) {
  const keys = getApiKeys();
  if (keys.length === 0) return false;
  const q = getQuery(req);
  const headerKey =
    req.headers['x-api-key'] ||
    req.headers['x-apikey'] ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() ||
    q['x-api-key'] || q['x-apikey'] || q.apiKey || q.api_key || q.key || q.token || '';
  const k = String(headerKey).trim();
  if (!k) return false;
  return keys.some((valid) => safeEqual(valid, k));
}

module.exports = { getApiKeys, isAuthorized };

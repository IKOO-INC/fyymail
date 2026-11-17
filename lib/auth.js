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

/**
 * Cek header x-api-key (atau Authorization: Bearer <key>).
 * Return true kalau valid.
 */
function isAuthorized(req) {
  const keys = getApiKeys();
  if (keys.length === 0) {
    // Kalau API_KEYS belum di-set, tolak semua (fail-closed) kecuali di dev lokal tanpa env sama sekali?
    // Untuk keamanan: tolak. User wajib set API_KEYS.
    return false;
  }

  const headerKey =
    req.headers['x-api-key'] ||
    req.headers['x-apikey'] ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

  if (!headerKey) return false;
  return keys.some((k) => safeEqual(k, headerKey));
}

module.exports = { getApiKeys, isAuthorized };

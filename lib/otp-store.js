'use strict';

const crypto = require('crypto');

/**
 * Penyimpanan OTP:
 * - Kalau UPSTASH_REDIS_REST_URL + TOKEN di-set -> pakai Upstash Redis (konsisten antar instance Vercel)
 * - Kalau tidak -> pakai in-memory Map (hanya untuk demo/testing lokal, tidak konsisten di serverless)
 *
 * Yang disimpan HANYA hash OTP (SHA-256 + salt), bukan OTP asli.
 */

function hashOtp(otp, salt) {
  return crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
}

function generateOtp(length = 6) {
  // crypto.randomInt lebih aman daripada Math.random
  const max = Math.pow(10, length);
  const min = Math.pow(10, length - 1);
  const n = crypto.randomInt(min, max);
  return String(n).padStart(length, '0');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

// ---------- In-memory fallback ----------
const memoryStore = new Map(); // key -> { hash, salt, expiresAt, attempts }

async function memorySet(key, value, ttlSeconds) {
  memoryStore.set(key, { ...value, expiresAt: Date.now() + ttlSeconds * 1000 });
}
async function memoryGet(key) {
  const v = memoryStore.get(key);
  if (!v) return null;
  if (Date.now() > v.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return v;
}
async function memoryDel(key) {
  memoryStore.delete(key);
}

// ---------- Upstash Redis (REST API, tanpa dependency tambahan) ----------
function hasRedis() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redisCommand(...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, '');
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args.map((a) => [a])),
  });
  if (!res.ok) throw new Error(`Redis error: ${res.status}`);
  const data = await res.json();
  return data;
}

// Simpler: pakai endpoint single command Upstash: POST /<command>/<args...>
async function redisSingle(command, ...args) {
  const base = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, '');
  const path = [command, ...args.map((a) => encodeURIComponent(String(a)))].join('/');
  const res = await fetch(`${base}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Redis error: ${res.status}`);
  const data = await res.json();
  return data.result;
}

async function redisSet(key, value, ttlSeconds) {
  await redisSingle('SET', key, JSON.stringify(value), 'EX', ttlSeconds);
}
async function redisGet(key) {
  const raw = await redisSingle('GET', key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
async function redisDel(key) {
  await redisSingle('DEL', key);
}

// ---------- Public API ----------
function otpKey(email, appName) {
  const e = String(email).toLowerCase().trim();
  const a = String(appName || 'default').toLowerCase().trim();
  return `otp:${a}:${e}`;
}

async function saveOtp(email, appName, otp, ttlSeconds) {
  const salt = generateSalt();
  const hash = hashOtp(otp, salt);
  const value = { hash, salt, attempts: 0, createdAt: Date.now() };
  const key = otpKey(email, appName);
  if (hasRedis()) await redisSet(key, value, ttlSeconds);
  else await memorySet(key, value, ttlSeconds);
  return key;
}

async function getOtpRecord(email, appName) {
  const key = otpKey(email, appName);
  return hasRedis() ? redisGet(key) : memoryGet(key);
}

async function deleteOtp(email, appName) {
  const key = otpKey(email, appName);
  if (hasRedis()) await redisDel(key);
  else await memoryDel(key);
}

async function incrementAttempts(email, appName) {
  const rec = await getOtpRecord(email, appName);
  if (!rec) return null;
  rec.attempts = (rec.attempts || 0) + 1;
  const key = otpKey(email, appName);
  const ttl = Math.max(1, Math.ceil((rec.expiresAt ? rec.expiresAt - Date.now() : 600000) / 1000));
  if (hasRedis()) {
    // Redis: pertahankan TTL sisa — hitung dari createdAt + TTL awal tidak tersedia,
    // jadi pakai TTL default 600s sebagai fallback aman.
    await redisSet(key, rec, ttl);
  } else {
    await memorySet(key, rec, ttl);
  }
  return rec;
}

/**
 * Verifikasi OTP. Return { valid: boolean, reason?: string }
 */
async function verifyOtp(email, appName, otpInput, maxAttempts = 5) {
  const rec = await getOtpRecord(email, appName);
  if (!rec) return { valid: false, reason: 'OTP tidak ditemukan atau sudah kedaluwarsa' };
  if ((rec.attempts || 0) >= maxAttempts) {
    await deleteOtp(email, appName);
    return { valid: false, reason: 'Terlalu banyak percobaan. Minta OTP baru.' };
  }

  const candidate = hashOtp(String(otpInput).trim(), rec.salt);
  const ok = crypto.timingSafeEqual(
    Buffer.from(candidate, 'hex'),
    Buffer.from(rec.hash, 'hex')
  );

  if (!ok) {
    await incrementAttempts(email, appName);
    return { valid: false, reason: 'Kode OTP salah' };
  }

  await deleteOtp(email, appName); // sekali pakai
  return { valid: true };
}

module.exports = {
  generateOtp,
  hashOtp,
  saveOtp,
  getOtpRecord,
  deleteOtp,
  verifyOtp,
  hasRedis,
  otpKey,
};

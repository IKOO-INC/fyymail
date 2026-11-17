'use strict';

/**
 * Smoke test lokal tanpa SMTP asli.
 * Mengetes: health, auth, validasi, generate+verify OTP (in-memory).
 * Jalankan: npm test
 */

process.env.API_KEYS = 'test-key-1234567890';
process.env.ALLOW_OTP_IN_RESPONSE = 'true';
process.env.OTP_TTL_SECONDS = '600';

// Mock mailer agar tidak butuh SMTP asli
const mailerPath = require.resolve('../lib/mailer');
require.cache[mailerPath] = {
  id: mailerPath,
  filename: mailerPath,
  loaded: true,
  exports: {
    sendMail: async ({ to, subject }) => {
      console.log(`  [mock-smtp] to=${to} subject="${subject}"`);
      return { messageId: 'mock-123' };
    },
    getTransporter: () => null,
    getFrom: () => 'test@example.com',
  },
};

const health = require('../api/health');
const sendOtp = require('../api/send-otp');
const verifyOtp = require('../api/verify-otp');

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    end(chunk) { this.body = chunk ? JSON.parse(chunk) : null; },
  };
  return res;
}

function mockReq({ method = 'GET', headers = {}, body = {} } = {}) {
  return { method, headers, body };
}

let passed = 0;
let failed = 0;
function assert(name, cond, extra = '') {
  if (cond) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name} ${extra}`); failed++; }
}

(async () => {
  console.log('== Fyymotion Auth smoke test ==\n');

  // 1. Health
  console.log('1. GET /api/health');
  let res = mockRes();
  health(mockReq({ method: 'GET' }), res);
  assert('health 200', res.statusCode === 200 && res.body.success === true, JSON.stringify(res.body));

  // 2. Tanpa API key -> 401
  console.log('\n2. POST /api/send-otp tanpa API key');
  res = mockRes();
  await sendOtp(mockReq({ method: 'POST', body: { email: 'a@b.com' } }), res);
  assert('401 tanpa key', res.statusCode === 401, `status=${res.statusCode}`);

  // 3. API key salah -> 401
  console.log('\n3. POST /api/send-otp API key salah');
  res = mockRes();
  await sendOtp(mockReq({ method: 'POST', headers: { 'x-api-key': 'salah' }, body: { email: 'a@b.com' } }), res);
  assert('401 key salah', res.statusCode === 401, `status=${res.statusCode}`);

  // 4. Email invalid -> 400
  console.log('\n4. POST /api/send-otp email invalid');
  res = mockRes();
  await sendOtp(mockReq({ method: 'POST', headers: { 'x-api-key': 'test-key-1234567890' }, body: { email: 'bukan-email' } }), res);
  assert('400 email invalid', res.statusCode === 400, `status=${res.statusCode}`);

  // 5. Kirim OTP valid -> 200 + otp di response (mode test)
  console.log('\n5. POST /api/send-otp valid');
  res = mockRes();
  await sendOtp(mockReq({
    method: 'POST',
    headers: { 'x-api-key': 'test-key-1234567890' },
    body: { email: 'user@example.com', appName: 'WebsiteKu', purpose: 'verifikasi akun' },
  }), res);
  assert('200 kirim OTP', res.statusCode === 200 && res.body.success === true, JSON.stringify(res.body));
  const otp = res.body.otp;
  assert('OTP 6 digit di response (mode test)', /^\d{6}$/.test(otp || ''), `otp=${otp}`);

  // 6. Verify OTP salah -> valid:false
  console.log('\n6. POST /api/verify-otp OTP salah');
  res = mockRes();
  await verifyOtp(mockReq({
    method: 'POST',
    headers: { 'x-api-key': 'test-key-1234567890' },
    body: { email: 'user@example.com', otp: '000000', appName: 'WebsiteKu' },
  }), res);
  assert('OTP salah ditolak', res.body.valid === false, JSON.stringify(res.body));

  // 7. Verify OTP benar -> valid:true
  console.log('\n7. POST /api/verify-otp OTP benar');
  res = mockRes();
  await verifyOtp(mockReq({
    method: 'POST',
    headers: { 'x-api-key': 'test-key-1234567890' },
    body: { email: 'user@example.com', otp, appName: 'WebsiteKu' },
  }), res);
  assert('OTP benar diterima', res.body.valid === true, JSON.stringify(res.body));

  // 8. Verify ulang OTP yang sama -> sudah terpakai
  console.log('\n8. POST /api/verify-otp OTP dipakai ulang');
  res = mockRes();
  await verifyOtp(mockReq({
    method: 'POST',
    headers: { 'x-api-key': 'test-key-1234567890' },
    body: { email: 'user@example.com', otp, appName: 'WebsiteKu' },
  }), res);
  assert('OTP sekali pakai', res.body.valid === false, JSON.stringify(res.body));

  // 9. Method tidak diizinkan
  console.log('\n9. GET /api/send-otp (harus 405)');
  res = mockRes();
  await sendOtp(mockReq({ method: 'GET', headers: { 'x-api-key': 'test-key-1234567890' } }), res);
  assert('405 untuk GET', res.statusCode === 405, `status=${res.statusCode}`);

  console.log(`\n== Hasil: ${passed} lolos, ${failed} gagal ==`);
  process.exit(failed ? 1 : 0);
})();

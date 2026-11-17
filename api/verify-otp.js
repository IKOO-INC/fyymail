'use strict';

const { handleCors, json, getBody, isValidEmail, normalizeEmail, maskEmail } = require('../lib/helpers');
const { isAuthorized } = require('../lib/auth');
const { verifyOtp } = require('../lib/otp-store');

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return json(res, 405, { success: false, error: 'Method tidak diizinkan. Gunakan POST.' });
  }

  if (!isAuthorized(req)) {
    return json(res, 401, { success: false, error: 'API key tidak valid atau tidak ada. Kirim header x-api-key.' });
  }

  const body = getBody(req);
  const emailRaw = body.email || '';
  const otp = body.otp || body.code || '';
  const appName = String(body.appName || body.app || 'Fyymotion').slice(0, 60);

  if (!isValidEmail(emailRaw)) {
    return json(res, 400, { success: false, error: 'Format email tidak valid.' });
  }
  if (!otp || !/^\d{4,10}$/.test(String(otp).trim())) {
    return json(res, 400, { success: false, error: 'OTP wajib diisi berupa angka 4-10 digit.' });
  }

  const email = normalizeEmail(emailRaw);
  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);

  const result = await verifyOtp(email, appName, String(otp).trim(), maxAttempts);

  if (!result.valid) {
    return json(res, 200, { success: false, valid: false, email: maskEmail(email), error: result.reason });
  }

  return json(res, 200, { success: true, valid: true, email: maskEmail(email), message: 'OTP valid.' });
};

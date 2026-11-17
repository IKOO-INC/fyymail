'use strict';

const { handleCors, json, getBody, isValidEmail, normalizeEmail, maskEmail, checkRateLimit } = require('../lib/helpers');
const { isAuthorized } = require('../lib/auth');
const { sendMail } = require('../lib/mailer');
const { otpEmail } = require('../lib/templates');
const { generateOtp, saveOtp } = require('../lib/otp-store');

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return json(res, 405, { success: false, error: 'Method tidak diizinkan. Gunakan POST.' });
  }

  if (!isAuthorized(req)) {
    return json(res, 401, { success: false, error: 'API key tidak valid atau tidak ada. Kirim header x-api-key.' });
  }

  const body = getBody(req);
  const emailRaw = body.email || body.to || '';
  const appName = String(body.appName || body.app || 'Fyymotion').slice(0, 60);
  const purpose = body.purpose ? String(body.purpose).slice(0, 80) : undefined;

  if (!isValidEmail(emailRaw)) {
    return json(res, 400, { success: false, error: 'Format email tidak valid.' });
  }
  const email = normalizeEmail(emailRaw);

  // Rate limit per email
  const rlMax = parseInt(process.env.RATE_LIMIT_MAX || '5', 10);
  const rlWindow = parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || '600', 10);
  const rl = checkRateLimit(`send-otp:${email}`, rlMax, rlWindow);
  if (!rl.allowed) {
    return json(res, 429, {
      success: false,
      error: `Terlalu banyak permintaan OTP untuk email ini. Coba lagi setelah ${new Date(rl.resetAt).toISOString()}.`,
    });
  }

  // OTP: pakai dari client kalau dikirim, kalau tidak generate sendiri
  const otpLength = parseInt(process.env.OTP_LENGTH || '6', 10);
  const ttlSeconds = parseInt(process.env.OTP_TTL_SECONDS || '600', 10);
  const expiresInMinutes = Math.max(1, Math.round(ttlSeconds / 60));

  let otp;
  if (body.otp) {
    otp = String(body.otp).trim();
    if (!/^\d{4,10}$/.test(otp)) {
      return json(res, 400, { success: false, error: 'OTP dari client harus berupa angka 4-10 digit.' });
    }
  } else {
    otp = generateOtp(otpLength);
  }

  // Simpan hash OTP untuk verifikasi via /api/verify-otp
  try {
    await saveOtp(email, appName, otp, ttlSeconds);
  } catch (err) {
    console.error('[send-otp] Gagal menyimpan OTP:', err.message);
    // Tetap lanjut kirim email — verifikasi manual via DB client tetap bisa
  }

  const { subject, html, text } = otpEmail({ otp, appName, expiresInMinutes, purpose });

  try {
    await sendMail({ to: email, subject, html, text });
  } catch (err) {
    console.error('[send-otp] Gagal kirim email:', err.message);
    return json(res, 502, {
      success: false,
      error: 'Gagal mengirim email. Periksa konfigurasi SMTP di server.',
    });
  }

  const response = {
    success: true,
    message: 'OTP berhasil dikirim.',
    email: maskEmail(email),
    expiresIn: ttlSeconds,
    expiresInMinutes,
  };

  // Hanya untuk testing lokal — JANGAN aktifkan di production
  if (process.env.ALLOW_OTP_IN_RESPONSE === 'true') {
    response.otp = otp;
    response.warning = 'ALLOW_OTP_IN_RESPONSE aktif — jangan gunakan di production!';
  }

  return json(res, 200, response);
};

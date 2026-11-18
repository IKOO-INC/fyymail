'use strict';

const { handleCors, json, getBody, isValidEmail, normalizeEmail, maskEmail, checkRateLimit } = require('../lib/helpers');
const { isAuthorized } = require('../lib/auth');
const { sendMail } = require('../lib/mailer');

/**
 * Endpoint email generik (selain OTP).
 * Body: { to, subject, html?, text? }
 * Wajib API key. Rate limit lebih longgar.
 */
module.exports = async (req, res) => {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return json(res, 405, { success: false, error: 'Method tidak diizinkan. Gunakan POST.' });
  }

  if (!isAuthorized(req)) {
    return json(res, 401, { success: false, error: 'API key tidak valid atau tidak ada. Kirim header x-api-key.' });
  }

  const body = getBody(req);
  const toRaw = body.to || body.email || '';
  const subject = String(body.subject || '').slice(0, 200);
  const html = body.html ? String(body.html).slice(0, 50000) : undefined;
  const text = body.text ? String(body.text).slice(0, 50000) : undefined;

  if (!isValidEmail(toRaw)) {
    return json(res, 400, { success: false, error: 'Format email tujuan tidak valid.' });
  }
  if (!subject) {
    return json(res, 400, { success: false, error: 'Subject wajib diisi.' });
  }
  if (!html && !text) {
    return json(res, 400, { success: false, error: 'Isi email wajib diisi (html atau text).' });
  }

  const email = normalizeEmail(toRaw);
  const rl = checkRateLimit(`send-email:${email}`, 20, 600);
  if (!rl.allowed) {
    return json(res, 429, { success: false, error: 'Terlalu banyak permintaan. Coba lagi nanti.' });
  }

  try {
    await sendMail({ to: email, subject, html, text });
  } catch (err) {
    console.error('[send-email] Gagal kirim email:', err.message);
    return json(res, 502, { success: false, error: 'Gagal mengirim email. Periksa konfigurasi SMTP di server.' });
  }

  return json(res, 200, { success: true, message: 'Email berhasil dikirim.', email: maskEmail(email) });
};

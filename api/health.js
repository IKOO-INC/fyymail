'use strict';

const { handleCors, json } = require('../lib/helpers');
const { hasRedis } = require('../lib/otp-store');

module.exports = (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') {
    return json(res, 405, { success: false, error: 'Method tidak diizinkan. Gunakan GET.' });
  }
  return json(res, 200, {
    success: true,
    service: 'fyymotion-auth',
    from: process.env.SMTP_FROM || 'Fyymotion <fyymotion@noreply>',
    status: 'ok',
    time: new Date().toISOString(),
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    redisConfigured: hasRedis(),
  });
};

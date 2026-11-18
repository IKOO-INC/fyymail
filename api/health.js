'use strict';

const { handleCors, json } = require('../lib/helpers');
const { hasRedis } = require('../lib/otp-store');

module.exports = (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') {
    return json(res, 405, { success: false, error: 'Method tidak diizinkan. Gunakan GET.' });
  }
  const isEthereal = (process.env.TEMP_MAIL || '').toLowerCase() === 'true' || (process.env.SMTP_HOST || '').toLowerCase() === 'ethereal';
  return json(res, 200, {
    success: true,
    service: 'fyymotion-auth',
    from: process.env.SMTP_FROM || (isEthereal ? 'Fyymotion <noreply@ethereal.email>' : 'Fyymotion <noreply@fyymotion.com>'),
    status: 'ok',
    time: new Date().toISOString(),
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) || isEthereal,
    redisConfigured: hasRedis(),
    mode: isEthereal ? 'temp-mail (ethereal)' : 'smtp',
    subjectPrefix: process.env.SUBJECT_PREFIX || '[noreply]',
  });
};

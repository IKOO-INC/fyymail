'use strict';

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('Konfigurasi SMTP belum lengkap. Cek env: SMTP_HOST, SMTP_USER, SMTP_PASS');
  }

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE.toLowerCase() === 'true'
    : port === 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure, // true untuk 465 (SSL), false untuk 587 (STARTTLS)
    auth: { user, pass },
    // Timeout agar tidak menggantung di serverless
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  return transporter;
}

function getFrom() {
  // PENTING: Format email harus local@domain dengan domain valid (ada TLD)
  // Salah: noreply@fyymotion.com (domain "noreply" tidak valid, tanpa TLD)
  // Benar: noreply@fyymotion.com atau Fyymotion <noreply@fyymotion.com>
  // Mailjet WAJIB validasi sender dulu di: https://app.mailjet.com/account/sender
  // Kalau belum validasi dalam 3 hari, email akan diblokir!
  // SMTP_USER/PASS tetap akun asli provider untuk login SMTP.
  return process.env.SMTP_FROM || 'Fyymotion <noreply@fyymotion.com>';
}

/**
 * Kirim email via SMTP.
 * @param {{ to: string, subject: string, html?: string, text?: string }} opts
 */
async function sendMail({ to, subject, html, text }) {
  const tx = getTransporter();
  const info = await tx.sendMail({
    from: getFrom(),
    to,
    subject,
    html,
    text: text || (html ? undefined : ''),
  });
  return info;
}

module.exports = { sendMail, getTransporter, getFrom };

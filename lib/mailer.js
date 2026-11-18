'use strict';

const nodemailer = require('nodemailer');

let transporter = null;
let etherealAccount = null;

function isEtherealMode() {
  // Aktif kalau TEMP_MAIL=true atau SMTP_HOST=ethereal
  const host = (process.env.SMTP_HOST || '').toLowerCase();
  const tempFlag = (process.env.TEMP_MAIL || '').toLowerCase();
  return tempFlag === 'true' || tempFlag === '1' || host === 'ethereal' || host === 'ethereal.email';
}

async function getTransporter() {
  if (transporter) return transporter;

  // MODE 1: Ethereal temp mail (no validasi domain, auto-create akun)
  if (isEtherealMode()) {
    console.log('[mailer] TEMP_MAIL mode aktif — pakai Ethereal.email');
    try {
      const testAccount = await nodemailer.createTestAccount();
      etherealAccount = testAccount;
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      console.log('[mailer] Ethereal akun dibuat:', testAccount.user);
      return transporter;
    } catch (e) {
      console.error('[mailer] Gagal buat Ethereal account:', e.message);
      throw new Error('Gagal buat temp mail Ethereal: ' + e.message);
    }
  }

  // MODE 2: SMTP normal (Mailjet/Gmail/Brevo dll)
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('Konfigurasi SMTP belum lengkap. Cek env: SMTP_HOST, SMTP_USER, SMTP_PASS. Atau set TEMP_MAIL=true untuk pakai Ethereal temp mail');
  }

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE.toLowerCase() === 'true'
    : port === 465;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });

  return transporter;
}

function getFrom() {
  // Ethereal mode: pakai user ethereal kalau SMTP_FROM tidak di-set
  if (isEtherealMode()) {
    return process.env.SMTP_FROM || (etherealAccount ? `Fyymotion <${etherealAccount.user}>` : 'Fyymotion <noreply@ethereal.email>');
  }
  // PENTING: Format email harus local@domain dengan domain valid (ada TLD)
  // Salah: fyymotion@noreply (domain "noreply" tidak valid, tanpa TLD)
  // Benar: noreply@fyymotion.com atau Fyymotion <noreply@fyymotion.com>
  // Mailjet WAJIB validasi sender dulu di: https://app.mailjet.com/account/sender
  // Kalau belum validasi dalam 3 hari, email akan diblokir!
  return process.env.SMTP_FROM || 'Fyymotion <noreply@fyymotion.com>';
}

/**
 * Kirim email via Resend HTTP API (jika RESEND_API_KEY ada) atau SMTP.
 */
async function sendMail({ to, subject, html, text }) {
  // MODE 0: Resend HTTP API (paling stabil, hidden Gmail, gratis 3000/bulan)
  const resendKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS?.startsWith('re_') ? process.env.SMTP_PASS : null;
  const resendApiKey = process.env.RESEND_API_KEY || (resendKey && resendKey.startsWith('re_') ? resendKey : null);
  if (resendApiKey) {
    const from = getFrom();
    // Resend free tanpa verifikasi domain cuma boleh onboarding@resend.dev
    const safeFrom = from.includes('noreply@fyymotion.com') && !process.env.RESEND_FROM_VERIFIED ? 'Fyymotion <onboarding@resend.dev>' : from;
    const body = {
      from: safeFrom,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || undefined,
      text: text || (html ? undefined : ''),
    };
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('[mailer] Resend API error:', r.status, data);
      throw new Error(`Resend API ${r.status}: ${JSON.stringify(data)}`);
    }
    console.log('[mailer] Resend sent:', data.id);
    return { messageId: data.id, response: `250 Resend ${data.id}` };
  }

  const tx = await getTransporter();
  const info = await tx.sendMail({
    from: getFrom(),
    to,
    subject,
    html,
    text: text || (html ? undefined : ''),
  });

  // Kalau Ethereal, log preview URL biar bisa cek email tanpa inbox beneran
  if (isEtherealMode() && info.messageId) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('[mailer] Preview URL (Ethereal):', previewUrl);
      info.previewUrl = previewUrl;
    }
  }

  return info;
}

function isEtherealActive() {
  return isEtherealMode();
}

module.exports = { sendMail, getTransporter, getFrom, isEtherealActive, isEtherealMode };
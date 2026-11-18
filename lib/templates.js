'use strict';

/** Escape HTML untuk input user (appName, purpose) */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Template email OTP — responsif, aman di Gmail/Outlook/Yahoo.
 */
function otpEmail({ otp, appName = 'Fyymotion', expiresInMinutes = 10, purpose }) {
  const app = esc(appName);
  const purposeText = purpose ? ` untuk <strong>${esc(purpose)}</strong>` : '';

  // Subject prefix [noreply] biar jelas ini email otomatis jangan dibalas
  const prefix = process.env.SUBJECT_PREFIX || '[noreply]';
  const subject = `${prefix} Kode OTP ${app}: ${otp}`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Kode OTP ${app}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#4f46e5;padding:28px 32px;text-align:center;">
            <div style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:0.5px;">${app}</div>
            <div style="color:#c7d2fe;font-size:13px;margin-top:4px;">Kode Verifikasi Akun</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;text-align:center;">
            <p style="margin:0 0 8px;color:#374151;font-size:15px;line-height:1.6;">
              Halo, gunakan kode OTP berikut${purposeText}:
            </p>
            <div style="margin:20px 0;padding:18px 12px;background:#eef2ff;border:2px dashed #a5b4fc;border-radius:12px;">
              <span style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#3730a3;">${esc(otp)}</span>
            </div>
            <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
              Kode ini berlaku selama <strong>${expiresInMinutes} menit</strong>.<br/>
              Jangan bagikan kode ini kepada siapa pun.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 28px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
              Jika Anda tidak meminta kode ini, abaikan email ini.<br/>
              &copy; ${new Date().getFullYear()} ${app}. Email ini dikirim otomatis, jangan dibalas.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Kode OTP ${appName}: ${otp}\n\nKode ini berlaku selama ${expiresInMinutes} menit. Jangan bagikan kode ini kepada siapa pun.\nJika Anda tidak meminta kode ini, abaikan email ini.`;

  return { subject, html, text };
}

/** Template generik untuk /api/send-email */
function genericEmail({ subject, html, text }) {
  return { subject, html, text };
}

module.exports = { otpEmail, genericEmail, esc };

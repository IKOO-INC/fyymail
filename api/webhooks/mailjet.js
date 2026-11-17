'use strict';

/**
 * Mailjet Webhook Handler
 * Docs: https://dev.mailjet.com/docs/email-api/webhooks/webhooks-overview
 *
 * Mailjet akan POST JSON ke URL ini setiap ada event: sent, open, click, bounce, spam, blocked, unsub
 * - Harus balas 200 OK, kalau tidak Mailjet akan retry tiap 30 detik selama 24 jam
 * - Payload bisa berupa 1 object atau array of objects (grouped events v2)
 * - Disarankan pakai HTTPS + Basic Auth: https://user:pass@auth-fyymotion.vercel.app/api/webhooks/mailjet
 *
 * ENV yang dipakai (set di Vercel > Settings > Environment Variables):
 * - MAILJET_WEBHOOK_TOKEN  (opsional) - kalau di-set, request harus bawa token yang sama via header x-mailjet-token / Authorization Bearer / ?token=
 * - MAILJET_WEBHOOK_USER + MAILJET_WEBHOOK_PASS (opsional) - kalau di-set, request harus pakai Basic Auth user:pass
 * - WEBHOOK_FORWARD_URL (opsional) - kalau di-set, setiap event akan di-forward async ke URL ini (POST JSON)
 * - UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (opsional) - kalau ada, event disimpan 7 hari untuk audit
 */

const { handleCors, json, getBody } = require('../../lib/helpers');

// Helpers untuk auth webhook
function parseBasicAuth(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return null;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    if (sep === -1) return null;
    return { user: decoded.slice(0, sep), pass: decoded.slice(sep + 1) };
  } catch {
    return null;
  }
}

function isWebhookAuthorized(req) {
  const tokenEnv = process.env.MAILJET_WEBHOOK_TOKEN;
  const userEnv = process.env.MAILJET_WEBHOOK_USER;
  const passEnv = process.env.MAILJET_WEBHOOK_PASS;

  // Kalau tidak ada env auth sama sekali, izinkan semua (tapi log warning)
  if (!tokenEnv && !userEnv && !passEnv) return { ok: true, method: 'none' };

  // 1. Cek token (paling fleksibel untuk Mailjet custom header)
  if (tokenEnv) {
    const provided =
      req.headers['x-mailjet-token'] ||
      req.headers['x-webhook-token'] ||
      req.headers['x-api-key'] ||
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim() ||
      (req.query && req.query.token) ||
      (req.query && req.query.key) ||
      '';

    // Juga cek raw querystring kalau req.query belum ter-parse
    let qsToken = '';
    if (req.url && req.url.includes('token=')) {
      try {
        const u = new URL(req.url, 'http://localhost');
        qsToken = u.searchParams.get('token') || u.searchParams.get('key') || '';
      } catch {}
    }

    const finalProvided = provided || qsToken;
    if (finalProvided && finalProvided === tokenEnv) {
      return { ok: true, method: 'token' };
    }
    // Kalau tokenEnv ada tapi tidak cocok, lanjut cek Basic Auth sebagai fallback
    // Jangan langsung reject, karena Mailjet kadang cuma support Basic Auth
  }

  // 2. Cek Basic Auth
  if (userEnv && passEnv) {
    const basic = parseBasicAuth(req);
    if (basic && basic.user === userEnv && basic.pass === passEnv) {
      return { ok: true, method: 'basic' };
    }
    // Juga terima kalau user kirim via URL user:pass -> Vercel teruskan sebagai Authorization header
    // Di atas sudah di-handle
  }

  // Kalau salah satu env ada tapi tidak ada yang cocok -> tolak
  // Tapi jika cuma tokenEnv yang ada dan request tidak bawa token sama sekali, tolak
  if (tokenEnv || (userEnv && passEnv)) {
    return { ok: false, method: 'none' };
  }

  return { ok: true, method: 'none' };
}

// Simpan event ke Redis (fire-and-forget, jangan bikin webhook timeout)
async function storeEventRedis(event) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;

  try {
    const key = 'mailjet:webhook:log';
    const payload = JSON.stringify({ ...event, _receivedAt: new Date().toISOString() });
    // LPUSH + LTRIM biar cuma simpan 500 terbaru, EXPIRE 7 hari
    await fetch(`${url}/lpush/${encodeURIComponent(key)}/${encodeURIComponent(payload)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Trim async tanpa await ketat
    fetch(`${url}/ltrim/${encodeURIComponent(key)}/0/499`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
    fetch(`${url}/expire/${encodeURIComponent(key)}/604800`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});

    // Simpan per-email juga untuk debug OTP: mailjet:events:email@example.com
    if (event.email) {
      const emailKey = `mailjet:events:${String(event.email).toLowerCase()}`;
      fetch(`${url}/lpush/${encodeURIComponent(emailKey)}/${encodeURIComponent(payload)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
      fetch(`${url}/expire/${encodeURIComponent(emailKey)}/604800`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
      fetch(`${url}/ltrim/${encodeURIComponent(emailKey)}/0/99`, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[mailjet-webhook] Redis store gagal:', err.message);
  }
}

// Forward ke URL lain (misal ke backend utama kamu)
async function forwardEvent(forwardUrl, events) {
  if (!forwardUrl) return;
  try {
    await fetch(forwardUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-mailjet-forwarded': 'true' },
      body: JSON.stringify({ source: 'mailjet', events, forwardedAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('[mailjet-webhook] Forward gagal:', err.message);
  }
}

module.exports = async (req, res) => {
  // CORS tetap dipasang biar bisa test dari dashboard internal, tapi Mailjet server-to-server tidak butuh CORS
  if (handleCors(req, res)) return;

  // GET = health/info untuk cek webhook terpasang
  if (req.method === 'GET') {
    const hasToken = Boolean(process.env.MAILJET_WEBHOOK_TOKEN);
    const hasBasic = Boolean(process.env.MAILJET_WEBHOOK_USER && process.env.MAILJET_WEBHOOK_PASS);
    const hasRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
    const hasForward = Boolean(process.env.WEBHOOK_FORWARD_URL);
    return json(res, 200, {
      success: true,
      service: 'fyymotion-auth',
      webhook: 'mailjet',
      status: 'ready',
      endpoint: '/api/webhooks/mailjet',
      method: 'POST',
      authConfigured: hasToken || hasBasic,
      authMethods: {
        token: hasToken,
        basic: hasBasic,
        none: !hasToken && !hasBasic,
      },
      redisConfigured: hasRedis,
      forwardConfigured: hasForward,
      forwardUrl: hasForward ? process.env.WEBHOOK_FORWARD_URL : null,
      time: new Date().toISOString(),
      docs: 'https://dev.mailjet.com/docs/email-api/webhooks/webhooks-overview',
      setup: {
        step1: 'Di Mailjet: Account > Account settings > Event tracking (Triggers) > buat URL webhook',
        step2: 'URL webhook kamu: https://auth-fyymotion.vercel.app/api/webhooks/mailjet',
        step3BasicAuth: 'Opsional Basic Auth: https://user:pass@auth-fyymotion.vercel.app/api/webhooks/mailjet (set MAILJET_WEBHOOK_USER & MAILJET_WEBHOOK_PASS di Vercel)',
        step3Token: 'Opsional Token: set MAILJET_WEBHOOK_TOKEN di Vercel, lalu di Mailjet tambahkan custom header x-mailjet-token atau ?token=xxx di URL',
        events: ['sent', 'open', 'click', 'bounce', 'spam', 'blocked', 'unsub'],
      },
    });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { success: false, error: 'Method tidak diizinkan. Gunakan POST untuk webhook, GET untuk cek status.' });
  }

  // Auth check (kalau env auth di-set)
  const auth = isWebhookAuthorized(req);
  if (!auth.ok) {
    console.warn('[mailjet-webhook] Unauthorized request dari', req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown');
    return json(res, 401, { success: false, error: 'Webhook unauthorized. Cek MAILJET_WEBHOOK_TOKEN atau Basic Auth.' });
  }

  // Parse body - Mailjet kirim JSON object atau array
  let body = getBody(req);
  // getBody sudah handle string/object, tapi untuk webhook Mailjet kadang raw body perlu di-handle manual
  // Pastikan kita juga coba baca req.body mentah kalau getBody kosong
  if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
    // Coba baca dari req.body yang mungkin sudah di-parse Vercel sebagai string
    if (typeof req.body === 'string' && req.body.trim()) {
      try {
        body = JSON.parse(req.body);
      } catch {}
    }
  }

  // Normalisasi jadi array of events
  let events = [];
  if (Array.isArray(body)) {
    events = body;
  } else if (body && typeof body === 'object' && body.event) {
    // Single event object
    events = [body];
  } else if (body && typeof body === 'object' && Array.isArray(body.events)) {
    events = body.events;
  } else if (body && typeof body === 'object' && Object.keys(body).length > 0) {
    // Fallback: anggap 1 event
    events = [body];
  } else {
    console.warn('[mailjet-webhook] Body kosong atau format tidak dikenal:', body);
    // Tetap return 200 biar Mailjet tidak retry terus, tapi kasih info
    return json(res, 200, { success: true, received: 0, message: 'Body kosong, tapi diterima (200 agar tidak retry).' });
  }

  // Validasi & logging cepat (best practice: proses async, balas 200 secepatnya)
  const validEvents = [];
  const invalidEvents = [];

  for (const ev of events) {
    if (!ev || typeof ev !== 'object' || !ev.event || !ev.email) {
      invalidEvents.push(ev);
      continue;
    }
    // Normalisasi field
    const normalized = {
      event: String(ev.event).toLowerCase(), // sent, open, click, bounce, spam, blocked, unsub
      email: String(ev.email).toLowerCase().trim(),
      time: ev.time || Math.floor(Date.now() / 1000),
      MessageID: ev.MessageID || ev.mj_message_id || null,
      Message_GUID: ev.Message_GUID || null,
      mj_campaign_id: ev.mj_campaign_id ?? null,
      mj_contact_id: ev.mj_contact_id ?? null,
      customcampaign: ev.customcampaign || null,
      CustomID: ev.CustomID || null,
      Payload: ev.Payload || null,
      // Event-specific
      ip: ev.ip || null,
      geo: ev.geo || null,
      agent: ev.agent || null,
      url: ev.url || null,
      blocked: ev.blocked ?? null,
      hard_bounce: ev.hard_bounce ?? null,
      error_related_to: ev.error_related_to || null,
      error: ev.error || null,
      comment: ev.comment || null,
      smtp_reply: ev.smtp_reply || null,
      source: ev.source || null,
      mj_list_id: ev.mj_list_id ?? null,
    };
    validEvents.push(normalized);

    // Log ke Vercel logs (akan muncul di Dashboard > Logs)
    const logLine = `[mailjet-webhook] ${normalized.event} | ${normalized.email} | MessageID:${normalized.MessageID} | ${normalized.error || normalized.smtp_reply || ''}`;
    console.log(logLine);

    // Simpan async tanpa await (fire-and-forget biar cepat 200)
    // Tapi kita await di bawah secara paralel dengan Promise.allSettled tanpa block lama
  }

  // Proses async storage & forward tanpa menahan response > 1 detik
  // Gunakan Promise.allSettled tapi dengan timeout
  const forwardUrl = process.env.WEBHOOK_FORWARD_URL;
  const promises = [];

  for (const ev of validEvents) {
    promises.push(storeEventRedis(ev));
  }
  if (forwardUrl && validEvents.length > 0) {
    promises.push(forwardEvent(forwardUrl, validEvents));
  }

  // Jangan await terlalu lama - set timeout 2 detik
  if (promises.length > 0) {
    await Promise.race([
      Promise.allSettled(promises),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  }

  // Selalu 200 biar Mailjet tidak retry
  return json(res, 200, {
    success: true,
    received: validEvents.length,
    invalid: invalidEvents.length,
    events: validEvents.map((e) => ({ event: e.event, email: e.email, MessageID: e.MessageID })),
    message: `${validEvents.length} event diterima.`,
    warning: invalidEvents.length ? `${invalidEvents.length} event invalid diabaikan.` : undefined,
  });
};

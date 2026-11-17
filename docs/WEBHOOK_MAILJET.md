# 📬 Webhook Mailjet — Tracking Email

Fyymotion Auth punya endpoint untuk terima event tracking dari Mailjet. Web Utama bisa pakai untuk tau apakah email OTP sudah terkirim, di-bounce, atau di-spam.

> Docs resmi Mailjet: https://dev.mailjet.com/docs/email-api/webhooks/webhooks-overview
> Endpoint Fyymotion Auth: `https://auth-fyymotion.vercel.app/api/webhooks/mailjet`

---

## Apa Itu Webhook?

Setiap email yang dikirim via Mailjet, Mailjet akan POST JSON ke URL Web Utama untuk kasih tau status:

- `sent` — SMTP tujuan terima email
- `open` — User buka email
- `click` — User klik link di email
- `bounce` — Email mental (hard/soft)
- `blocked` — Diblokir Mailjet
- `spam` — User tandai spam
- `unsub` — User unsubscribe

Ini **jangan** di-poll. Mailjet yang push ke kamu (“don’t call us, we’ll call you”).

---

## Setup di Mailjet

### 1. Dapatkan Webhook URL Fyymotion Auth

```
https://auth-fyymotion.vercel.app/api/webhooks/mailjet
```

Cek status (GET):
```bash
curl https://auth-fyymotion.vercel.app/api/webhooks/mailjet
```
Response:
```json
{
  "success": true,
  "webhook": "mailjet",
  "status": "ready",
  "authConfigured": true,
  "endpoint": "/api/webhooks/mailjet",
  "setup": { "step1": "...", ... }
}
```

### 2. Pasang di Mailjet Dashboard

Mailjet → **Account → Account settings → Event tracking (Triggers)**

Tambah URL webhook:
```
https://auth-fyymotion.vercel.app/api/webhooks/mailjet?token=TOKEN_KAMU
```

Pilih events yang mau di-track:
- ✅ `sent` (disarankan pakai version 2 — grouped events)
- ✅ `open`, `click`
- ✅ `bounce`, `blocked`, `spam`, `unsub`

Simpan.

### 3. Auth (Opsional tapi Disarankan)

Mailjet support 2 cara auth:

**Opsi A — Token (paling gampang):**
1. Set di Vercel: `MAILJET_WEBHOOK_TOKEN=token-acak-panjang`
2. Di Mailjet, tambah `?token=xxx` di URL atau header `x-mailjet-token`

**Opsi B — Basic Auth:**
1. Set di Vercel: `MAILJET_WEBHOOK_USER=user` + `MAILJET_WEBHOOK_PASS=pass`
2. Di Mailjet, pakai URL: `https://user:pass@auth-fyymotion.vercel.app/api/webhooks/mailjet`

Jika tidak set ENV auth, semua request diizinkan (untuk testing).

> Saat ini di Vercel sudah terpasang: `MAILJET_WEBHOOK_TOKEN=379448037a74f7dc9a28d98b8dee6e2c32d7de6ec823e6fd`

---

## Cara Kerja di Fyymotion Auth

```
Mailjet  --POST {event, email, MessageID}-->  Fyymotion Auth /api/webhooks/mailjet
                                                    │
                                                    ├─→ Log ke Vercel Logs
                                                    ├─→ Simpan ke Redis (7 hari) jika ada UPSTASH_REDIS...
                                                    └─→ Forward ke WEBHOOK_FORWARD_URL (jika di-set)
                                                            │
                                                            └─→ Web Utama /api/mailjet-events
```

**Best practice yang sudah diimplement:**
- Balas `200` secepatnya (jangan tunggu DB), biar Mailjet tidak retry
- Proses async (store ke Redis + forward) dengan timeout 2 detik
- Jika bukan `200`, Mailjet retry tiap 30 detik selama 24 jam → jadi **wajib** 200

---

## Forward ke Web Utama (Opsional)

Kalau Web Utama mau terima event juga:

1. Set di Vercel Fyymotion Auth:
   ```
   WEBHOOK_FORWARD_URL=https://web-utama.com/api/mailjet-events
   ```
2. Di Web Utama, buat endpoint:

```javascript
// web-utama/app/api/mailjet-events/route.js
export async function POST(req) {
  const { source, events, forwardedAt } = await req.json();
  // events = array of Mailjet events
  for (const ev of events) {
    console.log(`[Mailjet] ${ev.event} - ${ev.email} - MessageID:${ev.MessageID}`);
    // TODO: simpan ke DB Web Utama, update status user, dll
    if (ev.event === 'bounce' && ev.hard_bounce) {
      // tandai email invalid, jangan kirim lagi
    }
    if (ev.event === 'spam') {
      // jangan kirim email promosi ke user ini
    }
  }
  return Response.json({ success: true });
}
```

Fyymotion Auth akan forward dengan header `x-mailjet-forwarded: true`.

---

## Format Event

Semua event punya field umum:

```json
{
  "event": "sent",
  "time": 1719300000,
  "email": "user@example.com",
  "MessageID": 123456789,
  "Message_GUID": "1ab23cd4-...",
  "mj_campaign_id": 123,
  "mj_contact_id": 456,
  "customcampaign": "",
  "CustomID": "helloworld",
  "Payload": ""
}
```

Field spesifik per event:

**`sent`:**
```json
{"event":"sent","smtp_reply":"sent (250 OK)","mj_message_id":"123"}
```

**`open`:**
```json
{"event":"open","ip":"1.2.3.4","geo":"US","agent":"Mozilla/5.0"}
```

**`click`:**
```json
{"event":"click","url":"https://example.com","ip":"1.2.3.4","geo":"FR","agent":"..."}
```

**`bounce`:**
```json
{
  "event":"bounce",
  "blocked": false,
  "hard_bounce": true,
  "error_related_to": "recipient",
  "error": "user unknown",
  "comment": "Host not found. Name service error..."
}
```

**`blocked`:**
```json
{"event":"blocked","error_related_to":"recipient","error":"user unknown"}
```

**`spam`:**
```json
{"event":"spam","source":"JMRPP"}
```

**`unsub`:**
```json
{"event":"unsub","mj_list_id":1,"ip":"1.2.3.4","geo":"FR","agent":"..."}
```

Lihat lengkap: https://dev.mailjet.com/docs/email-api/webhooks/event-types

---

## Testing Webhook

Tanpa harus kirim email beneran, bisa test manual:

```bash
# Test tanpa auth (jika MAILJET_WEBHOOK_TOKEN belum di-set)
curl -X POST https://auth-fyymotion.vercel.app/api/webhooks/mailjet \
  -H "Content-Type: application/json" \
  -d '{"event":"sent","email":"test@example.com","MessageID":123,"time":'$(date +%s)'}'

# Test dengan token
curl -X POST "https://auth-fyymotion.vercel.app/api/webhooks/mailjet?token=379448037a74f7dc9a28d98b8dee6e2c32d7de6ec823e6fd" \
  -H "Content-Type: application/json" \
  -d '[{"event":"bounce","email":"bounce@example.com","error":"user unknown","hard_bounce":true}]'

# Test open
curl -X POST "https://auth-fyymotion.vercel.app/api/webhooks/mailjet?token=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":"open","email":"user@example.com","ip":"1.2.3.4","geo":"US","agent":"Mozilla/5.0"}'

# Cek Vercel Logs harus muncul:
# [mailjet-webhook] sent | test@example.com | MessageID:123
```

---

## ENV yang Perlu di Vercel

| Variable | Wajib | Contoh | Keterangan |
|---|---|---|---|
| `MAILJET_WEBHOOK_TOKEN` | ❌ | `token-acak-panjang` | Jika di-set, webhook harus bawa token yang sama |
| `MAILJET_WEBHOOK_USER` | ❌ | `myuser` | Basic Auth user (alternatif token) |
| `MAILJET_WEBHOOK_PASS` | ❌ | `mypass123` | Basic Auth pass |
| `WEBHOOK_FORWARD_URL` | ❌ | `https://web-utama.com/api/mailjet-events` | Forward event ke Web Utama |
| `UPSTASH_REDIS_REST_URL` | ❌ | `https://xxx.upstash.io` | Simpan log 7 hari |
| `UPSTASH_REDIS_REST_TOKEN` | ❌ | `xxx` | — |

Sudah terpasang di Vercel:
- `MAILJET_WEBHOOK_TOKEN=379448037a74f7dc9a28d98b8dee6e2c32d7de6ec823e6fd` (ganti kalau mau, Redeploy setelah ganti)

---

## Untuk SMTP via Mailjet (Bukan Webhook)

Kalau mau kirim OTP via Mailjet SMTP (bukan Gmail/Brevo):

```
SMTP_HOST=in-v3.mailjet.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=API_KEY_Mailjet
SMTP_PASS=Secret_Key_Mailjet
SMTP_FROM=Fyymotion <fyymotion@noreply>
```

Dapatkan API Key di: https://app.mailjet.com/account/apikeys

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Webhook tidak terpanggil | Cek di Mailjet dashboard apakah URL sudah Save. Test manual dengan curl di atas. Cek Vercel Logs. |
| `401 Webhook unauthorized` | Token/Basic Auth salah. Cek `MAILJET_WEBHOOK_TOKEN` di Vercel sama dengan `?token=` di URL Mailjet. |
| Mailjet retry terus | Pastikan endpoint selalu balas `200`. Cek di code: semua kasus invalid tetap `200` kecuali auth gagal. |
| Event tidak ke-forward ke Web Utama | Cek `WEBHOOK_FORWARD_URL` di Vercel, pastikan Web Utama balas `200` juga dalam 5 detik. |

---

Lihat juga: [API Spec](./API_SPEC.md) dan [Integration Web Utama](./INTEGRATION_WEB_UTAMA.md)

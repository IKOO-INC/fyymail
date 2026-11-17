# 🔌 API Specification — Fyymotion Auth

Base URL: `https://auth-fyymotion.vercel.app`

Semua response JSON. Time dalam ISO8601 UTC, kecuali webhook Mailjet pakai Unix timestamp.

---

## Authentication

Semua endpoint kecuali `GET /api/health` dan `GET /api/webhooks/mailjet` **wajib** API Key.

Kirim via salah satu header:

```http
x-api-key: YOUR_API_KEY
# atau
Authorization: Bearer YOUR_API_KEY
```

`API_KEYS` di Vercel bisa banyak (pisah koma):
```
API_KEYS=key-untuk-web-utama,key-untuk-website-lain-1,key-untuk-app-mobile
```

Jika key salah / tidak ada → `401`:
```json
{"success":false,"error":"API key tidak valid atau tidak ada. Kirim header x-api-key."}
```

Comparison pakai `timingSafeEqual` (anti timing-attack). Jika `API_KEYS` belum di-set di server → fail-closed (semua request ditolak).

---

## 1. Health Check

Cek apakah API hidup + konfigurasi SMTP/Redis.

### `GET /api/health`
Alias: `GET /health`

**Auth:** tidak perlu

**Response `200`:**
```json
{
  "success": true,
  "service": "fyymotion-auth",
  "from": "Fyymotion <fyymotion@noreply>",
  "status": "ok",
  "time": "2026-06-25T10:00:00.000Z",
  "smtpConfigured": true,
  "redisConfigured": false
}
```

| Field | Type | Deskripsi |
|---|---|---|
| `smtpConfigured` | boolean | `true` kalau `SMTP_HOST/USER/PASS` sudah di-set di Vercel |
| `redisConfigured` | boolean | `true` kalau Redis Upstash aktif |

---

## 2. Send OTP

Generate OTP 6 digit, simpan hash, kirim email.

### `POST /api/send-otp`

**Auth:** wajib `x-api-key`

**Rate Limit:** 5 request / 10 menit **per email** (default `RATE_LIMIT_MAX=5`, `RATE_LIMIT_WINDOW_SECONDS=600`). Jika melebihi → `429`.

**Headers:**
```http
Content-Type: application/json
x-api-key: YOUR_API_KEY
```

**Body (JSON):**

| Field | Wajib | Type | Deskripsi | Contoh |
|---|---|---|---|---|
| `email` | ✅ | string | Email tujuan (validasi format) | `user@example.com` |
| `to` | ❌ | string | Alias untuk `email` | — |
| `appName` | ❌ | string | Nama app muncul di email, max 60 char. Default `Fyymotion` | `Fyymotion`, `Web Utama` |
| `app` | ❌ | string | Alias `appName` | — |
| `purpose` | ❌ | string | Tujuan, max 80 char, muncul di email | `verifikasi akun`, `reset password` |
| `otp` | ❌ | string (4-10 digit) | Kalau diisi, pakai OTP ini (bukan generate). Berguna kalau Web Utama mau generate & simpan sendiri. | `123456` |

**Contoh Request — OTP auto-generate:**
```json
{
  "email": "user@example.com",
  "appName": "Fyymotion",
  "purpose": "verifikasi akun"
}
```

**Contoh Request — OTP dari client (custom):**
```json
{
  "email": "user@example.com",
  "appName": "Fyymotion",
  "otp": "987654"
}
```

**Response Sukses `200`:**
```json
{
  "success": true,
  "message": "OTP berhasil dikirim.",
  "email": "u***@example.com",
  "expiresIn": 600,
  "expiresInMinutes": 10
}
```

| Field | Deskripsi |
|---|---|
| `email` | Email yang disamarkan (privacy) |
| `expiresIn` | TTL detik (default 600 = 10 menit, dari `OTP_TTL_SECONDS`) |
| `expiresInMinutes` | TTL menit (rounded) |

**Response Error:**

| Status | Body | Penyebab |
|---|---|---|
| `400` | `{"success":false,"error":"Format email tidak valid."}` | Email salah format |
| `400` | `{"success":false,"error":"OTP dari client harus berupa angka 4-10 digit."}` | `otp` custom tidak valid |
| `401` | `{"success":false,"error":"API key tidak valid..."}` | Key salah |
| `429` | `{"success":false,"error":"Terlalu banyak permintaan OTP..."}` | Rate limit |
| `502` | `{"success":false,"error":"Gagal mengirim email. Periksa konfigurasi SMTP di server."}` | SMTP gagal (cek Vercel Logs) |

**CORS:** Header `Access-Control-Allow-Origin` sesuai `ALLOWED_ORIGINS` di Vercel. Jika `*`, semua origin boleh. Disarankan set ke domain Web Utama di production.

**Catatan Keamanan:**
- OTP **tidak pernah** dikembalikan di response production (`ALLOW_OTP_IN_RESPONSE=false`)
- Hanya hash SHA-256 + salt yang disimpan (sekali pakai, max 5x coba, 10 menit expired)
- Jika Redis tidak ada, store di memory (bisa hilang kalau instance serverless restart — untuk production pasang Redis)

---

## 3. Verify OTP

Verifikasi kode yang di-input user.

### `POST /api/verify-otp`

**Auth:** wajib `x-api-key`

**Body:**

| Field | Wajib | Type | Deskripsi |
|---|---|---|---|
| `email` | ✅ | string | Harus sama persis dengan saat send-otp (case-insensitive) |
| `otp` | ✅ | string | Kode 4-10 digit. Alias: `code` |
| `code` | ❌ | string | Alias `otp` |
| `appName` | ❌ | string | Harus sama dengan saat send-otp. Default `Fyymotion` |

**Contoh:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "appName": "Fyymotion"
}
```

**Response Valid `200`:**
```json
{
  "success": true,
  "valid": true,
  "email": "u***@example.com",
  "message": "OTP valid."
}
```

**Response Tidak Valid `200` (bukan error HTTP, tapi `valid:false`):**
```json
{"success":false,"valid":false,"email":"u***@example.com","error":"Kode OTP salah."}
{"success":false,"valid":false,"email":"u***@example.com","error":"OTP tidak ditemukan atau sudah kedaluwarsa."}
{"success":false,"valid":false,"email":"u***@example.com","error":"OTP sudah kedaluwarsa."}
{"success":false,"valid":false,"email":"u***@example.com","error":"Terlalu banyak percobaan. Minta OTP baru."}
```

> `valid:false` tetap HTTP 200 biar frontend gampang handle tanpa try-catch error.

**Response Error (HTTP error):**

| Status | Penyebab |
|---|---|
| `400` | `email` invalid atau `otp` kosong / bukan 4-10 digit |
| `401` | API key salah |
| `405` | Method bukan POST |

**Behavior:**
- OTP **sekali pakai** — setelah `valid:true`, langsung dihapus. Verifikasi lagi dengan kode sama → `OTP tidak ditemukan...`
- Max attempts default 5 (`OTP_MAX_ATTEMPTS`). Setelah 5x salah → dihapus, user harus minta OTP baru.
- Comparison pakai `timingSafeEqual`.

---

## 4. Send Email (Generik)

Kirim email bebas (bukan OTP) — untuk notifikasi, welcome email, dll.

### `POST /api/send-email`

**Auth:** wajib `x-api-key`

**Rate Limit:** 20 / 10 menit per email tujuan.

**Body:**

| Field | Wajib | Type | Deskripsi |
|---|---|---|---|
| `to` | ✅ | string | Email tujuan. Alias `email` |
| `email` | ❌ | string | Alias `to` |
| `subject` | ✅ | string | Judul, max 200 char |
| `html` | ❌ | string | Body HTML, max 50k char. Salah satu `html`/`text` wajib ada |
| `text` | ❌ | string | Body text, max 50k char |

**Contoh:**
```json
{
  "to": "user@example.com",
  "subject": "Selamat datang di Fyymotion!",
  "html": "<h1>Halo!</h1><p>Akun kamu sudah aktif.</p>"
}
```

**Response `200`:**
```json
{"success":true,"message":"Email berhasil dikirim.","email":"u***@example.com"}
```

**Error:** `400` (field kosong/invalid), `401`, `429`, `502` (SMTP gagal).

---

## 5. Mailjet Webhook

Terima event tracking dari Mailjet.

### `GET /api/webhooks/mailjet`

Cek status webhook (tidak perlu auth Mailjet).

**Response `200`:**
```json
{
  "success": true,
  "service": "fyymotion-auth",
  "webhook": "mailjet",
  "status": "ready",
  "endpoint": "/api/webhooks/mailjet",
  "method": "POST",
  "authConfigured": true,
  "authMethods": {"token":true,"basic":false,"none":false},
  "redisConfigured": false,
  "forwardConfigured": false,
  "docs": "https://dev.mailjet.com/docs/email-api/webhooks/webhooks-overview",
  "setup": { ... }
}
```

### `POST /api/webhooks/mailjet`

Mailjet POST ke sini setiap ada event.

**Auth:** tergantung ENV di Vercel:
- Jika `MAILJET_WEBHOOK_TOKEN` di-set → harus bawa `?token=xxx` atau header `x-mailjet-token` atau `Authorization: Bearer xxx`
- Jika `MAILJET_WEBHOOK_USER`+`PASS` di-set → harus Basic Auth `user:pass`
- Jika tidak ada ENV auth → semua request diizinkan

**Body:** JSON object atau array:

```json
{"event":"sent","email":"user@example.com","MessageID":123,"time":1719300000}
```
atau
```json
[
  {"event":"open","email":"a@example.com","MessageID":1,"time":1719300001,"ip":"1.2.3.4","agent":"Mozilla/5.0"},
  {"event":"bounce","email":"b@example.com","error":"user unknown","hard_bounce":true,"time":1719300002}
]
```

Event types: `sent`, `open`, `click`, `bounce`, `spam`, `blocked`, `unsub`

**Response `200` (selalu 200 biar Mailjet tidak retry):**
```json
{
  "success": true,
  "received": 2,
  "invalid": 0,
  "events": [
    {"event":"open","email":"a@example.com","MessageID":1},
    {"event":"bounce","email":"b@example.com","MessageID":null}
  ],
  "message": "2 event diterima."
}
```

**Response `401`:** jika token/Basic Auth tidak cocok.

Lihat detail lengkap di [WEBHOOK_MAILJET.md](./WEBHOOK_MAILJET.md).

---

## Error Codes Global

| Status | Arti | Action Web Utama |
|---|---|---|
| `200` | Sukses (termasuk `valid:false` untuk verify) | — |
| `400` | Input invalid | Tampilkan `error` ke user, perbaiki request |
| `401` | API key salah | Cek `x-api-key`, tanya DevOps |
| `405` | Method salah | Pakai POST |
| `429` | Rate limit | Tampilkan "coba lagi dalam X menit", jangan spam retry |
| `502` | SMTP gagal | Cek log Vercel, coba lagi nanti |

Semua error body:
```json
{"success":false,"error":"pesan indonesia"}
```

---

## Rate Limit Detail

In-memory per instance (jika tanpa Redis). Untuk production disarankan Redis.

- `POST /api/send-otp`: `RATE_LIMIT_MAX` (default 5) per `RATE_LIMIT_WINDOW_SECONDS` (default 600) per `email`
- `POST /api/send-email`: 20 / 600 per `email`
- `POST /api/verify-otp`: tidak ada rate limit global, tapi max attempts per OTP (default 5)

---

## CORS

Diatur via `ALLOWED_ORIGINS` di Vercel:

```
ALLOWED_ORIGINS=https://web-utama.com,https://admin.web-utama.com
# atau
ALLOWED_ORIGINS=*  (untuk dev, jangan di prod)
```

Server-to-server (backend → backend) CORS tidak berpengaruh.

---

## Versi & Changelog

- `v1.0.0` — Initial: send-otp, verify-otp, send-email, health
- `v1.1.0` — Tambah webhook Mailjet, SMTP Mailjet, forward URL, Redis log

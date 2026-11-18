# 🔌 API Specification — Fyymotion Auth

Base URL:
```
Prod   : https://auth-fyymotion.vercel.app
Preview: https://auth-fyymotion-git-arena-d4a3315d-fyymail-yoo23mann.vercel.app
```

Semua response JSON. Time ISO8601 UTC.

> **Auth: TIDAK PAKAI APIKEY** — private untuk pribadi. Semua endpoint bisa dipanggil langsung tanpa header `x-api-key`.

---

## 1. Health Check

### `GET /api/health`
Alias: `GET /health`

**Auth:** tidak perlu

**Response `200`:**
```json
{
  "success": true,
  "service": "fyymotion-auth",
  "from": "Fyymotion <noreply@fyymotion.com>",
  "status": "ok",
  "time": "2026-01-01T00:00:00.000Z",
  "smtpConfigured": true,
  "redisConfigured": false,
  "mode": "temp-mail (ethereal)",
  "subjectPrefix": "[noreply]"
}
```

| Field | Type | Deskripsi |
|-------|------|-----------|
| `from` | string | Pengirim email (kalau temp-mail → `noreply@ethereal.email`) |
| `smtpConfigured` | boolean | `true` kalau SMTP siap |
| `redisConfigured` | boolean | `true` kalau Redis Upstash aktif |
| `mode` | string | `temp-mail (ethereal)` atau `smtp` |
| `subjectPrefix` | string | Prefix subject, default `[noreply]` |

---

## 2. Send OTP

Generate OTP 6 digit, simpan hash, kirim email.

### `GET /api/send-otp` atau `POST /api/send-otp`

**Auth:** tidak perlu

**Rate Limit:** 5 request / 10 menit **per email** (ENV `RATE_LIMIT_MAX=5`, `RATE_LIMIT_WINDOW_SECONDS=600`). Melebihi → `429`.

**Method:** `GET` (query) atau `POST` (JSON) — keduanya sama. GET paling enak buat tes di browser.

#### GET Query Params:

```
GET /api/send-otp?email=user@example.com&appName=Fyymotion&purpose=verifikasi%20akun&otp=123456
```

| Param | Wajib | Type | Deskripsi |
|-------|-------|------|-----------|
| `email` | ✅ | string | Email tujuan |
| `to` | ❌ | string | Alias `email` |
| `appName` | ❌ | string | Nama app di email, max 60 char. Default `Fyymotion` |
| `app` | ❌ | string | Alias `appName` |
| `purpose` | ❌ | string | Tujuan, max 80 char |
| `otp` | ❌ | string | 4-10 digit custom, kalau tidak diisi generate otomatis |

#### POST Body (JSON):

| Field | Wajib | Type | Deskripsi |
|-------|-------|------|-----------|
| `email` | ✅ | string | Email tujuan |
| `to` | ❌ | string | Alias `email` |
| `appName` | ❌ | string | Default `Fyymotion` |
| `purpose` | ❌ | string | Max 80 char |
| `otp` | ❌ | string | 4-10 digit custom |

**Contoh GET:**
```
https://auth-fyymotion.vercel.app/api/send-otp?email=user@example.com&appName=Fyymotion
```

**Contoh POST:**
```json
{
  "email": "user@example.com",
  "appName": "Fyymotion",
  "purpose": "verifikasi akun"
}
```

**Response Sukses `200`:**

*Mode SMTP (email masuk inbox beneran):*
```json
{
  "success": true,
  "message": "OTP berhasil dikirim.",
  "email": "u***@example.com",
  "expiresIn": 600,
  "expiresInMinutes": 10
}
```

*Mode temp-mail (Ethereal):*
```json
{
  "success": true,
  "message": "OTP berhasil dikirim.",
  "email": "u***@example.com",
  "expiresIn": 600,
  "expiresInMinutes": 10,
  "previewUrl": "https://ethereal.email/message/xxxxx",
  "mode": "temp-mail",
  "note": "Mode temp mail aktif — cek previewUrl untuk lihat email"
}
```

> Subject email: `[noreply] Kode OTP Fyymotion: 123456` (prefix dari ENV `SUBJECT_PREFIX`, default `[noreply]`)

**Response Error:**

| Status | Body | Penyebab |
|--------|------|----------|
| `400` | `Format email tidak valid.` | Email salah format |
| `400` | `OTP dari client harus berupa angka 4-10 digit.` | `otp` custom invalid |
| `405` | `Method tidak diizinkan. Gunakan GET atau POST.` | Method selain GET/POST |
| `429` | `Terlalu banyak permintaan OTP...` | Rate limit |
| `502` | `Gagal mengirim email. Periksa konfigurasi SMTP.` | SMTP gagal |

**Catatan:**
- OTP tidak pernah dibalik di response kecuali `ALLOW_OTP_IN_RESPONSE=true` (hanya dev)
- Hash disimpan, sekali pakai, max 5x coba, expired 10 menit (ENV `OTP_TTL_SECONDS`)
- Tanpa Redis → in-memory (hilang kalau serverless restart)

---

## 3. Verify OTP

### `GET /api/verify-otp` atau `POST /api/verify-otp`

**Auth:** tidak perlu

#### GET Query:

```
GET /api/verify-otp?email=user@example.com&otp=123456&appName=Fyymotion
```

| Param | Wajib | Type |
|-------|-------|------|
| `email` | ✅ | string |
| `otp` | ✅ | string 4-10 digit, alias `code` |
| `code` | ❌ | alias `otp` |
| `appName` | ❌ | string, harus sama dengan send-otp |

#### POST Body:

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

**Response Tidak Valid `200` (valid:false):**
```json
{"success":false,"valid":false,"email":"u***@example.com","error":"Kode OTP salah."}
{"success":false,"valid":false,"email":"u***@example.com","error":"OTP tidak ditemukan atau sudah kedaluwarsa."}
{"success":false,"valid":false,"email":"u***@example.com","error":"OTP sudah kedaluwarsa."}
{"success":false,"valid":false,"email":"u***@example.com","error":"Terlalu banyak percobaan. Minta OTP baru."}
```

> `valid:false` tetap HTTP 200 biar frontend gampang handle.

**Error HTTP:**

| Status | Penyebab |
|--------|----------|
| `400` | email invalid / otp kosong bukan 4-10 digit |
| `405` | Method bukan GET/POST |

**Behavior:**
- Sekali pakai — setelah `valid:true` langsung hapus
- Max 5x salah (`OTP_MAX_ATTEMPTS`) → hapus, minta baru

---

## 4. Send Email (Generik)

Kirim email bebas.

### `POST /api/send-email` (juga support GET)

**Auth:** tidak perlu  
**Rate Limit:** 20 / 10 menit per email

**Body:**

| Field | Wajib | Type |
|-------|-------|------|
| `to` | ✅ | Email tujuan, alias `email` |
| `subject` | ✅ | Max 200 char |
| `html` | ❌ | Max 50k, salah satu `html`/`text` wajib ada |
| `text` | ❌ | Max 50k |

**Contoh:**
```json
{
  "to": "user@example.com",
  "subject": "Selamat datang!",
  "html": "<h1>Halo!</h1><p>Akun aktif.</p>"
}
```

**Response `200`:**
```json
{"success":true,"message":"Email berhasil dikirim.","email":"u***@example.com"}
```

---

## 5. Mailjet Webhook

### `GET /api/webhooks/mailjet`

Status webhook.

**Response `200`:**
```json
{
  "success": true,
  "service": "fyymotion-auth",
  "webhook": "mailjet",
  "status": "ready",
  "endpoint": "/api/webhooks/mailjet",
  "authConfigured": true
}
```

### `POST /api/webhooks/mailjet`

Mailjet POST ke sini.

**Auth webhook:** jika `MAILJET_WEBHOOK_TOKEN` set → harus `?token=xxx` atau header `x-mailjet-token` atau `Bearer`.

**Body:** object/array:
```json
{"event":"sent","email":"user@example.com","MessageID":123,"time":1719300000}
```

Event: `sent`, `open`, `click`, `bounce`, `spam`, `blocked`, `unsub`

Lihat [WEBHOOK_MAILJET.md](./WEBHOOK_MAILJET.md).

---

## Error Codes Global

| Status | Arti |
|--------|------|
| `200` | Sukses (termasuk `valid:false`) |
| `400` | Input invalid |
| `405` | Method salah (pakai GET/POST) |
| `429` | Rate limit |
| `502` | SMTP gagal |

Semua error:
```json
{"success":false,"error":"pesan indonesia"}
```

---

## CORS

ENV `ALLOWED_ORIGINS`:
```
ALLOWED_ORIGINS=*  # dev
ALLOWED_ORIGINS=https://web-utama.com  # prod
```

Server-to-server CORS tidak ngaruh.

---

## ENV Penting

| ENV | Default | Deskripsi |
|-----|---------|-----------|
| `TEMP_MAIL` | `false` | `true` → Ethereal temp mail (previewUrl) |
| `SMTP_HOST` | — | `ethereal` juga trigger temp-mail |
| `SUBJECT_PREFIX` | `[noreply]` | Prefix subject |
| `OTP_LENGTH` | `6` | Panjang OTP |
| `OTP_TTL_SECONDS` | `600` | TTL detik |
| `OTP_MAX_ATTEMPTS` | `5` | Max coba |
| `RATE_LIMIT_MAX` | `5` | Rate limit per email |
| `ALLOW_OTP_IN_RESPONSE` | `false` | `true` → balikin otp di response (dev only) |

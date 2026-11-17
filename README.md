# Fyymotion Auth — API SMTP untuk Kirim OTP

API serverless di **Vercel** untuk mengirim email OTP akun ke website lain.
Cukup deploy sekali, lalu panggil dari backend website mana pun via HTTP API.

**Live:** https://auth-fyymotion.vercel.app

```
Website Lain (Backend)  --POST /api/send-otp-->  Fyymotion Auth (Vercel)  --SMTP-->  Gmail / Brevo / Resend / dll  -->  Inbox User
Website Lain (Backend)  --POST /api/verify-otp->  Fyymotion Auth (Vercel)
```

## Tanpa Akun?

**Betul — API ini tanpa akun user.** Tidak ada daftar, login, atau database akun.
Website lain cukup panggil API dengan header `x-api-key` (API key yang kamu buat sendiri).

**Tapi SMTP tetap butuh akun provider** (Gmail / Brevo / Resend / dll) untuk login
dan benar-benar mengirim email. Tidak ada SMTP yang bisa kirim tanpa akun —
provider selalu minta `SMTP_USER` + `SMTP_PASS` (App Password).

Pengirimnya dibuat gaya umum seperti layanan lain:

```
Fyymotion <fyymotion@noreply>
```

`SMTP_FROM` di atas hanya **tampilan pengirim** di inbox. Akun SMTP aslinya
(`SMTP_USER`/`SMTP_PASS`) tetap akun provider yang terverifikasi.
Kalau provider menolak From yang belum terverifikasi, ganti `SMTP_FROM` di Vercel
ke alamat terverifikasi, mis. `Fyymotion <noreply@domain-kamu.com>`.

## Fitur

- Kirim OTP 6 digit via SMTP (Gmail, Brevo, Resend, Mailgun, Outlook, dll)
- Generate OTP otomatis + simpan hash-nya (OTP asli tidak disimpan)
- Endpoint verifikasi OTP (`/api/verify-otp`), OTP sekali pakai, maks. 5x percobaan
- Auth pakai **API Key** (`x-api-key`) — website lain tidak bisa spam tanpa key
- Rate limit per email (default 5x / 10 menit)
- CORS support untuk pemanggilan dari domain tertentu
- Template email OTP responsif (bagus di Gmail, Outlook, Yahoo, HP)
- Endpoint email generik (`/api/send-email`) untuk notifikasi lain
- Webhook Mailjet (`/api/webhooks/mailjet`) untuk tracking sent/open/click/bounce/spam/blocked/unsub
- Opsional: Upstash Redis agar OTP konsisten di semua instance Vercel

## Struktur Project

```
fyymail/
├── api/
│   ├── health.js              # GET  /api/health       — cek status server
│   ├── send-otp.js            # POST /api/send-otp     — kirim OTP ke email
│   ├── verify-otp.js          # POST /api/verify-otp   — verifikasi kode OTP
│   ├── send-email.js          # POST /api/send-email   — kirim email bebas
│   └── webhooks/
│       └── mailjet.js         # POST /api/webhooks/mailjet — terima event Mailjet
├── lib/
│   ├── mailer.js       # koneksi SMTP (nodemailer)
│   ├── otp-store.js    # generate + simpan hash OTP (memory / Redis)
│   ├── templates.js    # template HTML email OTP
│   ├── auth.js         # cek API key
│   └── helpers.js      # CORS, validasi, rate limit
├── examples/
│   └── client.js       # contoh panggil dari backend website lain
├── scripts/
│   └── smoke-test.js   # test lokal (npm test)
├── .env.example        # contoh semua env variable
├── vercel.json
└── package.json
```

## Cara Deploy ke Vercel

Project live: **auth-fyymotion** → https://auth-fyymotion.vercel.app

### 1. Push ke GitHub
```bash
git add .
git commit -m "Fyymotion Auth: API SMTP OTP"
git push origin arena/d4a3315d-fyymail
```

### 2. Import di Vercel (kalau deploy ulang)
1. Buka [vercel.com/new](https://vercel.com/new) → Import repo ini
2. Project Name: `auth-fyymotion`
3. Framework Preset: **Other** (tidak perlu build)
4. Klik **Deploy**

### 3. Isi Environment Variables
Di Vercel: **Project → Settings → Environment Variables**, tambahkan:

| Variable | Contoh | Keterangan |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | Host SMTP provider |
| `SMTP_PORT` | `587` | `465` = SSL, `587` = STARTTLS |
| `SMTP_SECURE` | `false` | `true` kalau port 465 |
| `SMTP_USER` | `emailkamu@gmail.com` | Username SMTP (akun asli provider) |
| `SMTP_PASS` | `xxxx xxxx xxxx xxxx` | Password / App Password SMTP |
| `SMTP_FROM` | `Fyymotion <fyymotion@noreply>` | Tampilan pengirim (gaya umum) |
| `API_KEYS` | `key-acak-panjang-...` | API key untuk website lain (pisahkan koma kalau banyak) |
| `ALLOWED_ORIGINS` | `https://websiteku.com` | Domain yang boleh memanggil (atau `*`) |
| `MAILJET_WEBHOOK_TOKEN` | `token-acak-...` | (Opsional Mailjet) Token webhook |
| `MAILJET_WEBHOOK_USER` | `user` | (Opsional Mailjet) Basic Auth user |
| `MAILJET_WEBHOOK_PASS` | `pass-panjang` | (Opsional Mailjet) Basic Auth pass |
| `WEBHOOK_FORWARD_URL` | `https://...` | (Opsional) Forward event ke backend utama |

Lalu **Redeploy** agar env terbaca.

> Generate API key acak: `openssl rand -hex 32`

### 4. (Opsional tapi disarankan) Upstash Redis
Tanpa Redis, OTP disimpan di memory instance — di Vercel serverless bisa hilang
kalau instance berganti. Untuk production:
1. Buat Redis gratis di [upstash.com](https://upstash.com)
2. Tambahkan env: `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN`
3. Redeploy

## Cara Dapat SMTP

### Opsi A: Gmail (paling cepat untuk testing)
1. Aktifkan **2-Step Verification** di akun Google kamu
2. Buat **App Password**: Google Account → Security → App passwords
   (16 karakter, bukan password Gmail biasa)
3. Pakai sebagai `SMTP_PASS`

### Opsi B: Brevo (disarankan untuk production, gratis 300 email/hari)
1. Daftar di [brevo.com](https://www.brevo.com) → SMTP & API
2. Verifikasi domain/email pengirim
3. Pakai kredensial SMTP dari dashboard Brevo

### Opsi C: Resend
1. Daftar di [resend.com](https://resend.com) → verifikasi domain
2. Buat API key, pakai `smtp.resend.com:587` dengan user `resend`

### Opsi D: Mailjet (support webhook tracking)
1. Daftar di [mailjet.com](https://www.mailjet.com) → Account > API Keys
2. SMTP: `in-v3.mailjet.com:587` (STARTTLS), `SMTP_USER` = API Key, `SMTP_PASS` = Secret Key
3. Webhook: `Account > Account settings > Event tracking (Triggers)` → tambah URL: `https://auth-fyymotion.vercel.app/api/webhooks/mailjet`
   - Pilih event: `sent`, `open`, `click`, `bounce`, `spam`, `blocked`, `unsub`
   - Opsional auth: tambahkan `?token=xxx` di URL atau pakai `https://user:pass@...` (set env `MAILJET_WEBHOOK_TOKEN` / `MAILJET_WEBHOOK_USER`+`PASS` di Vercel)
   - Cek status: `GET https://auth-fyymotion.vercel.app/api/webhooks/mailjet`
   - Docs: https://dev.mailjet.com/docs/email-api/webhooks/webhooks-overview

## Cara Pakai dari Website Lain

**Penting:** panggil API ini dari **backend** website kamu (server-side),
jangan dari browser — API key akan bocor kalau dipanggil dari frontend.

Lihat contoh lengkap di [`examples/client.js`](examples/client.js).

### Kirim OTP

```bash
curl -X POST https://auth-fyymotion.vercel.app/api/send-otp \
  -H "Content-Type: application/json" \
  -H "x-api-key: KEY-KAMU" \
  -d '{
    "email": "user@example.com",
    "appName": "Fyymotion",
    "purpose": "verifikasi akun"
  }'
```

Response sukses:
```json
{
  "success": true,
  "message": "OTP berhasil dikirim.",
  "email": "u***@example.com",
  "expiresIn": 600,
  "expiresInMinutes": 10
}
```

### Verifikasi OTP

```bash
curl -X POST https://auth-fyymotion.vercel.app/api/verify-otp \
  -H "Content-Type: application/json" \
  -H "x-api-key: KEY-KAMU" \
  -d '{
    "email": "user@example.com",
    "otp": "123456",
    "appName": "Fyymotion"
  }'
```

Response:
```json
{ "success": true, "valid": true, "email": "u***@example.com", "message": "OTP valid." }
```

### Kirim Email Bebas (selain OTP)

```bash
curl -X POST https://auth-fyymotion.vercel.app/api/send-email \
  -H "Content-Type: application/json" \
  -H "x-api-key: KEY-KAMU" \
  -d '{
    "to": "user@example.com",
    "subject": "Selamat datang!",
    "html": "<p>Halo, selamat datang di Fyymotion</p>"
  }'
```

### Cek Status Server

```bash
curl https://auth-fyymotion.vercel.app/api/health
```

### Cek Status Webhook Mailjet

```bash
curl https://auth-fyymotion.vercel.app/api/webhooks/mailjet
```

### Kirim Event Mailjet Manual (test)

```bash
curl -X POST https://auth-fyymotion.vercel.app/api/webhooks/mailjet \
  -H "Content-Type: application/json" \
  -d '{"event":"sent","email":"user@example.com","MessageID":123,"time":'$(date +%s)'}'
# Jika pakai token:
curl -X POST "https://auth-fyymotion.vercel.app/api/webhooks/mailjet?token=TOKEN-KAMU" \
  -H "Content-Type: application/json" \
  -d '[{"event":"bounce","email":"bounce@example.com","error":"user unknown","hard_bounce":true}]'
```

## Dokumentasi API

### `POST /api/send-otp`
| Field | Wajib | Keterangan |
|---|---|---|
| `email` | ✅ | Email tujuan |
| `appName` | ❌ | Nama website kamu (muncul di email), default `Fyymotion` |
| `purpose` | ❌ | Contoh: `verifikasi akun`, `reset password` |
| `otp` | ❌ | Kalau diisi, OTP dari client yang dipakai (client yang generate & simpan di DB sendiri). Kalau kosong, Fyymotion Auth yang generate |

### `POST /api/verify-otp`
| Field | Wajib | Keterangan |
|---|---|---|
| `email` | ✅ | Email yang sama saat kirim OTP |
| `otp` / `code` | ✅ | Kode 4-10 digit dari user |
| `appName` | ❌ | Harus sama dengan saat kirim OTP |

### `POST /api/send-email`
| Field | Wajib | Keterangan |
|---|---|---|
| `to` | ✅ | Email tujuan |
| `subject` | ✅ | Judul email |
| `html` / `text` | ✅ | Salah satu wajib diisi |

### `POST /api/webhooks/mailjet` (Mailjet Event Webhook)
| Field | Keterangan |
|---|---|
| `event` | `sent` / `open` / `click` / `bounce` / `spam` / `blocked` / `unsub` |
| `email` | Email penerima |
| `MessageID` | ID pesan dari Mailjet |
| `time` | Unix timestamp |
| `error` / `comment` | (hanya bounce/blocked) detail error |

Webhook selalu balas `200` agar Mailjet tidak retry. Jika `MAILJET_WEBHOOK_TOKEN` di-set, harus kirim `?token=xxx` atau header `x-mailjet-token`. Jika Basic Auth di-set, pakai `https://user:pass@auth-fyymotion.vercel.app/api/webhooks/mailjet`.

### Error Codes
| Status | Arti |
|---|---|
| `400` | Input tidak valid (email salah, OTP kosong, dll) |
| `401` | API key salah / tidak ada |
| `405` | Method tidak diizinkan (pakai POST) |
| `429` | Terlalu banyak request (rate limit) |
| `502` | Gagal kirim email — cek konfigurasi SMTP |

## Development Lokal

```bash
npm install
cp .env.example .env.local   # isi SMTP + API_KEYS
npm run dev                  # vercel dev -> http://localhost:3000
npm test                     # smoke test (tanpa SMTP asli)
```

## Keamanan

- OTP asli **tidak pernah disimpan** — hanya hash SHA-256 + salt
- OTP sekali pakai, kedaluwarsa 10 menit, maks. 5x percobaan salah
- Semua endpoint (kecuali health) wajib API key, dibandingkan dengan timing-safe
- Rate limit per email untuk mencegah spam
- Error SMTP tidak dibocorkan ke client (hanya di-log di server)
- `ALLOW_OTP_IN_RESPONSE` **jangan** diaktifkan di production

## Troubleshooting

| Masalah | Solusi |
|---|---|
| `401 API key tidak valid` | Cek header `x-api-key` & env `API_KEYS` di Vercel, lalu redeploy |
| `502 Gagal mengirim email` | Cek `SMTP_HOST/PORT/USER/PASS`, lihat log di Vercel Dashboard → Logs |
| Gmail: `535 BadCredentials` | Pakai **App Password** (bukan password biasa), aktifkan 2FA dulu |
| Provider menolak `fyymotion@noreply` | Ganti `SMTP_FROM` ke alamat terverifikasi, mis. `Fyymotion <noreply@domain-kamu.com>` |
| Email masuk spam | Verifikasi domain (SPF/DKIM) di Brevo/Resend, pakai domain sendiri untuk `SMTP_FROM` |
| OTP tidak bisa diverifikasi | Pastikan `appName` & email sama persis; untuk production pasang Upstash Redis |
| `429 Terlalu banyak` | Tunggu 10 menit atau naikkan `RATE_LIMIT_MAX` |

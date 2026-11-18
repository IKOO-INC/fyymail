# Fyymotion Auth — API SMTP untuk Kirim OTP

[![Live](https://img.shields.io/badge/Live-auth--fyymotion.vercel.app-4f46e5?style=flat)](https://auth-fyymotion.vercel.app/api/health)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=flat&logo=vercel)](https://vercel.com)

API serverless di **Vercel** untuk kirim email OTP.  
**Private — tanpa apikey, support GET.** Cukup buka URL langsung kekirim!

**Live:** `https://auth-fyymotion.vercel.app` · Preview: `https://auth-fyymotion-git-arena-d4a3315d-fyymail-yoo23mann.vercel.app` · Pengirim `Fyymotion <noreply@fyymotion.com>` (atau Ethereal kalau `TEMP_MAIL=true`)

```
Browser / Web Utama --GET /api/send-otp?email=-->  Fyymotion Auth (Vercel) --SMTP--> Inbox User
Web Utama --GET /api/verify-otp?email=&otp=--> Fyymotion Auth
```

---

## 📚 Dokumentasi untuk Aplikasi Utama

| Dokumen | Deskripsi |
|---------|-----------|
| [📖 **Index**](./docs/README.md) | Daftar semua docs |
| [⚡ **Quick Start — 5 Menit**](./docs/QUICKSTART.md) | Paste URL di browser langsung kirim |
| [🔌 **API Spec**](./docs/API_SPEC.md) | Detail endpoint GET/POST + error |
| [🏗️ **Integrasi Web Utama**](./docs/INTEGRATION_WEB_UTAMA.md) | Step-by-step checklist |
| [💻 **Contoh Code**](./docs/EXAMPLES.md) | Node.js, PHP Laravel, Python |
| [📬 **Webhook Mailjet**](./docs/WEBHOOK_MAILJET.md) | Tracking sent/open/bounce |
| [🚀 **Deployment**](./docs/DEPLOYMENT.md) | ENV & deploy Vercel |

**Cukup butuh di Web Utama:**
```env
FYMAIL_URL=https://auth-fyymotion.vercel.app
# tanpa API_KEY lagi!
```

---

## Cara Pakai Cepat (Tanpa APIKEY)

```bash
# GET — buka di browser juga bisa!
curl "https://auth-fyymotion.vercel.app/api/send-otp?email=user@example.com&appName=Fyymotion"

# Verify
curl "https://auth-fyymotion.vercel.app/api/verify-otp?email=user@example.com&otp=123456"

# Health
curl https://auth-fyymotion.vercel.app/api/health

# POST juga tetap bisa
curl -X POST https://auth-fyymotion.vercel.app/api/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","appName":"Fyymotion"}'
```

Response temp-mail:
```json
{
  "success": true,
  "email": "u***@example.com",
  "expiresIn": 600,
  "previewUrl": "https://ethereal.email/message/...",
  "mode": "temp-mail"
}
```
Buka `previewUrl` buat lihat email (mode Ethereal). Mode SMTP real masuk inbox beneran dengan subject `[noreply] Kode OTP Fyymotion: 123456`.

---

## Fitur

- Kirim OTP 6 digit via SMTP (Mailjet/Gmail/Brevo) atau **temp-mail Ethereal** (`TEMP_MAIL=true`)
- Subject `[noreply]` (ENV `SUBJECT_PREFIX`)
- GET & POST, tanpa apikey, CORS, rate limit 5/10 menit per email
- Verify sekali pakai, max 5x coba, expired 10 menit
- Template email responsif + send-email generik
- Webhook Mailjet + Redis opsional

## Struktur

```
fyymail/
├── api/
│   ├── health.js              # GET  /api/health
│   ├── send-otp.js            # GET|POST /api/send-otp?email=
│   ├── verify-otp.js          # GET|POST /api/verify-otp?email=&otp=
│   ├── send-email.js          # POST /api/send-email
│   └── webhooks/mailjet.js    # POST /api/webhooks/mailjet
├── lib/                       # mailer, otp-store, templates, helpers
├── docs/                      # 📚 dokumentasi
├── scripts/smoke-test.js
├── .env.example
└── vercel.json
```

## Development Lokal

```bash
npm install
cp .env.example .env.local
npm run dev   # vercel dev -> http://localhost:3000
npm test      # smoke test (tanpa SMTP)
```

## ENV di Vercel

| Variable | Contoh |
|----------|--------|
| `TEMP_MAIL` | `true` = Ethereal temp-mail (previewUrl) |
| `SUBJECT_PREFIX` | `[noreply]` |
| `SMTP_HOST` | `in-v3.mailjet.com` / `ethereal` |
| `SMTP_FROM` | `Fyymotion <noreply@fyymotion.com>` |
| `API_KEYS` | tidak perlu lagi (dihapus) |

Full list: [.env.example](./.env.example) + [DEPLOYMENT.md](./docs/DEPLOYMENT.md)

---

**Tim Web Utama:** ikuti [INTEGRATION_WEB_UTAMA.md](./docs/INTEGRATION_WEB_UTAMA.md) — 15 menit siap.

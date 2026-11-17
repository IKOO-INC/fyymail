# Fyymotion Auth — API SMTP untuk Kirim OTP

[![Live](https://img.shields.io/badge/Live-auth--fyymotion.vercel.app-4f46e5?style=flat)](https://auth-fyymotion.vercel.app/api/health)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?style=flat&logo=vercel)](https://vercel.com)
[![Mailjet](https://img.shields.io/badge/Mailjet-Webhook-orange?style=flat)](https://dev.mailjet.com/docs/email-api/webhooks/webhooks-overview)

API serverless di **Vercel** untuk mengirim email OTP ke website lain.  
Cukup deploy sekali, lalu panggil dari backend mana pun via HTTP.

**Live:** `https://auth-fyymotion.vercel.app` · **Pengirim:** `Fyymotion <fyymotion@noreply>` · **Tanpa akun** — cukup `x-api-key`

```
Website Lain (Backend) --POST /api/send-otp-->  Fyymotion Auth (Vercel) --SMTP--> Gmail / Brevo / Mailjet --> Inbox User
Website Lain (Backend) --POST /api/verify-otp-> Fyymotion Auth
Mailjet --POST /api/webhooks/mailjet--> Fyymotion Auth --forward--> Web Utama (opsional)
```

---

## 📚 Dokumentasi untuk Web Utama

> **Tim Web Utama WAJIB baca ini dulu:**

| Dokumen | Deskripsi |
|---|---|
| [📖 **Dokumentasi Lengkap**](./docs/README.md) | Index semua docs |
| [⚡ **Quick Start — 5 Menit**](./docs/QUICKSTART.md) | Mulai langsung coba |
| [🔌 **API Spec**](./docs/API_SPEC.md) | Detail semua endpoint + error code |
| [🏗️ **Integrasi Web Utama**](./docs/INTEGRATION_WEB_UTAMA.md) | **Step-by-step checklist — baca ini!** |
| [💻 **Contoh Code**](./docs/EXAMPLES.md) | Copy-paste Node.js, PHP Laravel, Python |
| [📬 **Webhook Mailjet**](./docs/WEBHOOK_MAILJET.md) | Tracking sent/open/bounce/spam |
| [🚀 **Deployment**](./docs/DEPLOYMENT.md) | ENV & deploy di Vercel |

**Untuk Web Utama, cukup butuh:**
```env
FYMAIL_URL=https://auth-fyymotion.vercel.app
FYMAIL_API_KEY=key-dari-devops
```

Lihat [INTEGRATION_WEB_UTAMA.md](./docs/INTEGRATION_WEB_UTAMA.md) untuk contoh Express, Next.js, Laravel, Flask lengkap.

---

## Tanpa Akun?

**Betul — API tanpa daftar/login.** Web lain cukup header `x-api-key`.  
Tapi SMTP tetap butuh akun provider (Gmail/Brevo/Mailjet) untuk login & kirim — `SMTP_USER`+`PASS` di Vercel. `SMTP_FROM` hanya tampilan `fyymotion@noreply`.

---

## Fitur

- Kirim OTP 6 digit via SMTP (Gmail, Brevo, Resend, **Mailjet**)
- Generate OTP otomatis + simpan hash (OTP asli tidak disimpan)
- Verifikasi OTP sekali pakai, max 5x coba, expired 10 menit
- Auth API Key + Rate limit per email (5x/10 menit) + CORS
- Template email responsif + Email generik (`/api/send-email`)
- Webhook Mailjet (`sent/open/click/bounce/spam/blocked/unsub`) + forward ke Web Utama
- Opsional Redis (Upstash) biar OTP konsisten multi-instance

## Struktur Project

```
fyymail/
├── api/
│   ├── health.js              # GET  /api/health
│   ├── send-otp.js            # POST /api/send-otp
│   ├── verify-otp.js          # POST /api/verify-otp
│   ├── send-email.js          # POST /api/send-email
│   └── webhooks/mailjet.js    # POST /api/webhooks/mailjet
├── lib/                       # mailer, otp-store, templates, auth, helpers
├── examples/client.js         # contoh Node.js
├── docs/                      # 📚 dokumentasi lengkap (baca ini!)
│   ├── QUICKSTART.md
│   ├── API_SPEC.md
│   ├── INTEGRATION_WEB_UTAMA.md
│   ├── WEBHOOK_MAILJET.md
│   ├── EXAMPLES.md
│   └── DEPLOYMENT.md
├── scripts/smoke-test.js
├── .env.example
├── vercel.json
└── package.json
```

## Cara Pakai Cepat

```bash
# Kirim OTP
curl -X POST https://auth-fyymotion.vercel.app/api/send-otp \
  -H "Content-Type: application/json" \
  -H "x-api-key: KEY-KAMU" \
  -d '{"email":"user@example.com","appName":"Fyymotion"}'

# Verifikasi OTP
curl -X POST https://auth-fyymotion.vercel.app/api/verify-otp \
  -H "Content-Type: application/json" \
  -H "x-api-key: KEY-KAMU" \
  -d '{"email":"user@example.com","otp":"123456"}'

# Cek status
curl https://auth-fyymotion.vercel.app/api/health
curl https://auth-fyymotion.vercel.app/api/webhooks/mailjet
```

> **PENTING:** Panggil dari **backend** Web Utama, jangan dari browser — API key bocor!

Lihat [docs/EXAMPLES.md](./docs/EXAMPLES.md) untuk PHP Laravel & Python.

## ENV di Vercel

| Variable | Contoh |
|---|---|
| `SMTP_HOST` | `in-v3.mailjet.com` / `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | API Key Mailjet / email |
| `SMTP_PASS` | Secret Key / App Password |
| `SMTP_FROM` | `Fyymotion <fyymotion@noreply>` |
| `API_KEYS` | `key-acak-panjang` |
| `MAILJET_WEBHOOK_TOKEN` | `token-webhook` |
| `WEBHOOK_FORWARD_URL` | `https://web-utama.com/api/mailjet-events` |

Full list: [.env.example](./.env.example) + [DEPLOYMENT.md](./docs/DEPLOYMENT.md)

## Development Lokal

```bash
npm install
cp .env.example .env.local
npm run dev   # vercel dev -> http://localhost:3000
npm test      # smoke test
```

---

**FYI Web Utama:** Semua docs sudah di GitHub (`IKOO-INC/fyymail`). Tim Web Utama tinggal ikut [INTEGRATION_WEB_UTAMA.md](./docs/INTEGRATION_WEB_UTAMA.md) checklist — 30 menit siap.

# 🚀 Deployment — Fyymotion Auth

---

## Status Saat Ini

- **Repo:** `IKOO-INC/fyymail`
- **Branch:** `arena/d4a3315d-fyymail` (active)
- **Vercel Project:** `auth-fyymotion` (`prj_cGl86Y79K2ZRa4q6hh1RbhGOIZd7`)
- **Team:** `yoo23mann` (`team_Rq5A9a5gNMxWLzHYCBZuPMnl`)
- **Domain target:** `https://auth-fyymotion.vercel.app`
- **Git setting:** `createDeployments: disabled` — jadi push ke GitHub **tidak auto-deploy**, harus manual trigger.

---

## Cara Deploy (Manual Trigger)

Karena `createDeployments: disabled`, setelah push ke GitHub, lakukan:

**Opsi 1 — Vercel Dashboard:**
1. Buka Vercel → Project `auth-fyymotion` → Tab **Deployments**
2. Klik **Create Deployment**
3. Pilih Branch `arena/d4a3315d-fyymail` → **Deploy**
4. Tunggu sampai `Ready`

**Opsi 2 — Enable Auto Deploy:**
1. Vercel → Project `auth-fyymotion` → **Settings → Git**
2. Enable **Create Deployments** (atau **Connected Git Repository**)
3. Setelah itu setiap `git push` akan auto-deploy

**Opsi 3 — Vercel CLI (jika punya token):**
```bash
vercel --prod --yes
```

---

## Environment Variables di Vercel

Sudah terpasang di `auth-fyymotion`:

| Variable | Type | Value (contoh) | Keterangan |
|---|---|---|---|
| `API_KEYS` | encrypted | `a1b2c3...` | API key untuk Web Utama |
| `SMTP_FROM` | plain | `Fyymotion <fyymotion@noreply>` | Pengirim |
| `ALLOWED_ORIGINS` | plain | `*` | CORS |
| `OTP_LENGTH` | plain | `6` | Panjang OTP |
| `OTP_TTL_SECONDS` | plain | `600` | TTL 10 menit |
| `OTP_MAX_ATTEMPTS` | plain | `5` | Max coba |
| `RATE_LIMIT_MAX` | plain | `5` | Rate limit |
| `RATE_LIMIT_WINDOW_SECONDS` | plain | `600` | Window |
| `MAILJET_WEBHOOK_TOKEN` | encrypted | `3794480...` | Token webhook Mailjet |

**Yang perlu diisi manual (jika belum):**

```env
# SMTP — pilih salah satu provider:
SMTP_HOST=in-v3.mailjet.com        # atau smtp.gmail.com / smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=xxx                      # Mailjet API Key / Gmail / Brevo user
SMTP_PASS=xxx                      # Mailjet Secret / Gmail App Password

# Optional: Forward webhook ke Web Utama
WEBHOOK_FORWARD_URL=https://web-utama.com/api/mailjet-events

# Optional: Redis untuk konsistensi OTP multi-instance
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

Cara set:
1. Vercel → Project `auth-fyymotion` → **Settings → Environment Variables**
2. Add variable → pilih **Production + Preview + Development**
3. Save → **Redeploy** agar env terbaca

Generate key:
```bash
openssl rand -hex 32
```

---

## Domain

Target: `https://auth-fyymotion.vercel.app`

Sudah auto-assign dari Vercel (project name = `auth-fyymotion`). Jika mau custom domain `auth.fyymotion.com`:

1. Vercel → Project → **Settings → Domains**
2. Add `auth.fyymotion.com`
3. Ikuti instruksi DNS (CNAME ke `cname.vercel-dns.com`)

---

## Verifikasi Setelah Deploy

```bash
# Health
curl https://auth-fyymotion.vercel.app/api/health
# harus: {"success":true,"smtpConfigured":true,...}

# Webhook
curl https://auth-fyymotion.vercel.app/api/webhooks/mailjet
# harus: {"webhook":"mailjet","status":"ready",...}

# Test OTP (pakai API key asli)
curl -X POST https://auth-fyymotion.vercel.app/api/send-otp \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -d '{"email":"test@example.com","appName":"Fyymotion"}'
```

Cek **Vercel Logs** jika ada `502` atau `535`.

---

## Troubleshooting Deploy

| Masalah | Solusi |
|---|---|
| Push tidak deploy | Karena `createDeployments: disabled` → trigger manual di Dashboard |
| `functions` tidak kebaca | Cek `vercel.json` sudah ada `api/*.js` dan `api/**/*.js` |
| ENV tidak kebaca | Harus **Redeploy** setelah add ENV |
| Domain tidak aktif | Tunggu DNS propagate, cek di Domains tab |
| SMTP `535` | Pakai App Password Gmail, bukan password biasa. Untuk Mailjet pakai API Key/Secret |

---

## Struktur Project

```
fyymail/
├── api/
│   ├── health.js
│   ├── send-otp.js
│   ├── verify-otp.js
│   ├── send-email.js
│   └── webhooks/mailjet.js
├── lib/
│   ├── auth.js
│   ├── helpers.js
│   ├── mailer.js
│   ├── otp-store.js
│   └── templates.js
├── examples/client.js
├── docs/
│   ├── README.md
│   ├── QUICKSTART.md
│   ├── API_SPEC.md
│   ├── INTEGRATION_WEB_UTAMA.md
│   ├── WEBHOOK_MAILJET.md
│   ├── EXAMPLES.md
│   └── DEPLOYMENT.md
├── .env.example
├── vercel.json
└── package.json
```

---

## Changelog

- `v1.1.0` — Webhook Mailjet, docs lengkap untuk Web Utama
- `v1.0.0` — Initial OTP API

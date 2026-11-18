# 🚀 Deployment — Fyymotion Auth

---

## Status

- **Repo:** `IKOO-INC/fyymail`
- **Branch:** `arena/d4a3315d-fyymail` (active)
- **Vercel Project:** `auth-fyymotion` (`prj_cGl86Y79K2ZRa4q6hh1RbhGOIZd7`)
- **Team:** `yoo23mann`
- **Prod Domain:** `https://auth-fyymotion.vercel.app` (production branch `main`)
- **Preview Domain:** `https://auth-fyymotion-git-arena-d4a3315d-fyymail-yoo23mann.vercel.app` (branch ini, auto deploy)

> Push ke `arena/d4a3315d-fyymail` → auto deploy ke **Preview**. Merge ke `main` → **Production**.

---

## ENV di Vercel

### Sudah terpasang:

| Variable | Type | Contoh |
|----------|------|--------|
| `TEMP_MAIL` | plain | `true` → mode Ethereal temp-mail (previewUrl) |
| `SUBJECT_PREFIX` | plain | `[noreply]` |
| `SMTP_FROM` | plain | `Fyymotion <noreply@fyymotion.com>` |
| `SMTP_HOST` | plain | `in-v3.mailjet.com` / `ethereal` |
| `SMTP_PORT` | plain | `587` |
| `SMTP_USER` | encrypted | Mailjet API Key |
| `SMTP_PASS` | encrypted | Mailjet Secret |
| `API_KEYS` | encrypted | **tidak dipakai lagi** (private no auth) |
| `MAILJET_WEBHOOK_TOKEN` | encrypted | `3794480...` |

### Cara ganti mode:

| Mau apa | ENV | Action |
|---------|-----|--------|
| Testing tanpa inbox (Ethereal) | `TEMP_MAIL=true` | Redeploy → `mode: temp-mail`, cek `previewUrl` |
| Kirim ke Gmail beneran | `TEMP_MAIL=false` + `SMTP_HOST=in-v3.mailjet.com` + validasi sender Mailjet | Redeploy → `mode: smtp` |
| Ganti subject | `SUBJECT_PREFIX=[noreply]` atau `[Fyymotion]` | Redeploy |

Set di: Vercel → Project `auth-fyymotion` → Settings → Environment Variables → Save → Redeploy.

---

## Cara Deploy Manual

**Vercel Dashboard:**
1. Project `auth-fyymotion` → Deployments
2. Pilih deployment branch `arena/d4a3315d-fyymail` → Redeploy atau Promote to Production (kalau mau prod)
3. Tunggu `Ready`

**Promote Preview ke Prod:**
Deployments → Cari commit `47cfe7c` (no apikey) → `...` → Promote to Production

**Vercel CLI:**
```bash
vercel --prod --yes
```

---

## Verifikasi Setelah Deploy

```bash
# Health
curl https://auth-fyymotion.vercel.app/api/health
curl https://auth-fyymotion-git-arena-d4a3315d-fyymail-yoo23mann.vercel.app/api/health

# Test kirim (GET tanpa apikey)
curl "https://auth-fyymotion.vercel.app/api/send-otp?email=test@example.com"

# Harus balas: {"success":true, "previewUrl": "..."} atau tanpa previewUrl kalau mode smtp

# Test verify
curl "https://auth-fyymotion.vercel.app/api/verify-otp?email=test@example.com&otp=123456"
```

Cek **Vercel Logs** kalau `502`.

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `502 Gagal mengirim email` | Cek `GET /api/health` → `smtpConfigured:true`? Kalau temp-mail harus true. Kalau SMTP cek user/pass |
| Email ga masuk inbox (mode smtp) | Validasi sender `noreply@fyymotion.com` di Mailjet Dashboard → Senders & Domains |
| `previewUrl` ga ada | Karena mode `smtp`, bukan `temp-mail`. Set `TEMP_MAIL=true` kalau mau preview |
| ENV tidak kebaca | Harus Redeploy setelah add ENV |
| Domain prod masih lama | Karena prod = `main`, branch `arena/...` cuma preview. Merge ke main atau Promote |

---

## Struktur

```
fyymail/
├── api/
│   ├── health.js
│   ├── send-otp.js            # GET|POST ?email=
│   ├── verify-otp.js          # GET|POST ?email=&otp=
│   ├── send-email.js
│   └── webhooks/mailjet.js
├── lib/
│   ├── helpers.js (getParams, getQuery)
│   ├── mailer.js (TEMP_MAIL)
│   ├── otp-store.js
│   └── templates.js (SUBJECT_PREFIX)
├── docs/
├── .env.example
└── vercel.json
```

---

## Changelog

- `no-auth` — Hapus apikey, support GET ?email=, private
- `temp-mail` — Ethereal + [noreply] subject
- `v1.1.0` — Webhook Mailjet
- `v1.0.0` — Initial

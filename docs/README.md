# 📚 Dokumentasi Fyymotion Auth

API SMTP untuk kirim OTP — private, tanpa apikey, support GET.

**Live:** `https://auth-fyymotion.vercel.app` (prod)  
**Preview:** `https://auth-fyymotion-git-arena-d4a3315d-fyymail-yoo23mann.vercel.app`

---

## Dokumen

| Dokumen | Deskripsi |
|---------|-----------|
| [⚡ Quick Start](./QUICKSTART.md) | Mulai 5 menit — buka URL di browser langsung kirim |
| [🔌 API Spec](./API_SPEC.md) | Detail endpoint GET/POST + error code |
| [🏗️ Integrasi Web Utama](./INTEGRATION_WEB_UTAMA.md) | Checklist step-by-step |
| [💻 Contoh Code](./EXAMPLES.md) | Node.js, PHP Laravel, Python — copy paste |
| [📬 Webhook Mailjet](./WEBHOOK_MAILJET.md) | Tracking sent/open/bounce |
| [🚀 Deployment](./DEPLOYMENT.md) | ENV & deploy Vercel |

---

## Arsitektur

```
┌─────────────┐        GET /api/send-otp?email=        ┌──────────────────────┐       SMTP        ┌──────────┐
│  Web Utama  │  ───────────────────────────────────>  │  Fyymotion Auth      │  ─────────────>  │  Inbox   │
│  (Backend)  │                                        │  auth-fyymotion      │   Mailjet/       │  User    │
│             │  <───────────────────────────────────  │  .vercel.app         │   Ethereal       │          │
│             │        GET /api/verify-otp?otp=        └──────────────────────┘                  └──────────┘
└─────────────┘
```

**Alur:** User input email → Web Utama `GET /api/send-otp?email=` → Fyymail generate OTP 6 digit, kirim email `[noreply] Kode OTP ...` → User input OTP → Web Utama `GET /api/verify-otp?email=&otp=` → `valid:true` → login.

**Tanpa akun & tanpa apikey:** private untuk pribadi. Cukup panggil URL.

**2 Mode:**

| ENV Vercel | Mode | Cek Email |
|------------|------|-----------|
| `TEMP_MAIL=true` | Ethereal (testing) | `previewUrl` di response |
| `SMTP_HOST=in-v3.mailjet.com` | SMTP real | inbox Gmail |

---

## Base URL

```
Prod   : https://auth-fyymotion.vercel.app
Preview: https://auth-fyymotion-git-arena-d4a3315d-fyymail-yoo23mann.vercel.app
Local  : http://localhost:3000
```

---

## Butuh Bantuan?

- Checklist: [INTEGRATION_WEB_UTAMA.md](./INTEGRATION_WEB_UTAMA.md)
- Health: `GET /api/health`
- Repo: `IKOO-INC/fyymail` branch `arena/d4a3315d-fyymail`

# 📚 Dokumentasi Fyymotion Auth

API SMTP untuk kirim OTP — dipakai oleh **web utama** dan website lain sebagai layanan OTP terpusat.

**Live API:** `https://auth-fyymotion.vercel.app`

---

## Daftar Dokumen

| Dokumen | Untuk Siapa | Deskripsi |
|---|---|---|
| [⚡ Quick Start](./QUICKSTART.md) | Semua dev | Mulai dalam 5 menit |
| [🔌 API Spec](./API_SPEC.md) | Frontend & Backend | Detail semua endpoint + contoh request/response |
| [🏗️ Integrasi Web Utama](./INTEGRATION_WEB_UTAMA.md) | **Tim Web Utama** | Step-by-step checklist integrasi — baca ini dulu! |
| [📬 Webhook Mailjet](./WEBHOOK_MAILJET.md) | DevOps / Backend | Setup tracking email (sent/open/bounce dll) |
| [💻 Contoh Code](./EXAMPLES.md) | Semua dev | Copy-paste contoh Node.js, PHP, Python |
| [🚀 Deployment](./DEPLOYMENT.md) | DevOps | Cara deploy & setting ENV di Vercel |

---

## Gambaran Arsitektur

```
┌─────────────┐        POST /api/send-otp         ┌──────────────────────┐       SMTP        ┌──────────┐
│  Web Utama  │  ───────────────────────────────>  │  Fyymotion Auth      │  ─────────────>  │  Inbox   │
│  (Backend)  │                                    │  auth-fyymotion      │   Mailjet/       │  User    │
│             │  <───────────────────────────────  │  .vercel.app         │   Gmail/Brevo    │          │
│             │        POST /api/verify-otp        └──────────────────────┘                  └──────────┘
└─────────────┘                                                                                     ▲
       │                                                                                          │
       │  POST /api/webhooks/mailjet  (Mailjet → Fyymotion Auth → Forward ke Web Utama)         │
       └──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Alur OTP:**
1. User input email di Web Utama → Web Utama panggil `POST /api/send-otp`
2. Fyymotion Auth generate OTP 6 digit, simpan hash (10 menit), kirim email via SMTP `noreply@fyymotion.com`
3. User cek email, input OTP → Web Utama panggil `POST /api/verify-otp` → kalau `valid: true`, login/register lanjut

**Tanpa akun:** Web Utama tidak perlu bikin user di Fyymotion Auth. Cukup pakai `x-api-key`.

---

## Base URL

```
Production : https://auth-fyymotion.vercel.app
Preview    : https://auth-fyymotion-xxx.vercel.app (auto dari Vercel)
Local      : http://localhost:3000 (vercel dev)
```

---

## Butuh Bantuan?

- Lihat [INTEGRATION_WEB_UTAMA.md](./INTEGRATION_WEB_UTAMA.md) untuk checklist lengkap
- Cek `GET /api/health` untuk pastikan API hidup
- Log error ada di Vercel Dashboard → Logs
- Repo: `IKOO-INC/fyymail` — branch `arena/d4a3315d-fyymail`

---

**Tim Fyymotion Auth** — `Fyymotion <noreply@fyymotion.com>`

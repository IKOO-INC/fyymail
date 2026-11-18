# ⚡ Quick Start — 5 Menit

> **Fyymail sekarang: tanpa apikey + support GET. Private untuk pribadi.**

**Base URL:**
```
Prod   : https://auth-fyymotion.vercel.app
Preview: https://auth-fyymotion-git-arena-d4a3315d-fyymail-yoo23mann.vercel.app
Local  : http://localhost:3000
```

---

## 1. Cek API hidup?

```bash
curl https://auth-fyymotion.vercel.app/api/health
# atau buka di browser
```
Response:
```json
{
  "success": true,
  "service": "fyymotion-auth",
  "from": "Fyymotion <noreply@fyymotion.com>",
  "status": "ok",
  "smtpConfigured": true,
  "mode": "temp-mail (ethereal)",
  "subjectPrefix": "[noreply]"
}
```

- `mode: temp-mail` = pakai Ethereal (ga perlu validasi domain, buat testing)
- `mode: smtp` = pakai Mailjet/Gmail beneran

---

## 2. Kirim OTP — tinggal paste di browser!

**GET (paling gampang, tanpa apikey):**

```
https://auth-fyymotion.vercel.app/api/send-otp?email=user@gmail.com&appName=Fyymotion
```

Buka URL itu di browser → langsung kekirim!

Param GET:

| Param | Wajib | Contoh |
|-------|-------|--------|
| `email` | ✅ | `user@gmail.com` |
| `appName` | ❌ | `Fyymotion` (default) |
| `purpose` | ❌ | `verifikasi akun` |
| `otp` | ❌ | `123456` (kalau mau pakai OTP custom) |

Response:
```json
{
  "success": true,
  "message": "OTP berhasil dikirim.",
  "email": "u***@gmail.com",
  "expiresIn": 600,
  "expiresInMinutes": 10,
  "previewUrl": "https://ethereal.email/message/xxx",
  "mode": "temp-mail",
  "note": "Mode temp mail aktif — cek previewUrl"
}
```

- Kalau `mode: temp-mail`, buka `previewUrl` buat lihat email (inbox Ethereal, bukan Gmail beneran)
- Kalau `mode: smtp`, email masuk ke inbox Gmail beneran dengan subject `[noreply] Kode OTP Fyymotion: 123456`

**POST juga bisa (dari backend):**

```bash
curl "https://auth-fyymotion.vercel.app/api/send-otp?email=user@gmail.com&appName=Fyymotion"
# atau
curl -X POST https://auth-fyymotion.vercel.app/api/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"user@gmail.com","appName":"Fyymotion"}'
```

---

## 3. Verifikasi OTP

**GET:**
```
https://auth-fyymotion.vercel.app/api/verify-otp?email=user@gmail.com&otp=123456
```

**POST:**
```bash
curl -X POST https://auth-fyymotion.vercel.app/api/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"user@gmail.com","otp":"123456"}'
```

Response valid:
```json
{"success":true,"valid":true,"message":"OTP valid."}
```

Response salah:
```json
{"success":false,"valid":false,"error":"Kode OTP salah."}
{"success":false,"valid":false,"error":"OTP sudah kedaluwarsa."}
{"success":false,"valid":false,"error":"Terlalu banyak percobaan. Minta OTP baru."}
```

---

## 4. Pakai di Aplikasi Utama

Paling simple — fetch langsung dari backend/frontend (ga perlu apikey):

```javascript
// kirim OTP
await fetch(`https://auth-fyymotion.vercel.app/api/send-otp?email=${email}&appName=Fyymotion`)

// verify OTP
await fetch(`https://auth-fyymotion.vercel.app/api/verify-otp?email=${email}&otp=${code}`)
```

Lihat contoh lengkap di [INTEGRATION_WEB_UTAMA.md](./INTEGRATION_WEB_UTAMA.md) dan [EXAMPLES.md](./EXAMPLES.md).

---

## 5. Catatan Mode

| Vercel ENV | Mode | Subject | Inbox |
|------------|------|---------|-------|
| `TEMP_MAIL=true` | `temp-mail (ethereal)` | `[noreply] Kode OTP ...` | cek `previewUrl` (ethereal.email) |
| `SMTP_HOST=in-v3.mailjet.com` | `smtp` | `[noreply] Kode OTP ...` | inbox Gmail beneran (`noreply@fyymotion.com`) |

Ganti mode tinggal ubah ENV di Vercel → Redeploy.

---

Selanjutnya: [API Spec](./API_SPEC.md) | [Integrasi Web Utama](./INTEGRATION_WEB_UTAMA.md)

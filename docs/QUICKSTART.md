# ⚡ Quick Start — 5 Menit

Untuk tim Web Utama yang mau langsung coba.

---

## 1. Dapatkan API Key

Tanya DevOps Fyymotion Auth untuk `API_KEYS`. Contoh:
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
```
Simpan di `.env` Web Utama:
```env
FYMAIL_URL=https://auth-fyymotion.vercel.app
FYMAIL_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
Fyymotion <noreply@fyymotion.com> = pengirim email
```

> Generate baru: `openssl rand -hex 32`

---

## 2. Test API Hidup?

```bash
curl https://auth-fyymotion.vercel.app/api/health
```
Harus balas:
```json
{"success":true,"service":"fyymotion-auth","status":"ok", ...}
```

---

## 3. Kirim OTP (dari Backend!)

**JANGAN dari browser** — API key akan bocor.

```bash
curl -X POST https://auth-fyymotion.vercel.app/api/send-otp \
  -H "Content-Type: application/json" \
  -H "x-api-key: API_KEY_KAMU" \
  -d '{"email":"test@example.com","appName":"Fyymotion"}'
```

Response:
```json
{
  "success": true,
  "message": "OTP berhasil dikirim.",
  "email": "t***@example.com",
  "expiresIn": 600,
  "expiresInMinutes": 10
}
```
User akan terima email dari `Fyymotion <noreply@fyymotion.com>` dengan kode 6 digit.

---

## 4. Verifikasi OTP

```bash
curl -X POST https://auth-fyymotion.vercel.app/api/verify-otp \
  -H "Content-Type: application/json" \
  -H "x-api-key: API_KEY_KAMU" \
  -d '{"email":"test@example.com","otp":"123456"}'
```

Response sukses:
```json
{"success":true,"valid":true,"message":"OTP valid."}
```

Response salah/expired:
```json
{"success":false,"valid":false,"error":"Kode OTP salah."}
{"success":false,"valid":false,"error":"OTP sudah kedaluwarsa."}
{"success":false,"valid":false,"error":"Terlalu banyak percobaan. Minta OTP baru."}
```

---

## 5. Pasang di Web Utama

Lihat **contoh lengkap copy-paste** di:

- [Integration Web Utama →](./INTEGRATION_WEB_UTAMA.md) — checklist lengkap
- [Examples →](./EXAMPLES.md) — Node.js, PHP Laravel, Python

Paling simple (Node.js/Express):

```javascript
// .env: FYMAIL_URL, FYMAIL_API_KEY

async function sendOtp(email) {
  const res = await fetch(`${process.env.FYMAIL_URL}/api/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.FYMAIL_API_KEY },
    body: JSON.stringify({ email, appName: 'Fyymotion' })
  });
  return res.json();
}

async function verifyOtp(email, otp) {
  const res = await fetch(`${process.env.FYMAIL_URL}/api/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.FYMAIL_API_KEY },
    body: JSON.stringify({ email, otp })
  });
  return res.json(); // { valid: true/false }
}
```

---

## Selanjutnya

- Baca [API_SPEC.md](./API_SPEC.md) untuk detail field, error code, rate limit
- Setup webhook tracking di [WEBHOOK_MAILJET.md](./WEBHOOK_MAILJET.md) (opsional)

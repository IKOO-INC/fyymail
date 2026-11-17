# 🏗️ Integrasi Web Utama — Checklist Lengkap

Dokumen ini **khusus untuk tim Web Utama** yang akan pakai Fyymotion Auth sebagai layanan OTP.

> Base URL: `https://auth-fyymotion.vercel.app`
> Repo: `IKOO-INC/fyymail` (branch `arena/d4a3315d-fyymail`)
> Pengirim email: `Fyymotion <fyymotion@noreply>`

---

## ✅ Checklist Integrasi (Wajib Dikerjakan)

### 1. Minta API Key ke Tim Fyymotion Auth

Hubungi DevOps untuk dapat `API_KEYS`.

Simpan di ENV Web Utama:

```env
# .env / .env.local Web Utama
FYMAIL_URL=https://auth-fyymotion.vercel.app
FYMAIL_API_KEY=key-yang-diberikan-devops-32-char-hex
```

**PENTING:**
- Jangan commit API key ke Git!
- Jangan panggil API dari browser/frontend langsung — key akan bocor di Network tab.
- Selalu panggil dari **backend** (Next.js API route, Express, Laravel, dll).

Generate key baru kalau perlu: `openssl rand -hex 32`

---

### 2. Buat 2 Endpoint di Web Utama (Backend)

Web Utama butuh 2 endpoint sendiri yang nanti dipanggil frontend:

#### A. `POST /api/auth/request-otp` (di Web Utama)

Tugas: terima email dari frontend → teruskan ke Fyymotion Auth → balas ke frontend.

**Contoh Next.js (App Router):**

```javascript
// web-utama/app/api/auth/request-otp/route.js
export async function POST(req) {
  const { email } = await req.json();

  // Validasi sederhana
  if (!email || !email.includes('@')) {
    return Response.json({ success: false, error: 'Email tidak valid' }, { status: 400 });
  }

  // Panggil Fyymotion Auth
  const res = await fetch(`${process.env.FYMAIL_URL}/api/send-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.FYMAIL_API_KEY,
    },
    body: JSON.stringify({
      email: email.toLowerCase().trim(),
      appName: 'Fyymotion',          // muncul di email
      purpose: 'verifikasi akun',    // opsional
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    // Handle rate limit dll
    if (res.status === 429) {
      return Response.json({ success: false, error: 'Terlalu sering, coba lagi 10 menit' }, { status: 429 });
    }
    return Response.json({ success: false, error: data.error || 'Gagal kirim OTP' }, { status: res.status });
  }

  // Jangan kirim OTP asli ke frontend! Fyymotion Auth tidak mengembalikan OTP di production.
  return Response.json({
    success: true,
    message: 'Kode OTP sudah dikirim ke email',
    email: data.email, // t***@example.com (masked)
    expiresIn: data.expiresIn, // 600 detik
  });
}
```

**Contoh Express:**

```javascript
// web-utama/routes/auth.js
const express = require('express');
const router = express.Router();

router.post('/request-otp', async (req, res) => {
  const { email } = req.body;
  try {
    const r = await fetch(`${process.env.FYMAIL_URL}/api/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.FYMAIL_API_KEY },
      body: JSON.stringify({ email, appName: 'Fyymotion' }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    res.json({ success: true, message: 'OTP terkirim', expiresIn: data.expiresIn });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Gagal kirim OTP' });
  }
});
```

#### B. `POST /api/auth/verify-otp` (di Web Utama)

```javascript
// web-utama/app/api/auth/verify-otp/route.js
export async function POST(req) {
  const { email, otp } = await req.json();

  const res = await fetch(`${process.env.FYMAIL_URL}/api/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.FYMAIL_API_KEY,
    },
    body: JSON.stringify({ email, otp, appName: 'Fyymotion' }),
  });

  const data = await res.json();

  if (data.valid) {
    // TODO: Di sini logika Web Utama:
    // - Buat session / JWT
    // - Tandai user verified di DB
    // - Redirect ke dashboard
    return Response.json({ success: true, message: 'OTP valid, login berhasil' });
  } else {
    // data.error: "Kode OTP salah." / "OTP sudah kedaluwarsa." / "Terlalu banyak percobaan..."
    return Response.json({ success: false, error: data.error }, { status: 400 });
  }
}
```

---

### 3. Buat UI di Frontend

Frontend Web Utama cukup panggil endpoint Web Utama sendiri (bukan langsung ke Fyymotion Auth).

**Flow UI:**

1. Form input email → `POST /api/auth/request-otp` (Web Utama)
2. Tampilkan "Cek email, masukkan kode 6 digit (berlaku 10 menit)"
3. Form input OTP → `POST /api/auth/verify-otp` (Web Utama)
4. Jika valid → login, jika tidak → tampilkan error + tombol "Kirim ulang"

**Contoh React:**

```jsx
const [email, setEmail] = useState('');
const [otp, setOtp] = useState('');
const [step, setStep] = useState('email'); // email | otp

async function handleRequestOTP(e) {
  e.preventDefault();
  const res = await fetch('/api/auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (data.success) setStep('otp');
  else alert(data.error);
}

async function handleVerifyOTP(e) {
  e.preventDefault();
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });
  const data = await res.json();
  if (data.success) window.location.href = '/dashboard';
  else alert(data.error); // "Kode OTP salah."
}
```

**UX yang disarankan:**
- Disable tombol "Kirim OTP" selama 60 detik setelah kirim (hindari spam)
- Tampilkan countdown "OTP berlaku 10:00"
- Tombol "Kirim ulang" hanya aktif setelah countdown atau jika error `429`
- Input OTP: 6 kotak terpisah lebih bagus UX-nya

---

### 4. Handle Error & Edge Cases

| Error dari Fyymotion Auth | Arti | Apa yang Web Utama lakukan |
|---|---|---|
| `429 Terlalu banyak permintaan OTP` | User spam minta OTP | Tampilkan "Tunggu 10 menit", disable tombol |
| `Kode OTP salah.` | Salah input, masih ada sisa attempt | Tampilkan "Kode salah, sisa X percobaan" (hitung di frontend, max 5) |
| `OTP sudah kedaluwarsa.` | Lewat 10 menit | Tampilkan "Kode expired, minta baru" + tombol Kirim Ulang |
| `Terlalu banyak percobaan. Minta OTP baru.` | 5x salah | Hapus form OTP, minta request OTP baru |
| `OTP tidak ditemukan...` | OTP sudah dipakai atau tidak pernah dikirim | Minta request OTP baru |
| `401 API key tidak valid` | ENV `FYMAIL_API_KEY` salah di Web Utama | Cek ENV, kontak DevOps |
| `502 Gagal mengirim email` | SMTP Fyymotion Auth bermasalah | Tampilkan "Gagal kirim email, coba lagi nanti", log ke Sentry |

---

### 5. Keamanan (Wajib)

- [ ] **Jangan** expose `FYMAIL_API_KEY` ke browser (jangan prefix `NEXT_PUBLIC_`)
- [ ] Validasi email di Web Utama sebelum teruskan ke Fyymotion Auth
- [ ] Tambah rate limit di Web Utama juga (misal pakai `express-rate-limit` atau Next.js middleware) — jangan hanya andalkan Fyymotion Auth
- [ ] Tambah CAPTCHA (hCaptcha/Turnstile) di form request-otp kalau ada abuse
- [ ] Log semua request OTP di Web Utama untuk audit

---

### 6. Testing Checklist

Sebelum launch, test ini:

- [ ] `GET https://auth-fyymotion.vercel.app/api/health` → `smtpConfigured:true` ?
- [ ] Kirim OTP ke email valid → terima email dari `fyymotion@noreply` ?
- [ ] Verifikasi dengan OTP benar → `valid:true` ?
- [ ] Verifikasi lagi dengan OTP sama → harus `valid:false` (sekali pakai)
- [ ] Kirim OTP 6x ke email sama dalam 10 menit → harus `429` ?
- [ ] Input OTP salah 5x → harus `Terlalu banyak percobaan` ?
- [ ] Tunggu 10 menit, verifikasi OTP lama → harus `kedaluwarsa` ?
- [ ] Coba `appName` beda saat verify → harus tetap `tidak ditemukan` (karena key OTP per appName)

---

## 🔄 Alur Lengkap Diagram

```
[User Frontend]                [Web Utama Backend]                     [Fyymotion Auth]
      │                                │                                   │
      │  POST /request-otp {email}     │                                     │
      │───────────────────────────────>│  POST /api/send-otp {email}         │
      │                                │────────────────────────────────────>│
      │                                │  generate OTP, save hash, sendMail  │
      │                                │  via SMTP fyymotion@noreply         │
      │                                │<────────────────────────────────────│
      │  {success, expiresIn}          │  {success, email: t***}             │
      │<───────────────────────────────│                                     │
      │  "Cek email"                   │                                     │
      │  Input OTP 123456              │                                     │
      │  POST /verify-otp {email,otp}  │                                     │
      │───────────────────────────────>│  POST /api/verify-otp {email,otp}   │
      │                                │────────────────────────────────────>│
      │                                │  hash compare, delete if valid      │
      │                                │<────────────────────────────────────│
      │  {valid:true}                  │  {valid:true}                       │
      │<───────────────────────────────│                                     │
      │  → Dashboard                   │  buat session/JWT                    │
```

---

## 📦 ENV yang Perlu di Web Utama

```env
# .env Web Utama
FYMAIL_URL=https://auth-fyymotion.vercel.app
FYMAIL_API_KEY=xxxx-xxxx-xxxx-xxxx  # dari DevOps Fyymotion Auth
```

Hanya 2 itu saja! Tidak perlu SMTP di Web Utama, semua urusan email ada di Fyymotion Auth.

---

## 📞 Kontak & Bantuan

- Repo: `IKOO-INC/fyymail`
- Live API: `https://auth-fyymotion.vercel.app`
- Health: `GET /api/health`
- Webhook status: `GET /api/webhooks/mailjet`
- Vercel Logs: tanya DevOps untuk akses dashboard

Kalau ada error `502` atau email tidak masuk, cek:
1. `GET /api/health` → `smtpConfigured` harus `true`
2. Vercel Logs → cari `[send-otp] Gagal kirim email`
3. Hubungi DevOps Fyymotion Auth

---

**Sudah siap?** Lihat [EXAMPLES.md](./EXAMPLES.md) untuk copy-paste code PHP Laravel & Python juga.

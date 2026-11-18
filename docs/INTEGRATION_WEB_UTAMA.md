# 🏗️ Integrasi Web Utama — Checklist

Base URL: `https://auth-fyymotion.vercel.app`  
Preview : `https://auth-fyymotion-git-arena-d4a3315d-fyymail-yoo23mann.vercel.app`  
Repo : `IKOO-INC/fyymail` (branch `arena/d4a3315d-fyymail`)  
**Tanpa apikey — private**

---

## 1. ENV Web Utama

Cukup 1 variabel!

```env
# .env Web Utama
FYMAIL_URL=https://auth-fyymotion.vercel.app
# FYMAIL_API_KEY tidak perlu lagi (dihapus)
```

> Ganti ke preview URL kalau prod belum deploy.

---

## 2. Buat 2 Endpoint di Backend Web Utama

Frontend panggil backend Web Utama sendiri, jangan langsung ke Fyymail (biar ga spam).

### A. `POST /api/auth/request-otp` (di Web Utama)

**Next.js App Router:**

```javascript
// web-utama/app/api/auth/request-otp/route.js
export async function POST(req) {
  const { email } = await req.json();
  if (!email?.includes('@')) {
    return Response.json({ success:false, error:'Email tidak valid' }, {status:400});
  }

  // panggil Fyymail — GET paling simple, tanpa apikey
  const res = await fetch(`${process.env.FYMAIL_URL}/api/send-otp?email=${encodeURIComponent(email)}&appName=Fyymotion`);
  const data = await res.json();

  if (!res.ok || !data.success) {
    if (res.status === 429) {
      return Response.json({ success:false, error:'Terlalu sering, coba lagi 10 menit' }, {status:429});
    }
    return Response.json({ success:false, error: data.error || 'Gagal kirim OTP' }, {status: res.status});
  }

  return Response.json({
    success: true,
    message: 'Kode OTP sudah dikirim ke email',
    email: data.email, // t***@example.com
    expiresIn: data.expiresIn, // 600
    previewUrl: data.previewUrl // ada kalau mode temp-mail
  });
}
```

**Express:**

```javascript
// routes/auth.js
router.post('/request-otp', async (req, res) => {
  const { email } = req.body;
  const r = await fetch(`${process.env.FYMAIL_URL}/api/send-otp?email=${encodeURIComponent(email)}&appName=Fyymotion`);
  const data = await r.json();
  if (!r.ok) return res.status(r.status).json(data);
  res.json({ success:true, message:'OTP terkirim', expiresIn: data.expiresIn, previewUrl: data.previewUrl });
});
```

### B. `POST /api/auth/verify-otp` (di Web Utama)

```javascript
// web-utama/app/api/auth/verify-otp/route.js
export async function POST(req) {
  const { email, otp } = await req.json();
  const res = await fetch(`${process.env.FYMAIL_URL}/api/verify-otp?email=${encodeURIComponent(email)}&otp=${otp}&appName=Fyymotion`);
  const data = await res.json();

  if (data.valid) {
    // buat session / JWT
    return Response.json({ success:true, message:'OTP valid, login berhasil' });
  } else {
    return Response.json({ success:false, error: data.error }, {status:400});
  }
}
```

> Bisa juga pakai POST JSON kalau mau:
> `fetch(FYMAIL_URL + '/api/send-otp', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, appName:'Fyymotion'})})`

---

## 3. Frontend

**Flow:**
1. Input email → `POST /api/auth/request-otp` (Web Utama)
2. Tampilkan "Cek email, kode 6 digit berlaku 10 menit"
3. Input OTP → `POST /api/auth/verify-otp` (Web Utama)
4. Valid → dashboard, tidak valid → tampilkan error

**React:**

```jsx
const [email, setEmail] = useState('');
const [otp, setOtp] = useState('');
const [step, setStep] = useState('email');

async function handleRequestOTP(e) {
  e.preventDefault();
  const res = await fetch('/api/auth/request-otp', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email })
  });
  const data = await res.json();
  if (data.success) setStep('otp');
  else alert(data.error);
}

async function handleVerifyOTP(e) {
  e.preventDefault();
  const res = await fetch('/api/auth/verify-otp', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ email, otp })
  });
  const data = await res.json();
  if (data.success) window.location.href = '/dashboard';
  else alert(data.error);
}
```

**UX disarankan:**
- Disable tombol Kirim OTP 60 detik setelah kirim
- Countdown 10:00
- Input OTP 6 kotak

---

## 4. Handle Error

| Error Fyymail | Arti | Web Utama |
|---------------|------|-----------|
| `429 Terlalu banyak permintaan` | Spam | Tampilkan tunggu 10 menit |
| `Kode OTP salah.` | Salah input | Tampilkan sisa percobaan (max 5) |
| `OTP sudah kedaluwarsa.` | >10 menit | Minta baru |
| `Terlalu banyak percobaan.` | 5x salah | Minta OTP baru |
| `OTP tidak ditemukan...` | Sudah dipakai | Minta baru |
| `502 Gagal mengirim email` | SMTP error | Coba lagi nanti, lihat Vercel Logs |

---

## 5. Keamanan (opsional tapi bagus)

- [ ] Validasi email sebelum forward ke Fyymail
- [ ] Rate limit di Web Utama juga (express-rate-limit)
- [ ] CAPTCHA di form request-otp kalau abuse
- [ ] Log request OTP untuk audit

---

## 6. Testing Checklist

- [ ] `GET /api/health` → `smtpConfigured:true`?
- [ ] Buka `GET /api/send-otp?email=xxx@gmail.com` di browser → `success:true`?
- [ ] Kalau `mode: temp-mail` → buka `previewUrl` → email ada dengan subject `[noreply] Kode OTP ...`?
- [ ] Kalau `mode: smtp` → cek inbox Gmail → email masuk dari `noreply@fyymotion.com`?
- [ ] Verify OTP benar → `valid:true`?
- [ ] Verify lagi kode sama → `valid:false` (sekali pakai)?
- [ ] Kirim 6x ke email sama 10 menit → `429`?
- [ ] Salah 5x → `Terlalu banyak percobaan`?

---

## Diagram

```
[User Frontend]                [Web Utama Backend]                     [Fyymail]
      │                                │                                   │
      │  POST /request-otp {email}     │                                     │
      │───────────────────────────────>│  GET /api/send-otp?email=           │
      │                                │────────────────────────────────────>│
      │                                │  generate OTP, sendMail             │
      │                                │<────────────────────────────────────│
      │  {success, expiresIn}          │  {success, previewUrl}              │
      │<───────────────────────────────│                                     │
      │  Input OTP                     │                                     │
      │  POST /verify-otp {otp}       │  GET /api/verify-otp?email=&otp=    │
      │───────────────────────────────>│────────────────────────────────────>│
      │  {valid:true}                  │  {valid:true}                       │
      │<───────────────────────────────│                                     │
```

---

**Cuma butuh 2 fetch GET tanpa apikey!** Lihat [EXAMPLES.md](./EXAMPLES.md) untuk PHP Laravel & Python.

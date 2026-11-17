# 💻 Contoh Code — Copy Paste

Semua contoh pakai Base URL `https://auth-fyymotion.vercel.app` dan header `x-api-key`.

> **JANGAN** panggil Fyymotion Auth dari browser dengan API key asli. Selalu dari backend.

---

## 1. Node.js / Express

```javascript
// lib/fyymail.js
const FYMAIL_URL = process.env.FYMAIL_URL || 'https://auth-fyymotion.vercel.app';
const FYMAIL_API_KEY = process.env.FYMAIL_API_KEY;

async function sendOtp(email, appName = 'Fyymotion', purpose = 'verifikasi akun') {
  const res = await fetch(`${FYMAIL_URL}/api/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': FYMAIL_API_KEY },
    body: JSON.stringify({ email, appName, purpose }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Gagal kirim OTP');
  return data; // { success, email: "t***@example.com", expiresIn: 600 }
}

async function verifyOtp(email, otp, appName = 'Fyymotion') {
  const res = await fetch(`${FYMAIL_URL}/api/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': FYMAIL_API_KEY },
    body: JSON.stringify({ email, otp, appName }),
  });
  const data = await res.json();
  return data; // { success, valid, error }
}

module.exports = { sendOtp, verifyOtp };
```

```javascript
// routes/auth.js
const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp } = require('../lib/fyymail');

router.post('/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email tidak valid' });
    const result = await sendOtp(email);
    res.json({ message: 'OTP terkirim, cek email', expiresIn: result.expiresIn });
  } catch (err) {
    if (err.message.includes('Terlalu banyak')) return res.status(429).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const result = await verifyOtp(email, otp);
  if (result.valid) {
    // buat JWT / session
    res.json({ message: 'OTP valid' });
  } else {
    res.status(400).json({ error: result.error });
  }
});

module.exports = router;
```

---

## 2. Next.js (App Router)

```javascript
// lib/fyymail.js (sama seperti di atas)

// app/api/auth/request-otp/route.js
export async function POST(req) {
  const { email } = await req.json();
  const res = await fetch(`${process.env.FYMAIL_URL}/api/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.FYMAIL_API_KEY },
    body: JSON.stringify({ email, appName: 'Fyymotion' }),
  });
  const data = await res.json();
  if (!res.ok) return Response.json(data, { status: res.status });
  return Response.json({ success: true, message: 'OTP terkirim', expiresIn: data.expiresIn });
}

// app/api/auth/verify-otp/route.js
export async function POST(req) {
  const { email, otp } = await req.json();
  const res = await fetch(`${process.env.FYMAIL_URL}/api/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.FYMAIL_API_KEY },
    body: JSON.stringify({ email, otp, appName: 'Fyymotion' }),
  });
  const data = await res.json();
  if (data.valid) {
    // set cookie / JWT
    return Response.json({ success: true, message: 'Login berhasil' });
  }
  return Response.json({ success: false, error: data.error }, { status: 400 });
}
```

**Frontend React (panggil endpoint Web Utama sendiri, bukan Fyymotion Auth langsung):**

```jsx
'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');

  async function requestOtp(e) {
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

  async function verifyOtp(e) {
    e.preventDefault();
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (data.success) window.location.href = '/dashboard';
    else alert(data.error);
  }

  return step === 'email' ? (
    <form onSubmit={requestOtp}>
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
      <button>Kirim OTP</button>
    </form>
  ) : (
    <form onSubmit={verifyOtp}>
      <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="Kode 6 digit" maxLength={6} />
      <button>Verifikasi</button>
    </form>
  );
}
```

---

## 3. PHP — Laravel

```php
// app/Services/FyymotionAuth.php
<?php
namespace App\Services;

use Illuminate\Support\Facades\Http;

class FyymotionAuth
{
    protected $url;
    protected $key;

    public function __construct()
    {
        $this->url = env('FYMAIL_URL', 'https://auth-fyymotion.vercel.app');
        $this->key = env('FYMAIL_API_KEY');
    }

    public function sendOtp(string $email, string $appName = 'Fyymotion', ?string $purpose = null)
    {
        $res = Http::withHeaders([
            'x-api-key' => $this->key,
        ])->post("{$this->url}/api/send-otp", [
            'email' => $email,
            'appName' => $appName,
            'purpose' => $purpose,
        ]);

        if ($res->failed()) {
            throw new \Exception($res->json('error', 'Gagal kirim OTP'));
        }
        return $res->json();
    }

    public function verifyOtp(string $email, string $otp, string $appName = 'Fyymotion')
    {
        $res = Http::withHeaders([
            'x-api-key' => $this->key,
        ])->post("{$this->url}/api/verify-otp", [
            'email' => $email,
            'otp' => $otp,
            'appName' => $appName,
        ]);

        return $res->json(); // ['valid'=>true/false, 'error'=>...]
    }
}
```

```php
// routes/api.php
use App\Services\FyymotionAuth;

Route::post('/auth/request-otp', function (Illuminate\Http\Request $req, FyymotionAuth $fyymail) {
    $req->validate(['email' => 'required|email']);
    try {
        $data = $fyymail->sendOtp($req->email);
        return response()->json(['success' => true, 'message' => 'OTP terkirim', 'expiresIn' => $data['expiresIn']]);
    } catch (\Exception $e) {
        return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
    }
});

Route::post('/auth/verify-otp', function (Illuminate\Http\Request $req, FyymotionAuth $fyymail) {
    $req->validate(['email' => 'required|email', 'otp' => 'required|digits:6']);
    $result = $fyymail->verifyOtp($req->email, $req->otp);
    if ($result['valid'] ?? false) {
        // Auth::login(...), buat token Sanctum/JWT
        return response()->json(['success' => true, 'message' => 'OTP valid']);
    }
    return response()->json(['success' => false, 'error' => $result['error']], 400);
});
```

```env
# .env Laravel
FYMAIL_URL=https://auth-fyymotion.vercel.app
FYMAIL_API_KEY=key-dari-devops
```

---

## 4. Python — Flask / FastAPI

```python
# services/fyymail.py
import os
import requests

FYMAIL_URL = os.getenv("FYMAIL_URL", "https://auth-fyymotion.vercel.app")
FYMAIL_API_KEY = os.getenv("FYMAIL_API_KEY")

def send_otp(email: str, app_name: str = "Fyymotion", purpose: str = None):
    res = requests.post(
        f"{FYMAIL_URL}/api/send-otp",
        headers={"x-api-key": FYMAIL_API_KEY, "Content-Type": "application/json"},
        json={"email": email, "appName": app_name, "purpose": purpose},
        timeout=10,
    )
    data = res.json()
    if res.status_code != 200 or not data.get("success"):
        raise Exception(data.get("error", "Gagal kirim OTP"))
    return data

def verify_otp(email: str, otp: str, app_name: str = "Fyymotion"):
    res = requests.post(
        f"{FYMAIL_URL}/api/verify-otp",
        headers={"x-api-key": FYMAIL_API_KEY, "Content-Type": "application/json"},
        json={"email": email, "otp": otp, "appName": app_name},
        timeout=10,
    )
    return res.json()  # {"valid": true/false, ...}
```

```python
# app.py (Flask)
from flask import Flask, request, jsonify
from services.fyymail import send_otp, verify_otp

app = Flask(__name__)

@app.post("/api/auth/request-otp")
def request_otp():
    email = request.json.get("email")
    if not email or "@" not in email:
        return jsonify(success=False, error="Email tidak valid"), 400
    try:
        data = send_otp(email)
        return jsonify(success=True, message="OTP terkirim", expiresIn=data["expiresIn"])
    except Exception as e:
        if "Terlalu banyak" in str(e):
            return jsonify(success=False, error=str(e)), 429
        return jsonify(success=False, error=str(e)), 500

@app.post("/api/auth/verify-otp")
def verify():
    email = request.json.get("email")
    otp = request.json.get("otp")
    result = verify_otp(email, otp)
    if result.get("valid"):
        return jsonify(success=True, message="OTP valid")
    return jsonify(success=False, error=result.get("error")), 400
```

---

## 5. cURL (Testing)

```bash
# Health
curl https://auth-fyymotion.vercel.app/api/health

# Send OTP
curl -X POST https://auth-fyymotion.vercel.app/api/send-otp \
  -H "Content-Type: application/json" \
  -H "x-api-key: $FYMAIL_API_KEY" \
  -d '{"email":"user@example.com","appName":"Fyymotion","purpose":"verifikasi akun"}'

# Verify OTP
curl -X POST https://auth-fyymotion.vercel.app/api/verify-otp \
  -H "Content-Type: application/json" \
  -H "x-api-key: $FYMAIL_API_KEY" \
  -d '{"email":"user@example.com","otp":"123456"}'

# Send Email (generik)
curl -X POST https://auth-fyymotion.vercel.app/api/send-email \
  -H "Content-Type: application/json" \
  -H "x-api-key: $FYMAIL_API_KEY" \
  -d '{"to":"user@example.com","subject":"Halo","html":"<p>Test</p>"}'

# Webhook Mailjet (GET status)
curl https://auth-fyymotion.vercel.app/api/webhooks/mailjet

# Webhook Mailjet (POST test)
curl -X POST "https://auth-fyymotion.vercel.app/api/webhooks/mailjet?token=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":"sent","email":"user@example.com","MessageID":123}'
```

---

## 6. Contoh: OTP Custom (Generate Sendiri)

Jika Web Utama mau generate OTP sendiri (misal simpan di DB sendiri), tetap bisa pakai Fyymotion Auth untuk kirim email saja:

```javascript
// Web Utama generate OTP
const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit
await db.saveOtp(email, otp); // simpan di DB Web Utama

// Kirim via Fyymotion Auth dengan otp custom
await fetch(`${FYMAIL_URL}/api/send-otp`, {
  method: 'POST',
  headers: { 'x-api-key': FYMAIL_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, otp, appName: 'Fyymotion' }),
});

// Verifikasi nanti via DB Web Utama sendiri, tidak perlu /api/verify-otp
```

---

Lihat juga:
- [API Spec](./API_SPEC.md) — detail field & error
- [Integration Web Utama](./INTEGRATION_WEB_UTAMA.md) — checklist

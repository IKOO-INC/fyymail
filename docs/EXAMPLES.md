# 💻 Contoh Code — Copy Paste (Tanpa APIKEY)

Base URL: `https://auth-fyymotion.vercel.app`  
Preview: `https://auth-fyymotion-git-arena-d4a3315d-fyymail-yoo23mann.vercel.app`

> **Private — tanpa apikey.** Bisa GET langsung dari browser atau fetch backend.

---

## cURL / Browser

```bash
# Health
curl https://auth-fyymotion.vercel.app/api/health
# atau buka di browser
open "https://auth-fyymotion.vercel.app/api/send-otp?email=test@gmail.com"

# Send OTP — GET (paling gampang)
curl "https://auth-fyymotion.vercel.app/api/send-otp?email=user@example.com&appName=Fyymotion"

# Send OTP — POST
curl -X POST https://auth-fyymotion.vercel.app/api/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","appName":"Fyymotion"}'

# Verify — GET
curl "https://auth-fyymotion.vercel.app/api/verify-otp?email=user@example.com&otp=123456"

# Verify — POST
curl -X POST https://auth-fyymotion.vercel.app/api/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","otp":"123456"}'
```

---

## 1. Node.js / Express

```javascript
// lib/fyymail.js — tanpa apikey
const FYMAIL_URL = process.env.FYMAIL_URL || 'https://auth-fyymotion.vercel.app';

async function sendOtp(email, appName = 'Fyymotion', purpose) {
  const url = new URL(`${FYMAIL_URL}/api/send-otp`);
  url.searchParams.set('email', email);
  url.searchParams.set('appName', appName);
  if (purpose) url.searchParams.set('purpose', purpose);
  const res = await fetch(url); // GET
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Gagal kirim OTP');
  return data; // { success, email, expiresIn, previewUrl }
}

async function verifyOtp(email, otp, appName = 'Fyymotion') {
  const url = `${FYMAIL_URL}/api/verify-otp?email=${encodeURIComponent(email)}&otp=${otp}&appName=${encodeURIComponent(appName)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data; // { valid: true/false, error }
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
    if (!email?.includes('@')) return res.status(400).json({ error: 'Email tidak valid' });
    const result = await sendOtp(email);
    res.json({ message: 'OTP terkirim, cek email', expiresIn: result.expiresIn, previewUrl: result.previewUrl });
  } catch (err) {
    if (err.message.includes('Terlalu banyak')) return res.status(429).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const result = await verifyOtp(email, otp);
  if (result.valid) res.json({ message: 'OTP valid' });
  else res.status(400).json({ error: result.error });
});

module.exports = router;
```

---

## 2. Next.js (App Router)

```javascript
// app/api/auth/request-otp/route.js
export async function POST(req) {
  const { email } = await req.json();
  const url = `${process.env.FYMAIL_URL}/api/send-otp?email=${encodeURIComponent(email)}&appName=Fyymotion`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) return Response.json(data, { status: res.status });
  return Response.json({ success:true, message:'OTP terkirim', expiresIn: data.expiresIn, previewUrl: data.previewUrl });
}

// app/api/auth/verify-otp/route.js
export async function POST(req) {
  const { email, otp } = await req.json();
  const res = await fetch(`${process.env.FYMAIL_URL}/api/verify-otp?email=${encodeURIComponent(email)}&otp=${otp}`);
  const data = await res.json();
  if (data.valid) return Response.json({ success:true, message:'Login berhasil' });
  return Response.json({ success:false, error: data.error }, {status:400});
}
```

**Frontend React:**

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
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (data.success) setStep('otp'); else alert(data.error);
  }

  async function verifyOtp(e) {
    e.preventDefault();
    const res = await fetch('/api/auth/verify-otp', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (data.success) window.location.href = '/dashboard'; else alert(data.error);
  }

  return step === 'email' ? (
    <form onSubmit={requestOtp}>
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
      <button>Kirim OTP</button>
    </form>
  ) : (
    <form onSubmit={verifyOtp}>
      <input value={otp} onChange={e=>setOtp(e.target.value)} placeholder="Kode 6 digit" maxLength={6} />
      <button>Verifikasi</button>
    </form>
  );
}
```

---

## 3. PHP — Laravel

```php
<?php
// app/Services/FyymotionAuth.php
namespace App\Services;
use Illuminate\Support\Facades\Http;

class FyymotionAuth
{
    protected $url;
    public function __construct() {
        $this->url = env('FYMAIL_URL', 'https://auth-fyymotion.vercel.app');
    }
    public function sendOtp(string $email, string $appName = 'Fyymotion', ?string $purpose = null)
    {
        $res = Http::get("{$this->url}/api/send-otp", [
            'email' => $email,
            'appName' => $appName,
            'purpose' => $purpose,
        ]);
        if ($res->failed()) throw new \Exception($res->json('error', 'Gagal kirim OTP'));
        return $res->json();
    }
    public function verifyOtp(string $email, string $otp, string $appName = 'Fyymotion')
    {
        $res = Http::get("{$this->url}/api/verify-otp", [
            'email' => $email,
            'otp' => $otp,
            'appName' => $appName,
        ]);
        return $res->json(); // ['valid'=>true/false]
    }
}
```

```php
// routes/api.php
Route::post('/auth/request-otp', function (Request $req, FyymotionAuth $fyymail) {
    $req->validate(['email'=>'required|email']);
    try {
        $data = $fyymail->sendOtp($req->email);
        return response()->json(['success'=>true, 'message'=>'OTP terkirim', 'expiresIn'=>$data['expiresIn']]);
    } catch (\Exception $e) {
        return response()->json(['success'=>false,'error'=>$e->getMessage()], 500);
    }
});

Route::post('/auth/verify-otp', function (Request $req, FyymotionAuth $fyymail) {
    $req->validate(['email'=>'required|email','otp'=>'required|digits:6']);
    $result = $fyymail->verifyOtp($req->email, $req->otp);
    if ($result['valid'] ?? false) return response()->json(['success'=>true,'message'=>'OTP valid']);
    return response()->json(['success'=>false,'error'=>$result['error']], 400);
});
```

```env
# .env Laravel
FYMAIL_URL=https://auth-fyymotion.vercel.app
```

---

## 4. Python — Flask / FastAPI

```python
# services/fyymail.py
import os, requests
FYMAIL_URL = os.getenv("FYMAIL_URL", "https://auth-fyymotion.vercel.app")

def send_otp(email: str, app_name="Fyymotion", purpose=None):
    params = {"email": email, "appName": app_name}
    if purpose: params["purpose"] = purpose
    res = requests.get(f"{FYMAIL_URL}/api/send-otp", params=params, timeout=10)
    data = res.json()
    if res.status_code != 200 or not data.get("success"):
        raise Exception(data.get("error", "Gagal kirim OTP"))
    return data

def verify_otp(email: str, otp: str, app_name="Fyymotion"):
    res = requests.get(f"{FYMAIL_URL}/api/verify-otp", params={"email": email, "otp": otp, "appName": app_name}, timeout=10)
    return res.json()  # {"valid": true/false}
```

```python
# app.py Flask
from flask import Flask, request, jsonify
from services.fyymail import send_otp, verify_otp
app = Flask(__name__)

@app.post("/api/auth/request-otp")
def request_otp():
    email = request.json.get("email")
    if not email or "@" not in email: return jsonify(success=False, error="Email tidak valid"), 400
    try: data = send_otp(email); return jsonify(success=True, message="OTP terkirim", expiresIn=data["expiresIn"])
    except Exception as e:
        if "Terlalu banyak" in str(e): return jsonify(success=False, error=str(e)), 429
        return jsonify(success=False, error=str(e)), 500

@app.post("/api/auth/verify-otp")
def verify():
    email = request.json.get("email"); otp = request.json.get("otp")
    result = verify_otp(email, otp)
    if result.get("valid"): return jsonify(success=True, message="OTP valid")
    return jsonify(success=False, error=result.get("error")), 400
```

---

## 5. OTP Custom (Generate Sendiri)

```javascript
const otp = Math.floor(100000 + Math.random()*900000).toString();
await db.saveOtp(email, otp);
// kirim dengan OTP custom
await fetch(`https://auth-fyymotion.vercel.app/api/send-otp?email=${email}&otp=${otp}&appName=Fyymotion`)
```

---

Lihat [API_SPEC.md](./API_SPEC.md) & [INTEGRATION_WEB_UTAMA.md](./INTEGRATION_WEB_UTAMA.md)

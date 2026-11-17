'use strict';

/**
 * CONTOH: panggil Fyymotion Auth dari backend website lain (Node.js / Express / Next.js API route).
 * JANGAN panggil dari browser langsung dengan API key asli — API key akan bocor.
 * Selalu panggil dari server (backend) website kamu.
 *
 * Install: npm install node-fetch  (Node 18+ sudah ada fetch bawaan, tidak perlu install)
 */

const FYMAIL_URL = process.env.FYMAIL_URL || 'https://auth-fyymotion.vercel.app'; // ganti dengan URL deploy kamu
const FYMAIL_API_KEY = process.env.FYMAIL_API_KEY || 'ganti-dengan-api-key-kamu';

async function sendOtp(email, appName = 'WebsiteKu') {
  const res = await fetch(`${FYMAIL_URL}/api/send-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': FYMAIL_API_KEY,
    },
    body: JSON.stringify({
      email,
      appName,
      purpose: 'verifikasi akun',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Gagal kirim OTP');
  }
  return data; // { success, message, email, expiresIn }
}

async function verifyOtp(email, otp, appName = 'WebsiteKu') {
  const res = await fetch(`${FYMAIL_URL}/api/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': FYMAIL_API_KEY,
    },
    body: JSON.stringify({ email, otp, appName }),
  });
  const data = await res.json();
  return data; // { success, valid, ... }
}

// --- Contoh pakai di Express ---
/*
const express = require('express');
const app = express();
app.use(express.json());

app.post('/api/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await sendOtp(email, 'WebsiteKu');
    res.json({ message: 'Cek email kamu untuk kode OTP' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  const result = await verifyOtp(email, otp, 'WebsiteKu');
  if (result.valid) {
    // TODO: tandai user sebagai verified di DB kamu
    res.json({ message: 'OTP valid, akun terverifikasi!' });
  } else {
    res.status(400).json({ error: result.error });
  }
});
*/

// --- Contoh pakai di Next.js (app/api/request-otp/route.js) ---
/*
import { sendOtp } from '@/lib/fyymail';

export async function POST(req) {
  const { email } = await req.json();
  await sendOtp(email, 'WebsiteKu');
  return Response.json({ message: 'OTP terkirim' });
}
*/

module.exports = { sendOtp, verifyOtp };

// Jalankan manual: node examples/client.js (butuh FYMAIL_URL & FYMAIL_API_KEY di env)
if (require.main === module) {
  (async () => {
    try {
      const email = process.argv[2] || 'test@example.com';
      console.log('Mengirim OTP ke', email, '...');
      const r = await sendOtp(email);
      console.log('OK:', r);
    } catch (e) {
      console.error('Gagal:', e.message);
      process.exit(1);
    }
  })();
}

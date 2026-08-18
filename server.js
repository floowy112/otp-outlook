require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const Redis = require('ioredis');
const { authenticator } = require('otplib');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

const app = express();
app.use(express.json());

// 1. Setup Redis pake URL dari Upstash
const redis = new Redis(redis-cli --tls -u redis://default:gQAAAAAAAVN3AAIgcDEwOTE1NjMxOWNkMjg0MGEwODMxNDg0NzFhZDRmOTg2ZA@usable-vulture-86903.upstash.io:6379);
redis.on('connect', () => console.log('✅ Redis Connected!'));
redis.on('error', (err) => console.log('❌ Redis Error:', err));

// 2. Setup Nodemailer (Outlook)
const transporter = nodemailer.createTransport({
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.OUTLOOK_USER,
        pass: process.env.OUTLOOK_PASS
    }
});

// 3. Setup Rate Limiter
const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 3,
    message: { error: "Lu udah kebanyakan minta OTP boy, coba lagi 15 menit ya." }
});

// 4. Endpoint Request OTP
const emailSchema = z.object({
    email: z.string().email({ message: "Format email lu ngaco boy!" })
});

app.post('/api/send-otp', otpLimiter, async (req, res) => {
    try {
        const { email } = emailSchema.parse(req.body);
        const secret = authenticator.generateSecret();
        const otpCode = authenticator.generate(secret);

        await redis.set(`otp:${email}`, otpCode, 'EX', 180);

        const mailOptions = {
            from: `"Keamanan Web" <${process.env.OUTLOOK_USER}>`,
            to: email,
            subject: 'Kode OTP Login Lu',
            html: `
                <div style="font-family: sans-serif; padding: 20px;">
                    <h2>Verifikasi Login</h2>
                    <p>Ini kode rahasia lu:</p>
                    <h1 style="background: #eee; padding: 10px; letter-spacing: 5px;">${otpCode}</h1>
                    <p>Kode ini bakal hangus dalam 3 menit.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'OTP sukses meluncur ke email lu!' });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        console.error(error);
        res.status(500).json({ error: 'Gagal ngirim OTP.' });
    }
});

// 5. Endpoint Verify OTP
const verifySchema = z.object({
    email: z.string().email(),
    otp: z.string().length(6, { message: "OTP harus 6 digit!" })
});

app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp } = verifySchema.parse(req.body);
        const storedOtp = await redis.get(`otp:${email}`);

        if (!storedOtp) return res.status(400).json({ error: 'OTP udah basi atau email salah boy!' });
        if (storedOtp !== otp) return res.status(400).json({ error: 'Kode OTP salah.' });

        await redis.del(`otp:${email}`);
        res.status(200).json({ message: 'Mantap, OTP valid! Lu berhasil login.' });

    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        res.status(500).json({ error: 'Gagal verifikasi OTP.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server jalan di port ${PORT}`));
      

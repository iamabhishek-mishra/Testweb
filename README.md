# 🌿 Sudha Wellness Webinar Website

A complete webinar registration website with:
- Beautiful wellness-themed design
- Registration form with WhatsApp confirmation
- Razorpay payment (UPI, Cards, NetBanking)
- PhonePe payment integration
- UPI QR code payment option
- Countdown timer
- Automated WhatsApp meeting link delivery

---

## 📁 Project Structure

```
webinar/
├── index.html          ← Frontend (main website)
├── style.css           ← All styling
├── app.js              ← Frontend JavaScript
└── backend/
    ├── server.js       ← Node.js backend API
    ├── package.json    ← Dependencies
    └── .env.example    ← Environment variables template
```

---

## 🚀 Setup Guide

### Step 1 — Install backend dependencies
```bash
cd webinar/backend
npm install
```

### Step 2 — Configure environment variables
```bash
cp .env.example .env
# Now edit .env with your real API keys
```

### Step 3 — Get your API keys

#### 💳 Razorpay
1. Create account at https://dashboard.razorpay.com
2. Go to Settings → API Keys
3. Generate Test/Live key pair
4. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to `.env`
5. Update `RAZORPAY_KEY` in `app.js` line 8

#### 📱 PhonePe
1. Register at https://developer.phonepe.com/
2. Get your `PHONEPE_MERCHANT_ID` and `PHONEPE_SALT_KEY`
3. Add to `.env`

#### 💬 WhatsApp — Option A: Twilio (Easiest)
1. Sign up at https://www.twilio.com/whatsapp
2. Activate WhatsApp Sandbox (free for testing)
3. Your test users need to message `join <word>` to the sandbox number first
4. For production: apply for WhatsApp Business approval in Twilio console
5. Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` to `.env`

#### 💬 WhatsApp — Option B: Meta Cloud API (Official)
1. Create a Facebook Developer account
2. Set up WhatsApp Business API at https://developers.facebook.com/docs/whatsapp/cloud-api
3. Get your `META_WHATSAPP_TOKEN` and `META_PHONE_NUMBER_ID`
4. Add to `.env` (leave Twilio keys blank)

#### 🔗 Zoom Meeting
1. Create your Zoom meeting
2. Copy the meeting link, ID, and password
3. Update `ZOOM_MEETING_LINK`, `ZOOM_MEETING_ID`, `ZOOM_MEETING_PASSWORD` in `.env`

### Step 4 — Start the backend
```bash
cd webinar/backend
npm run dev   # development (with auto-reload)
# or
npm start     # production
```

### Step 5 — Open the website
Open `webinar/index.html` in your browser, or serve it with:
```bash
npx serve webinar/
```

---

## 🌐 Deployment Options

### Option 1: Vercel / Netlify (Frontend only)
- Deploy the `webinar/` folder (excluding `backend/`)
- Deploy backend separately on Railway, Render, or Heroku

### Option 2: VPS / cPanel
- Upload all files to your hosting
- Run backend with PM2: `pm2 start backend/server.js`

### Option 3: Railway (Full stack)
```bash
# Deploy backend to Railway
railway init
railway up
```

---

## 📋 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/register | Register user + send WhatsApp |
| GET | /api/health | Health check |
| POST | /api/payment/phonepe/initiate | Start PhonePe payment |
| GET | /api/payment/phonepe/callback | PhonePe redirect callback |
| POST | /api/payment/phonepe/webhook | PhonePe server webhook |
| POST | /api/payment/razorpay/webhook | Razorpay webhook |
| GET | /api/admin/registrations | View all registrations (needs admin key) |

---

## 🔧 Customization

### Change webinar date
- `app.js` line 7: Update `WEBINAR_DATE`
- `index.html`: Update date text in hero section

### Change pricing
- `app.js` line 9: Update `VIP_AMOUNT` (in paise, so ₹499 = 49900)
- `index.html`: Update price display text

### Change UPI ID
- `index.html`: Search for `sudhawellness@okaxis` and replace with your UPI ID

### Change colors / branding
- `style.css` lines 10-19: Update CSS variables

---

## ⚠️ Important Notes

1. **Test mode first**: Use Razorpay test keys and Twilio sandbox before going live
2. **HTTPS required**: WhatsApp APIs and payment webhooks require HTTPS in production
3. **Database**: Replace in-memory `registrations` array with MongoDB/PostgreSQL for production
4. **WhatsApp opt-in**: Users must have opted in to receive WhatsApp messages from you
5. **Razorpay webhook secret**: Set up webhook in Razorpay dashboard pointing to `/api/payment/razorpay/webhook`

---

## 📞 Support
For issues, check the browser console and backend terminal logs.
# Testweb

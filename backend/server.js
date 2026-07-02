// ============================================
//  SUDHA WELLNESS WEBINAR — BACKEND SERVER
//  Node.js + Express
//  Features:
//    - Registration API
//    - WhatsApp auto-message (Twilio / Meta API)
//    - Razorpay webhook verification
//    - PhonePe payment initiation
//    - UPI payment confirmation
// ============================================

const express    = require('express');
const cors       = require('cors');
const crypto     = require('crypto');
const axios      = require('axios');
require('dotenv').config();
const db = require('./db');
// Connect to MongoDB (non-blocking — falls back to in-memory if not configured)
db.connectDB().catch(err => console.warn('DB:', err.message));

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));  // In production, restrict to your domain

// ---- SERVE FRONTEND ----
const path = require('path');
app.use(express.static(path.join(__dirname, '..')));

// ============================================
//  CONFIGURATION (loaded from .env)
// ============================================
const {
  PORT = 3000,

  // Razorpay
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,

  // PhonePe
  PHONEPE_MERCHANT_ID,
  PHONEPE_SALT_KEY,
  PHONEPE_SALT_INDEX = '1',
  PHONEPE_ENV = 'TEST',             // 'TEST' or 'PROD'

  // WhatsApp — choose one provider:
  // Option A: Twilio (easiest)
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_FROM,             // e.g. whatsapp:+14155238886

  // Option B: Meta Cloud API (official WhatsApp Business)
  META_WHATSAPP_TOKEN,
  META_PHONE_NUMBER_ID,

  // Webinar details
  ZOOM_MEETING_LINK     = 'https://zoom.us/j/YOUR_MEETING_ID?pwd=YOUR_PASSWORD',
  ZOOM_MEETING_ID       = '123 456 7890',
  ZOOM_MEETING_PASSWORD = 'wellness',
  WEBINAR_DATE_STR      = 'Sunday, 20th July 2025 at 6:00 PM IST',
} = process.env;

// PhonePe base URLs
const PHONEPE_BASE = PHONEPE_ENV === 'PROD'
  ? 'https://api.phonepe.com/apis/hermes'
  : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

// ============================================
//  IN-MEMORY REGISTRATIONS STORE
//  Replace with MongoDB/PostgreSQL in production
// ============================================
const registrations = [];

// ============================================
//  ROUTE: Health check
// ============================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
//  ROUTE: Register & Send WhatsApp
// ============================================
app.post('/api/register', async (req, res) => {
  try {
    const { name, phone, email, goal, regType, paymentId, utrId } = req.body;

    // Basic validation
    if (!name || !phone || !email) {
      return res.status(400).json({ success: false, message: 'Name, phone, and email are required.' });
    }

    // Prevent duplicate registration by phone
    const existing = registrations.find((r) => r.phone === phone);
    if (existing) {
      return res.json({
        success: true,
        message: 'Already registered! Resending your Zoom link on WhatsApp.',
        alreadyRegistered: true,
      });
    }

    const registration = {
      id: crypto.randomUUID(),
      name,
      phone,
      email,
      goal,
      regType: regType || 'FREE',
      paymentId: paymentId || null,
      utrId: utrId || null,
      registeredAt: new Date().toISOString(),
    };

    registrations.push(registration);
    console.log(`✅ New registration: ${name} (${phone}) - ${regType}`);

    // Send WhatsApp message
    const whatsappResult = await sendWhatsAppMessage(registration);
    console.log('📱 WhatsApp send result:', whatsappResult);

    res.json({
      success: true,
      message: 'Registration successful! Zoom link sent on WhatsApp.',
      registrationId: registration.id,
      whatsappSent: whatsappResult.success,
    });

  } catch (error) {
    console.error('Registration error:', error.message);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ============================================
//  ROUTE: Get all registrations (admin)
// ============================================
app.get('/api/admin/registrations', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ count: registrations.length, registrations });
});

// ============================================
//  ROUTE: Razorpay webhook
// ============================================
app.post('/api/payment/razorpay/webhook', (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const body      = JSON.stringify(req.body);

  const expected = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (signature !== expected) {
    console.warn('⚠️ Invalid Razorpay webhook signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = req.body;
  console.log('💳 Razorpay webhook event:', event.event);

  if (event.event === 'payment.captured') {
    const payment = event.payload.payment.entity;
    console.log(`✅ Payment captured: ₹${payment.amount / 100} from ${payment.contact}`);
    // Payment is already handled client-side via handler function
    // Webhook provides server-side confirmation
  }

  res.json({ received: true });
});

// ============================================
//  ROUTE: PhonePe — Initiate Payment
// ============================================
app.post('/api/payment/phonepe/initiate', async (req, res) => {
  try {
    const { amount, name, phone, email } = req.body;
    const merchantTransactionId = 'SUDHA_' + Date.now();

    const payloadData = {
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: 'USER_' + phone.replace('+', ''),
      amount,  // in paise
      redirectUrl: `${req.protocol}://${req.get('host')}/api/payment/phonepe/callback?txnId=${merchantTransactionId}`,
      redirectMode: 'REDIRECT',
      callbackUrl: `${req.protocol}://${req.get('host')}/api/payment/phonepe/webhook`,
      mobileNumber: phone.replace('+91', '').replace('+', ''),
      paymentInstrument: { type: 'PAY_PAGE' },
    };

    const base64Payload = Buffer.from(JSON.stringify(payloadData)).toString('base64');
    const checksum = crypto
      .createHash('sha256')
      .update(base64Payload + '/pg/v1/pay' + PHONEPE_SALT_KEY)
      .digest('hex') + '###' + PHONEPE_SALT_INDEX;

    const response = await axios.post(
      `${PHONEPE_BASE}/pg/v1/pay`,
      { request: base64Payload },
      { headers: { 'Content-Type': 'application/json', 'X-VERIFY': checksum } }
    );

    if (response.data.success) {
      // Store pending transaction
      registrations.push({
        id: merchantTransactionId,
        name, phone: '+91' + phone, email,
        regType: 'VIP',
        paymentStatus: 'PENDING',
        paymentMethod: 'phonepe',
        registeredAt: new Date().toISOString(),
      });

      res.json({
        success: true,
        redirectUrl: response.data.data.instrumentResponse.redirectInfo.url,
        transactionId: merchantTransactionId,
      });
    } else {
      res.json({ success: false, message: 'PhonePe initiation failed.' });
    }

  } catch (error) {
    console.error('PhonePe initiate error:', error.response?.data || error.message);
    res.status(500).json({ success: false, message: 'Payment server error.' });
  }
});

// ============================================
//  ROUTE: PhonePe — Payment Callback
// ============================================
app.get('/api/payment/phonepe/callback', async (req, res) => {
  const { txnId } = req.query;
  try {
    const statusResult = await checkPhonePeStatus(txnId);
    if (statusResult.success && statusResult.code === 'PAYMENT_SUCCESS') {
      // Find the pending registration
      const reg = registrations.find((r) => r.id === txnId);
      if (reg) {
        reg.paymentStatus = 'SUCCESS';
        reg.paymentId = statusResult.transactionId;
        await sendWhatsAppMessage(reg);
        console.log(`✅ PhonePe payment success for ${reg.phone}`);
      }
      // Redirect to success page
      res.redirect('/?payment=success');
    } else {
      res.redirect('/?payment=failed');
    }
  } catch (err) {
    console.error('PhonePe callback error:', err.message);
    res.redirect('/?payment=error');
  }
});

// ============================================
//  ROUTE: PhonePe Webhook (server-to-server)
// ============================================
app.post('/api/payment/phonepe/webhook', (req, res) => {
  const { response: encodedResponse } = req.body;
  const xVerify = req.headers['x-verify'];

  if (!encodedResponse || !xVerify) return res.status(400).send('Bad request');

  const [receivedHash] = xVerify.split('###');
  const expectedHash = crypto
    .createHash('sha256')
    .update(encodedResponse + PHONEPE_SALT_KEY)
    .digest('hex');

  if (receivedHash !== expectedHash) {
    console.warn('⚠️ Invalid PhonePe webhook signature');
    return res.status(400).send('Invalid signature');
  }

  const decoded = JSON.parse(Buffer.from(encodedResponse, 'base64').toString('utf8'));
  console.log('📲 PhonePe webhook:', decoded.code, decoded.data?.merchantTransactionId);

  res.json({ success: true });
});

// ============================================
//  HELPER: Check PhonePe payment status
// ============================================
async function checkPhonePeStatus(merchantTransactionId) {
  const path     = `/pg/v1/status/${PHONEPE_MERCHANT_ID}/${merchantTransactionId}`;
  const checksum = crypto
    .createHash('sha256')
    .update(path + PHONEPE_SALT_KEY)
    .digest('hex') + '###' + PHONEPE_SALT_INDEX;

  const response = await axios.get(`${PHONEPE_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', 'X-VERIFY': checksum, 'X-MERCHANT-ID': PHONEPE_MERCHANT_ID },
  });

  return response.data;
}

// ============================================
//  HELPER: Send WhatsApp Message
//  Auto-selects provider based on env vars
// ============================================
async function sendWhatsAppMessage(registration) {
  const { name, phone, regType } = registration;

  // Build message
  const message = buildWhatsAppMessage(name, regType);

  try {
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
      return await sendViaTwilio(phone, message);
    } else if (META_WHATSAPP_TOKEN && META_PHONE_NUMBER_ID) {
      return await sendViaMetaAPI(phone, message);
    } else {
      console.warn('⚠️ No WhatsApp provider configured. Set TWILIO or META env vars.');
      return { success: false, message: 'No WhatsApp provider configured' };
    }
  } catch (err) {
    console.error('WhatsApp send error:', err.message);
    return { success: false, error: err.message };
  }
}

// ============================================
//  WhatsApp Message Builder
// ============================================
function buildWhatsAppMessage(name, regType) {
  const isVIP = regType === 'VIP';

  return `
🌿 *Sudha Wellness Webinar*

Namaste ${name}! 🙏

${isVIP ? '⭐ *VIP Registration Confirmed!*' : '✅ *Registration Confirmed!*'}

Your spot is reserved for our *Live Wellness Webinar*:

📅 *Date:* ${WEBINAR_DATE_STR}
💻 *Platform:* Zoom

━━━━━━━━━━━━━━━━━
🔗 *Join Zoom Meeting:*
${ZOOM_MEETING_LINK}

🆔 Meeting ID: ${ZOOM_MEETING_ID}
🔑 Password: ${ZOOM_MEETING_PASSWORD}
━━━━━━━━━━━━━━━━━

${isVIP ? `⭐ *Your VIP Benefits:*
• Priority Q&A slot with Dr. Sudha
• 7-day recording access
• Premium wellness workbook PDF
• Personal diet plan template

` : ''}
📌 *Please save this message* and join 5 mins early.

💬 *Facing issues?* Reply to this message for support.

See you on the webinar! 🌱
*— Team Sudha Wellness*
`.trim();
}

// ============================================
//  PROVIDER A: Twilio WhatsApp
// ============================================
async function sendViaTwilio(toPhone, message) {
  // Normalize phone: ensure it's in E.164 format
  const formattedPhone = toPhone.startsWith('+') ? toPhone : '+91' + toPhone;

  const response = await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    new URLSearchParams({
      From: TWILIO_WHATSAPP_FROM,              // whatsapp:+14155238886
      To:   `whatsapp:${formattedPhone}`,
      Body: message,
    }),
    {
      auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  console.log(`📱 Twilio WhatsApp sent to ${formattedPhone}. SID: ${response.data.sid}`);
  return { success: true, sid: response.data.sid };
}

// ============================================
//  PROVIDER B: Meta Cloud API (WhatsApp Business)
// ============================================
async function sendViaMetaAPI(toPhone, message) {
  // Normalize phone: remove + and ensure it starts with country code
  const formattedPhone = toPhone.replace('+', '');

  const response = await axios.post(
    `https://graph.facebook.com/v19.0/${META_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'text',
      text: { body: message },
    },
    {
      headers: {
        Authorization: `Bearer ${META_WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  console.log(`📱 Meta WhatsApp sent to ${formattedPhone}. Message ID: ${response.data.messages[0].id}`);
  return { success: true, messageId: response.data.messages[0].id };
}

// ============================================
//  START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`\n🌿 Sudha Wellness Backend running on http://localhost:${PORT}`);
  console.log(`📡 Webinar registration API ready`);
  console.log(`💳 Payment integrations: Razorpay + PhonePe`);
  console.log(`📱 WhatsApp provider: ${
    TWILIO_ACCOUNT_SID ? 'Twilio' : META_WHATSAPP_TOKEN ? 'Meta Cloud API' : '⚠️ NOT CONFIGURED'
  }\n`);
});

// ============================================
//  AUTH: In-memory users store
//  Replace with DB (MongoDB/PostgreSQL) in prod
// ============================================
const users = [
  // Built-in demo account
  {
    id: 'demo_001',
    firstName: 'Demo', lastName: 'User',
    email: 'demo@sudhawellness.com',
    passwordHash: 'demo1234',   // plain for demo — hash in production
    phone: '+919876543210',
    city: 'Mumbai',
    memberType: 'VIP',
    whatsappConsent: true,
    registrations: [
      {
        id: 'reg_001',
        webinarTitle: 'Holistic Wellness – Live Webinar',
        webinarDate: '2025-07-20T18:00:00+05:30',
        regType: 'VIP',
        paymentId: 'pay_demo123',
        paymentMethod: 'Razorpay',
        amount: 499,
        zoomLink: process.env.ZOOM_MEETING_LINK || 'https://zoom.us/j/DEMO',
        status: 'upcoming',
        registeredAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
    ],
    joinedAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
];

// ---- Simple token store (use JWT in production) ----
const sessions = {};  // token -> userId

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}
function getUserByToken(token) {
  const uid = sessions[token];
  return uid ? users.find(u => u.id === uid) : null;
}

// ============================================
//  ROUTE: Register new user account
// ============================================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, city, whatsappConsent } = req.body;

    if (!firstName || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
    }
    if (users.find(u => u.email === email)) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const newUser = {
      id: 'u_' + crypto.randomUUID().split('-')[0],
      firstName, lastName, email, phone, city,
      passwordHash: password,   // TODO: bcrypt.hash(password, 10) in production
      memberType: 'FREE',
      whatsappConsent: !!whatsappConsent,
      registrations: [],
      joinedAt: new Date().toISOString(),
    };
    users.push(newUser);

    const token = generateToken();
    sessions[token] = newUser.id;

    const { passwordHash, ...safeUser } = newUser;
    console.log(`👤 New account: ${firstName} ${lastName} (${email})`);

    res.json({ success: true, token, user: safeUser });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ============================================
//  ROUTE: Login
// ============================================
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'No account found with this email.' });
    }
    // TODO: bcrypt.compare(password, user.passwordHash) in production
    if (user.passwordHash !== password) {
      return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
    }

    const token = generateToken();
    sessions[token] = user.id;

    const { passwordHash, ...safeUser } = user;
    console.log(`🔑 Login: ${user.email}`);

    res.json({ success: true, token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ============================================
//  ROUTE: Get current user profile (auth protected)
// ============================================
app.get('/api/auth/me', (req, res) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  const user  = getUserByToken(token);
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated.' });

  const { passwordHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// ============================================
//  ROUTE: Update profile
// ============================================
app.put('/api/auth/profile', (req, res) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  const user  = getUserByToken(token);
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated.' });

  const { firstName, lastName, phone, city, goal } = req.body;
  if (firstName) user.firstName = firstName;
  if (lastName  !== undefined) user.lastName  = lastName;
  if (phone)    user.phone    = phone;
  if (city      !== undefined) user.city      = city;
  if (goal      !== undefined) user.goal      = goal;

  const { passwordHash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// ============================================
//  ROUTE: Resend WhatsApp link
// ============================================
app.post('/api/resend-whatsapp', async (req, res) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  const user  = getUserByToken(token);
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated.' });

  const upcoming = (user.registrations || []).find(r => new Date(r.webinarDate) > new Date());
  if (!upcoming) return res.json({ success: false, message: 'No upcoming webinar found.' });

  const result = await sendWhatsAppMessage({ name: user.firstName, phone: user.phone, regType: upcoming.regType });
  res.json({ success: result.success, message: result.success ? 'Zoom link resent on WhatsApp!' : 'Could not send WhatsApp message.' });
});

// ============================================
//  ROUTE: Get user registrations (auth protected)
// ============================================
app.get('/api/auth/registrations', (req, res) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  const user  = getUserByToken(token);
  if (!user) return res.status(401).json({ success: false, message: 'Not authenticated.' });
  res.json({ success: true, registrations: user.registrations || [] });
});

// ============================================
//  ROUTE: Save registration to authenticated user (auth protected)
// ============================================
app.post('/api/auth/save-registration', async (req, res) => {
  try {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '');
    const user  = getUserByToken(token);
    // Accept even without auth — we just add to DB
    const regData = req.body;

    // Save to DB if connected
    if (db.isConnected()) {
      await db.saveRegistration({
        ...regData,
        userId: user ? user.id : null,
        webinarDate: new Date('2025-07-20T18:00:00+05:30'),
      });
      // Upgrade user to VIP if paid
      if (user && regData.regType === 'VIP') {
        user.memberType = 'VIP';
        const dbUser = await db.findUserByEmail(user.email);
        if (dbUser) await db.upgradeToVIP(dbUser._id);
      }
    }

    // Also add to in-memory user object
    if (user) {
      if (!Array.isArray(user.registrations)) user.registrations = [];
      const isDupe = user.registrations.some(r => r.id === regData.id);
      if (!isDupe) user.registrations.push(regData);
      if (regData.regType === 'VIP') user.memberType = 'VIP';
    }

    res.json({ success: true });
  } catch (err) {
    console.error('save-registration error:', err.message);
    res.json({ success: true }); // don't fail the flow
  }
});

// ============================================
//  ADMIN ROUTES
// ============================================

// Admin login (optional — frontend uses hardcoded demo creds too)
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@sudhawellness.com';
  const ADMIN_PASS  = process.env.ADMIN_PASS  || 'admin2025';
  if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
    res.json({ success: true, token: 'admin_' + Date.now() });
  } else {
    res.status(401).json({ success: false, message: 'Invalid admin credentials' });
  }
});

// Get all users (admin)
app.get('/api/admin/users', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (process.env.ADMIN_KEY || 'admin2025')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  let allUsers = users.map(({ passwordHash, ...u }) => u);
  if (db.isConnected()) {
    try { allUsers = await db.getAllUsers(); } catch (_) {}
  }
  res.json({ count: allUsers.length, users: allUsers });
});

// Update admin registrations with DB data
app.get('/api/admin/registrations', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (process.env.ADMIN_KEY || 'admin2025')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  let allRegs = registrations;
  if (db.isConnected()) {
    try { allRegs = await db.getAllRegistrations(); } catch (_) {}
  }
  res.json({ count: allRegs.length, registrations: allRegs });
});

// Admin resend zoom link
app.post('/api/admin/resend-zoom', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (process.env.ADMIN_KEY || 'admin2025')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { phone, name } = req.body;
  const result = await sendWhatsAppMessage({ name: name || 'Participant', phone, regType: 'FREE' });
  res.json({ success: result.success, message: result.success ? 'Zoom link sent!' : 'Send failed.' });
});

// Admin WhatsApp blast
app.post('/api/admin/whatsapp-blast', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (process.env.ADMIN_KEY || 'admin2025')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { message, recipients } = req.body;
  if (!Array.isArray(recipients) || !message) {
    return res.status(400).json({ error: 'recipients array and message required' });
  }
  let sent = 0;
  for (const r of recipients) {
    try {
      const result = await sendWhatsAppMessage({ name: r.name, phone: r.phone, customMessage: message });
      if (result.success) sent++;
    } catch (_) {}
  }
  console.log(`📢 WhatsApp blast: ${sent}/${recipients.length} sent`);
  res.json({ success: true, sent, total: recipients.length });
});

// Test DB connection
app.post('/api/admin/test-db', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (process.env.ADMIN_KEY || 'admin2025')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { uri } = req.body;
  const mongoose = require('mongoose');
  try {
    const testConn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 }).asPromise();
    await testConn.close();
    res.json({ success: true, message: 'Connected successfully!' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Get revenue stats (admin)
app.get('/api/admin/stats', async (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== (process.env.ADMIN_KEY || 'admin2025')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const inMemStats = {
    totalRegistrations: registrations.length,
    vipRegistrations:   registrations.filter(r => r.regType === 'VIP').length,
    totalRevenue:       registrations.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    totalUsers:         users.length,
  };
  if (db.isConnected()) {
    try {
      const dbStats = await db.getRevenueStats();
      return res.json({ ...inMemStats, ...dbStats, source: 'mongodb' });
    } catch (_) {}
  }
  res.json({ ...inMemStats, source: 'memory' });
});

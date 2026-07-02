// ========================================
//  SUDHA WELLNESS WEBINAR — FRONTEND APP
// ========================================

// ---- CONFIG ----
const CONFIG = {
  WEBINAR_DATE:  new Date('2026-07-21T19:00:00+05:30'),
  RAZORPAY_KEY:  'rzp_test_REPLACE_WITH_YOUR_KEY',
  VIP_AMOUNT:    49900,                               // ₹199 in paise (regular), ₹99 early bird
  BACKEND_URL:   'http://localhost:3000',
  ZOOM_LINK:     'https://zoom.us/j/REPLACE_WITH_MEETING_ID?pwd=REPLACE_PASSWORD',
  ZOOM_MEETING_ID: '123 456 7890',
  ZOOM_PASSWORD: 'wellness',
};

// ============================================
//  WEBINAR REGISTRATION STORAGE HELPERS
//  Saves registration to logged-in user profile
// ============================================
const WEBINAR_TITLE = 'Holistic Wellness – Live Webinar';
const WEBINAR_DATE_STR = '2026-07-21T19:00:00+05:30';

let isSubmittingRegistration = false;

function registrationDedupeKey(reg) {
  return (reg.webinarTitle || WEBINAR_TITLE) + '|' + (reg.phone || '');
}

function findExistingRegistration(phone, webinarTitle = WEBINAR_TITLE) {
  const key = webinarTitle + '|' + phone;
  const match = (r) => registrationDedupeKey(r) === key;

  const userRaw = localStorage.getItem('sw_user');
  if (userRaw) {
    const user = JSON.parse(userRaw);
    const found = (user.registrations || []).find(match);
    if (found) return found;
  }

  const allRegs = JSON.parse(localStorage.getItem('sw_all_registrations') || '[]');
  const fromAll = allRegs.find(match);
  if (fromAll) return fromAll;

  const users = JSON.parse(localStorage.getItem('sw_users') || '[]');
  for (const u of users) {
    const found = (u.registrations || []).find(match);
    if (found) return found;
  }

  return null;
}

function buildRegistrationRecord(formData) {
  const existing = findExistingRegistration(formData.phone);
  const regType = formData.regType === 'VIP' ? 'VIP' : 'FREE';

  return {
    id:            existing?.id || ('wreg_' + formData.phone.replace(/\D/g, '') + '_20250720'),
    webinarTitle:  WEBINAR_TITLE,
    webinarDate:   WEBINAR_DATE_STR,
    regType,
    amount:        regType === 'VIP' ? 499 : 0,
    paymentId:     formData.paymentId     || existing?.paymentId     || null,
    paymentMethod: formData.paymentMethod || existing?.paymentMethod || null,
    utrId:         formData.utrId         || existing?.utrId         || null,
    zoomLink:      CONFIG.ZOOM_LINK,
    zoomMeetingId: CONFIG.ZOOM_MEETING_ID,
    zoomPassword:  CONFIG.ZOOM_PASSWORD,
    name:          formData.name,
    email:         formData.email,
    phone:         formData.phone,
    goal:          formData.goal || existing?.goal || '',
    status:        'upcoming',
    registeredAt:  existing?.registeredAt || new Date().toISOString(),
  };
}

function upsertRegistration(list, registration) {
  const key = registrationDedupeKey(registration);
  const idx = list.findIndex(r => registrationDedupeKey(r) === key);
  if (idx > -1) {
    list[idx] = { ...list[idx], ...registration };
    return list;
  }
  list.push(registration);
  return list;
}

function saveRegistrationToUser(registration) {
  // 1. Save to the logged-in user's session object
  const userRaw = localStorage.getItem('sw_user');
  if (userRaw) {
    const user = JSON.parse(userRaw);
    if (!Array.isArray(user.registrations)) user.registrations = [];
    user.registrations = upsertRegistration(user.registrations, registration);
    if (registration.regType === 'VIP') user.memberType = 'VIP';
    localStorage.setItem('sw_user', JSON.stringify(user));

    // 2. Also update the sw_users array so it persists across logouts
    const users = JSON.parse(localStorage.getItem('sw_users') || '[]');
    const idx   = users.findIndex(u => u.id === user.id);
    if (idx > -1) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem('sw_users', JSON.stringify(users));
  }

  // 3. Standalone key for dashboard — upsert, never duplicate
  const allRegs = JSON.parse(localStorage.getItem('sw_all_registrations') || '[]');
  localStorage.setItem('sw_all_registrations', JSON.stringify(upsertRegistration(allRegs, registration)));
}

async function syncRegistrationToBackend(registration) {
  const token = localStorage.getItem('sw_token');
  if (!token) return;
  try {
    await fetch(`${CONFIG.BACKEND_URL}/api/auth/save-registration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify(registration),
    });
  } catch (e) {
    // Backend offline — localStorage already saved, no action needed
    console.log('Backend sync skipped (offline mode)');
  }
}

// ---- COUNTDOWN TIMER ----
function updateCountdown() {
  const now  = new Date();
  const diff = CONFIG.WEBINAR_DATE - now;
  if (diff <= 0) {
    document.getElementById('countdown').innerHTML =
      '<div style="color:#f5c878;font-size:1.1rem;font-weight:600;">🔴 Webinar is LIVE now!</div>';
    return;
  }
  const days    = Math.floor(diff / 86400000);
  const hours   = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  document.getElementById('days').textContent    = String(days).padStart(2,'0');
  document.getElementById('hours').textContent   = String(hours).padStart(2,'0');
  document.getElementById('minutes').textContent = String(minutes).padStart(2,'0');
  document.getElementById('seconds').textContent = String(seconds).padStart(2,'0');
}
setInterval(updateCountdown, 1000);
updateCountdown();

// ---- MOBILE MENU ----
function toggleMenu() {
  document.querySelector('.nav-links').classList.toggle('open');
}

// ---- NAVBAR AUTH STATE (index page) ----
function updateNavbarAuth() {
  const item = document.getElementById('authNavItem');
  if (!item) return;

  let user = null;
  try { user = JSON.parse(localStorage.getItem('sw_user') || 'null'); } catch { user = null; }
  const token = localStorage.getItem('sw_token');

  if (!user || !token) {
    item.innerHTML = '<a href="login.html">Login</a>';
    return;
  }

  const init = (user.firstName || user.name || 'U')[0].toUpperCase();
  const name = user.firstName || (user.name || '').split(' ')[0] || 'Account';

  item.innerHTML = `
    <div class="user-menu" style="position:relative;">
      <button class="user-avatar-btn" type="button" id="navUserBtn" style="display:flex;align-items:center;gap:8px;background:none;border:none;cursor:pointer;font-family:'Poppins',sans-serif;font-size:0.88rem;font-weight:600;color:#333;padding:6px 10px;border-radius:50px;">
        <span style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#2d7a4f,#4CAF50);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:0.88rem;">${init}</span>
        <span>${name}</span><span style="font-size:0.7rem;">▾</span>
      </button>
      <div id="navUserDropdown" style="display:none;position:absolute;right:0;top:calc(100% + 8px);background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);border:1px solid #e0e7e3;min-width:200px;z-index:999;overflow:hidden;">
        <a href="dashboard.html" style="display:block;padding:12px 18px;font-size:0.87rem;color:#333;text-decoration:none;">📋 My Dashboard</a>
        <a href="dashboard.html?tab=bookings" style="display:block;padding:12px 18px;font-size:0.87rem;color:#333;text-decoration:none;">🎫 My Bookings</a>
        <hr style="border:none;border-top:1px solid #e8f0e9;margin:4px 0;"/>
        <a href="#" id="navLogoutLink" style="display:block;padding:12px 18px;font-size:0.87rem;color:#e53935;text-decoration:none;">🚪 Logout</a>
      </div>
    </div>`;

  const btn = document.getElementById('navUserBtn');
  const dd  = document.getElementById('navUserDropdown');
  const logout = document.getElementById('navLogoutLink');

  if (btn && dd) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', (e) => {
      if (!item.contains(e.target)) dd.style.display = 'none';
    });
  }

  if (logout) {
    logout.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('sw_user');
      localStorage.removeItem('sw_token');
      updateNavbarAuth();
      window.location.href = 'login.html';
    });
  }
}

// ---- ACCOUNT (inline signup fields) ----
function toggleAccountFields() {
  const cb = document.getElementById('createAccount');
  const box = document.getElementById('accountFields');
  if (!cb || !box) return;
  box.style.display = cb.checked ? 'block' : 'none';
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Guest',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
  };
}

async function ensureAccountForRegistration() {
  const cb = document.getElementById('createAccount');
  const shouldCreate = cb ? cb.checked : false;
  if (!shouldCreate) return { createdOrLoggedIn: false };

  const fullName = document.getElementById('fullName')?.value?.trim() || '';
  const email = document.getElementById('email')?.value?.trim() || '';
  const phone10 = document.getElementById('phone')?.value?.trim() || '';
  const password = document.getElementById('regPasswordInline')?.value || '';
  const confirm = document.getElementById('regConfirmInline')?.value || '';

  if (!password || password.length < 8) {
    throw new Error('Please create a password (minimum 8 characters) to create an account.');
  }
  if (password !== confirm) {
    throw new Error('Passwords do not match. Please confirm your password.');
  }

  const { firstName, lastName } = splitName(fullName);
  const phone = '+91' + phone10;

  // Try backend register → if already exists, try backend login.
  try {
    const res = await fetch(CONFIG.BACKEND_URL + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, phone, password, whatsappConsent: true }),
    });
    const data = await res.json();

    if (data?.success && data?.token && data?.user) {
      localStorage.setItem('sw_user', JSON.stringify(data.user));
      localStorage.setItem('sw_token', data.token);
      return { createdOrLoggedIn: true, mode: 'registered' };
    }

    // If email exists, try login
    if (res.status === 409) {
      const loginRes = await fetch(CONFIG.BACKEND_URL + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const loginData = await loginRes.json();
      if (loginData?.success && loginData?.token && loginData?.user) {
        localStorage.setItem('sw_user', JSON.stringify(loginData.user));
        localStorage.setItem('sw_token', loginData.token);
        return { createdOrLoggedIn: true, mode: 'logged_in' };
      }
      throw new Error(loginData?.message || 'Account exists, but login failed. Please check your password.');
    }

    throw new Error(data?.message || 'Could not create account. Please try again.');
  } catch (e) {
    // Offline/local fallback (same storage model as auth.js)
    const users = JSON.parse(localStorage.getItem('sw_users') || '[]');
    const existing = users.find(u => u.email === email);

    if (existing) {
      // Login fallback
      if (existing.password && existing.password !== password) {
        throw new Error('Account exists, but password is incorrect. Please login from the Login page.');
      }
      localStorage.setItem('sw_user', JSON.stringify(existing));
      localStorage.setItem('sw_token', 'local_' + existing.id);
      return { createdOrLoggedIn: true, mode: 'logged_in_offline' };
    }

    const newUser = {
      id: 'u_' + Date.now(),
      firstName,
      lastName,
      email,
      phone,
      password,
      city: '',
      whatsappConsent: true,
      memberType: 'FREE',
      registrations: [],
      joinedAt: new Date().toISOString(),
    };
    users.push(newUser);
    localStorage.setItem('sw_users', JSON.stringify(users));
    localStorage.setItem('sw_user', JSON.stringify(newUser));
    localStorage.setItem('sw_token', 'local_' + newUser.id);
    return { createdOrLoggedIn: true, mode: 'registered_offline' };
  }
}

// ---- PAYMENT OPTION TOGGLE ----
function togglePayment(type) {
  document.getElementById('opt-free').classList.remove('active');
  document.getElementById('opt-paid').classList.remove('active');
  document.getElementById('opt-' + type).classList.add('active');
  document.getElementById('paymentMethodSection').style.display = type === 'paid' ? 'block' : 'none';
  document.getElementById('upiQRSection').style.display = 'none';
  const submitBtn = document.getElementById('submitBtn');
  if (type === 'paid') {
    submitBtn.textContent = '⭐ Choose Payment Method Above';
    submitBtn.disabled = true;
  } else {
    submitBtn.textContent = '🚀 Register & Get WhatsApp Link';
    submitBtn.disabled = false;
  }
}

// ---- SHOW UPI QR ----
function showUPIQR() {
  document.getElementById('upiQRSection').style.display = 'block';
  document.getElementById('submitBtn').disabled = true;
  document.getElementById('submitBtn').textContent = '⏳ Complete UPI Payment First';
}

// ---- CONFIRM UPI PAYMENT ----
function confirmUPIPayment() {
  const utr = document.getElementById('utrId').value.trim();
  if (!utr || utr.length < 8) {
    alert('Please enter a valid UTR / Transaction ID from your UPI app.');
    return;
  }
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = false;
  submitBtn.textContent = '🚀 Register & Confirm Registration';
  document.getElementById('upiQRSection').style.display = 'none';
  alert('✅ UTR saved! Click the Register button below to complete.');
}

// ---- RAZORPAY PAYMENT ----
function payWithRazorpay() {
  const name  = document.getElementById('fullName').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  if (!name || !phone || !email) {
    alert('Please fill in your Name, WhatsApp number, and Email first.');
    return;
  }
  const options = {
    key:         CONFIG.RAZORPAY_KEY,
    amount:      CONFIG.VIP_AMOUNT,
    currency:    'INR',
    name:        'Sudha Wellness Webinar',
    description: 'VIP Webinar Registration',
    image:       'https://via.placeholder.com/60x60/2d7a4f/ffffff?text=SW',
    prefill:     { name, email, contact: '+91' + phone },
    theme:       { color: '#2d7a4f' },
    method:      { upi: true, card: true, netbanking: true, wallet: true },
    handler: function (response) {
      const formData = collectFormData();
      formData.paymentId     = response.razorpay_payment_id;
      formData.paymentMethod = 'Razorpay';
      formData.regType       = 'VIP';
      submitRegistration(formData);
    },
    modal: { ondismiss: function () { console.log('Razorpay closed'); } },
  };
  const rzp = new Razorpay(options);
  rzp.on('payment.failed', function (response) {
    alert('Payment failed: ' + response.error.description + '\nPlease try again.');
  });
  rzp.open();
}

// ---- PHONEPE PAYMENT ----
function payWithPhonePe() {
  const name  = document.getElementById('fullName').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  if (!name || !phone || !email) {
    alert('Please fill in your Name, WhatsApp number, and Email first.');
    return;
  }
  // Store pending data so we can save after redirect-back
  const pending = { name, phone: '+91' + phone, email,
                    goal: document.getElementById('goal').value,
                    regType: 'VIP', paymentMethod: 'PhonePe' };
  localStorage.setItem('sw_pending_reg', JSON.stringify(pending));

  fetch(`${CONFIG.BACKEND_URL}/api/payment/phonepe/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: CONFIG.VIP_AMOUNT, name, phone, email }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.success && data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        alert('PhonePe initiation failed. Please try Razorpay or UPI QR instead.');
      }
    })
    .catch(() => alert('Could not connect to payment server. Please try another method.'));
}

// ---- COLLECT FORM DATA ----
function collectFormData() {
  return {
    name:  document.getElementById('fullName').value.trim(),
    phone: '+91' + document.getElementById('phone').value.trim(),
    email: document.getElementById('email').value.trim(),
    goal:  document.getElementById('goal').value,
    regType: document.querySelector('input[name="regType"]:checked').value === 'paid' ? 'VIP' : 'FREE',
    utrId: document.getElementById('utrId')?.value?.trim() || null,
    registeredAt: new Date().toISOString(),
  };
}

// ---- MAIN FORM SUBMIT ----
async function handleRegistration(event) {
  event.preventDefault();

  // Create/login account first (optional), then register webinar
  try {
    await ensureAccountForRegistration();
  } catch (e) {
    alert(e.message || 'Account setup failed.');
    return;
  }

  const regType = document.querySelector('input[name="regType"]:checked').value;
  if (regType === 'paid') {
    const utr = document.getElementById('utrId')?.value?.trim();
    if (!utr) {
      alert('Please complete payment first using one of the payment options above.');
      return;
    }
  }
  const formData = collectFormData();
  await submitRegistration(formData);
}

// ---- SUBMIT REGISTRATION (core function) ----
async function submitRegistration(formData) {
  if (isSubmittingRegistration) return;
  isSubmittingRegistration = true;

  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled    = true;
    submitBtn.textContent = '⏳ Saving your registration...';
  }

  // Build once — stable id prevents duplicate rows in dashboard
  const registration = buildRegistrationRecord(formData);

  try {
    // 1. Save locally first (works offline, instant)
    saveRegistrationToUser(registration);

    // 2. Try to register on backend (sends WhatsApp)
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:      formData.name,
        phone:     formData.phone,
        email:     formData.email,
        goal:      formData.goal,
        regType:   formData.regType,
        paymentId: formData.paymentId    || null,
        utrId:     formData.utrId        || null,
      }),
    });
    const data = await response.json();
    if (data.registrationId) registration.backendId = data.registrationId;

    // 3. Sync registration to the user account on backend
    await syncRegistrationToBackend(registration);

    showSuccessModal(formData, registration, false);

  } catch (error) {
    // Already saved locally above — do NOT save again
    console.warn('Backend offline, saved to localStorage only:', error.message);
    showSuccessModal(formData, registration, true);
  } finally {
    isSubmittingRegistration = false;
    if (submitBtn) {
      submitBtn.disabled    = false;
      submitBtn.textContent = '🚀 Register & Get WhatsApp Link';
    }
  }
}

// ---- SUCCESS MODAL ----
function showSuccessModal(formData, registration, offline = false) {
  const modalMsg     = document.getElementById('modalMessage');
  const modalDetails = document.getElementById('modalDetails');
  const session      = JSON.parse(localStorage.getItem('sw_user') || 'null');

  modalMsg.textContent = offline
    ? 'You\'re registered! Our team will send your Zoom link on WhatsApp shortly.'
    : `Your Zoom link has been sent to ${formData.phone} on WhatsApp!`;

  const payLine = formData.regType === 'VIP'
    ? `💳 Payment: ₹499 ${formData.paymentId ? '(' + formData.paymentId + ')' : '(confirmed)'}`
    : '🎁 Registration: FREE';

  const dashLine = session
    ? '👉 <a href="dashboard.html" style="color:#2d7a4f;font-weight:700;">View in My Dashboard →</a>'
    : '👉 <a href="register.html" style="color:#2d7a4f;font-weight:700;">Create account to track your booking →</a>';

  modalDetails.innerHTML = `
    <strong>📋 Registration Confirmed!</strong><br/><br/>
    👤 Name: <strong>${formData.name}</strong><br/>
    📧 Email: ${formData.email}<br/>
    📱 WhatsApp: ${formData.phone}<br/>
    📅 Date: <strong>Tuesday, 21 July 2026 at 7:00 PM IST</strong><br/>
    💻 Platform: Zoom<br/>
    🎫 Type: <strong>${formData.regType}</strong> Registration<br/>
    ${payLine}<br/><br/>
    🔗 Zoom Link: <code style="font-size:0.75rem;word-break:break-all;">${CONFIG.ZOOM_LINK}</code><br/><br/>
    ${dashLine}
  `;

  document.getElementById('successModal').style.display = 'flex';

  // Reset form
  document.getElementById('registerForm').reset();
  document.getElementById('paymentMethodSection').style.display = 'none';
  document.getElementById('upiQRSection').style.display        = 'none';
  document.getElementById('opt-free').classList.add('active');
  document.getElementById('opt-paid').classList.remove('active');
}

// ---- CLOSE MODAL ----
function closeModal() {
  document.getElementById('successModal').style.display = 'none';
}
document.getElementById('successModal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

// ---- HANDLE PHONEPE REDIRECT BACK ----
(function handlePhonePeReturn() {
  const params  = new URLSearchParams(window.location.search);
  const payment = params.get('payment');
  if (!payment) return;

  window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);

  const pending = JSON.parse(localStorage.getItem('sw_pending_reg') || 'null');
  if (payment === 'success' && pending) {
    localStorage.removeItem('sw_pending_reg');
    pending.paymentId     = 'PP_' + Date.now();
    pending.paymentMethod = 'PhonePe';
    submitRegistration(pending);
    // Scroll to registration section
    setTimeout(() => document.getElementById('register')?.scrollIntoView({ behavior: 'smooth' }), 300);
  } else if (payment === 'failed') {
    alert('❌ Payment was not successful. Please try again.');
  }
})();

// ---- FAQ ACCORDION ----
function toggleFAQ(btn) {
  const answer = btn.nextElementSibling;
  const isOpen = answer.classList.contains('show');
  document.querySelectorAll('.faq-a').forEach(a => a.classList.remove('show'));
  document.querySelectorAll('.faq-q').forEach(q => q.classList.remove('open'));
  if (!isOpen) { answer.classList.add('show'); btn.classList.add('open'); }
}

// ---- NAVBAR SCROLL ----
window.addEventListener('scroll', () => {
  document.querySelector('.navbar').style.boxShadow = window.scrollY > 20
    ? '0 4px 30px rgba(0,0,0,0.15)'
    : '0 2px 20px rgba(0,0,0,0.08)';
});

// ---- SMOOTH SCROLL ----
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.querySelector('.nav-links').classList.remove('open');
    }
  });
});

// ---- INIT (safe on all pages that include app.js) ----
document.addEventListener('DOMContentLoaded', () => {
  updateNavbarAuth();
  toggleAccountFields();
});

window.addEventListener('layoutReady', updateNavbarAuth);

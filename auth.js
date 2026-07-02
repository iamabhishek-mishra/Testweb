// ============================================
//  SUDHA WELLNESS — AUTH.JS
//  Shared across: register.html, login.html, dashboard.html
// ============================================

const BACKEND_URL = 'http://localhost:3000';

// ============================================
//  SESSION HELPERS
// ============================================
function saveSession(user, token) {
  localStorage.setItem('sw_user',  JSON.stringify(user));
  localStorage.setItem('sw_token', token);
}
function getSession() {
  const user  = localStorage.getItem('sw_user');
  const token = localStorage.getItem('sw_token');
  if (!user || !token) return null;
  try { return { user: JSON.parse(user), token }; } catch { return null; }
}
function clearSession() {
  localStorage.removeItem('sw_user');
  localStorage.removeItem('sw_token');
}
function logout() {
  clearSession();
  window.location.href = 'login.html';
}
function redirectIfLoggedIn() {
  if (getSession()) window.location.href = 'dashboard.html';
}
function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = 'login.html?next=' + encodeURIComponent(window.location.pathname);
    return null;
  }
  return session;
}

// ============================================
//  UI HELPERS
// ============================================
function showError(msg) {
  const el = document.getElementById('errorBanner');
  const ok = document.getElementById('successBanner');
  if (!el) return;
  el.textContent   = '⚠️ ' + msg;
  el.style.display = 'block';
  if (ok) ok.style.display = 'none';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function showSuccess(msg) {
  const el = document.getElementById('successBanner');
  const er = document.getElementById('errorBanner');
  if (!el) return;
  el.textContent   = '✅ ' + msg;
  el.style.display = 'block';
  if (er) er.style.display = 'none';
}
function clearBanners() {
  const e = document.getElementById('errorBanner');
  const s = document.getElementById('successBanner');
  if (e) e.style.display = 'none';
  if (s) s.style.display = 'none';
}
function setFieldError(id, msg) {
  const el    = document.getElementById('err-' + id);
  const input = document.getElementById(id);
  if (el) el.textContent = msg;
  if (input) input.style.borderColor = msg ? '#e53935' : '';
}
function clearAllFieldErrors() {
  document.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });
  document.querySelectorAll('.form-group input, .form-group select').forEach(el => { el.style.borderColor = ''; });
}
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type     = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? '👁' : '🙈';
}
function toggleMenu() {
  document.querySelector('.nav-links')?.classList.toggle('open');
}
function toggleUserMenu() {
  const dd = document.getElementById('userDropdown');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

// ============================================
//  NAVBAR — update based on session
// ============================================
function updateNavbar() {
  const session  = getSession();
  const authItem = document.getElementById('authNavItem');
  if (!authItem) return;

  if (session) {
    const init = (session.user.firstName || session.user.name || 'U')[0].toUpperCase();
    const name  = session.user.firstName || (session.user.name || '').split(' ')[0] || 'Account';
    authItem.innerHTML = `
      <div class="user-menu" id="userMenu" style="position:relative;">
        <button class="user-avatar-btn" onclick="toggleUserMenu()" style="display:flex;align-items:center;gap:8px;background:none;border:none;cursor:pointer;font-family:'Poppins',sans-serif;font-size:0.88rem;font-weight:600;color:#333;padding:6px 10px;border-radius:50px;">
          <span style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#2d7a4f,#4CAF50);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:0.88rem;">${init}</span>
          <span>${name}</span><span style="font-size:0.7rem;">▾</span>
        </button>
        <div id="userDropdown" style="display:none;position:absolute;right:0;top:calc(100% + 8px);background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);border:1px solid #e0e7e3;min-width:200px;z-index:999;overflow:hidden;">
          <a href="dashboard.html" style="display:block;padding:12px 18px;font-size:0.87rem;color:#333;text-decoration:none;">📋 My Dashboard</a>
          <a href="dashboard.html?tab=bookings" style="display:block;padding:12px 18px;font-size:0.87rem;color:#333;text-decoration:none;">🎫 My Bookings</a>
          <hr style="border:none;border-top:1px solid #e8f0e9;margin:4px 0;"/>
          <a href="#" onclick="logout();return false;" style="display:block;padding:12px 18px;font-size:0.87rem;color:#e53935;text-decoration:none;">🚪 Logout</a>
        </div>
      </div>`;
    // Close dropdown on outside click
    document.addEventListener('click', function onOutsideClick(e) {
      const menu = document.getElementById('userDropdown');
      const btn  = authItem.querySelector('.user-avatar-btn');
      if (menu && btn && !authItem.contains(e.target)) menu.style.display = 'none';
    });
  } else {
    authItem.innerHTML = '<a href="login.html">Login</a>';
  }
}

// ============================================
//  PASSWORD STRENGTH
// ============================================
window.addEventListener('layoutReady', updateNavbar);
document.addEventListener('DOMContentLoaded', function () {
  const passInput = document.getElementById('regPassword');
  if (passInput) {
    passInput.addEventListener('input', function () {
      const val         = this.value;
      const strengthBox = document.getElementById('passStrength');
      const fill        = document.getElementById('strengthFill');
      const text        = document.getElementById('strengthText');
      if (!strengthBox) return;
      if (!val) { strengthBox.style.display = 'none'; return; }
      strengthBox.style.display = 'flex';
      let score = 0;
      if (val.length >= 8)          score++;
      if (/[A-Z]/.test(val))        score++;
      if (/[0-9]/.test(val))        score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;
      const levels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
      const colors = ['', '#e53935', '#f57c00', '#388e3c', '#1b5e20'];
      const widths = ['0%', '25%', '50%', '75%', '100%'];
      if (fill) { fill.style.width = widths[score]; fill.style.background = colors[score]; }
      if (text) { text.textContent = levels[score]; text.style.color = colors[score]; }
    });
  }
});

// ============================================
//  SIGNUP HANDLER
// ============================================
async function handleSignup(e) {
  e.preventDefault();
  clearAllFieldErrors();
  clearBanners();

  const firstName  = document.getElementById('firstName').value.trim();
  const lastName   = document.getElementById('lastName').value.trim();
  const email      = document.getElementById('regEmail').value.trim();
  const phone      = document.getElementById('regPhone').value.trim();
  const password   = document.getElementById('regPassword').value;
  const confirm    = document.getElementById('regConfirm').value;
  const city       = document.getElementById('regCity').value.trim();
  const agreeTerms = document.getElementById('agreeTerms').checked;
  const whatsapp   = document.getElementById('whatsappConsent').checked;

  let valid = true;
  if (!firstName)                                              { setFieldError('firstName',   'First name is required');       valid = false; }
  if (!lastName)                                               { setFieldError('lastName',    'Last name is required');        valid = false; }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))   { setFieldError('regEmail',    'Valid email required');         valid = false; }
  if (!phone || phone.length !== 10 || !/^\d{10}$/.test(phone)) { setFieldError('regPhone', 'Valid 10-digit number required'); valid = false; }
  if (!password || password.length < 8)                        { setFieldError('regPassword', 'Min. 8 characters required');  valid = false; }
  if (password !== confirm)                                    { setFieldError('regConfirm',  'Passwords do not match');       valid = false; }
  if (!agreeTerms)                                             { setFieldError('agreeTerms',  'Please agree to terms');        valid = false; }
  if (!valid) return;

  const btn = document.getElementById('signupBtn');
  document.getElementById('signupBtnText').style.display   = 'none';
  document.getElementById('signupBtnLoader').style.display = 'inline';
  btn.disabled = true;

  try {
    const res  = await fetch(BACKEND_URL + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email, phone: '+91' + phone, password, city, whatsappConsent: whatsapp }),
    });
    const data = await res.json();
    if (data.success) {
      saveSession(data.user, data.token);
      showSuccess('Account created! Redirecting...');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
      return;
    }
    showError(data.message || 'Registration failed.');
  } catch (_) {
    // --- Offline / localStorage fallback ---
    const users = JSON.parse(localStorage.getItem('sw_users') || '[]');
    if (users.find(u => u.email === email)) {
      showError('An account with this email already exists. Please login.');
    } else {
      const newUser = {
        id: 'u_' + Date.now(), firstName, lastName, email,
        phone: '+91' + phone, password, city,
        whatsappConsent: whatsapp, memberType: 'FREE',
        registrations: [], joinedAt: new Date().toISOString(),
      };
      users.push(newUser);
      localStorage.setItem('sw_users', JSON.stringify(users));
      saveSession(newUser, 'local_' + newUser.id);
      showSuccess('Account created! Redirecting...');
      setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
    }
  } finally {
    document.getElementById('signupBtnText').style.display   = 'inline';
    document.getElementById('signupBtnLoader').style.display = 'none';
    btn.disabled = false;
  }
}

// ============================================
//  LOGIN HANDLER
// ============================================
async function handleLogin(e) {
  e.preventDefault();
  clearAllFieldErrors();
  clearBanners();

  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  let valid = true;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setFieldError('loginEmail',    'Valid email required');    valid = false; }
  if (!password)                                             { setFieldError('loginPassword', 'Password is required');   valid = false; }
  if (!valid) return;

  const btn = document.getElementById('loginBtn');
  document.getElementById('loginBtnText').style.display   = 'none';
  document.getElementById('loginBtnLoader').style.display = 'inline';
  btn.disabled = true;

  try {
    const res  = await fetch(BACKEND_URL + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.success) {
      saveSession(data.user, data.token);
      showSuccess('Login successful! Redirecting...');
      setTimeout(() => {
        const next = new URLSearchParams(window.location.search).get('next');
        window.location.href = next || 'dashboard.html';
      }, 800);
      return;
    }
    showError(data.message || 'Invalid email or password.');
  } catch (_) {
    // --- Offline / localStorage fallback ---
    const users = JSON.parse(localStorage.getItem('sw_users') || '[]');

    // Built-in demo account
    const DEMO = {
      id: 'demo_001', firstName: 'Demo', lastName: 'User',
      email: 'demo@sudhawellness.com', password: 'demo1234',
      phone: '+919876543210', city: 'Mumbai', memberType: 'VIP',
      registrations: [
        { id: 'reg_001', webinarTitle: 'Holistic Wellness – Live Webinar',
          webinarDate: '2025-07-20T18:00:00+05:30', regType: 'VIP',
          paymentId: 'pay_demo123', paymentMethod: 'Razorpay', amount: 499,
          zoomLink: 'https://zoom.us/j/DEMO_MEETING', name: 'Demo User',
          email: 'demo@sudhawellness.com', phone: '+919876543210',
          status: 'upcoming', registeredAt: new Date(Date.now() - 3*86400000).toISOString() },
        { id: 'reg_002', webinarTitle: 'Ayurveda Basics for Modern Life',
          webinarDate: '2025-05-10T18:00:00+05:30', regType: 'FREE',
          paymentId: null, amount: 0, zoomLink: 'https://zoom.us/j/DEMO_PAST',
          name: 'Demo User', email: 'demo@sudhawellness.com', phone: '+919876543210',
          status: 'completed', registeredAt: new Date(Date.now() - 50*86400000).toISOString() }
      ],
      joinedAt: new Date(Date.now() - 60*86400000).toISOString(),
    };

    let matched = null;
    if (email === DEMO.email && password === DEMO.password) {
      matched = DEMO;
    } else {
      matched = users.find(u => u.email === email);
      if (!matched) { showError('No account found with this email. Please register first.'); return; }
      if (matched.password && matched.password !== password) { showError('Incorrect password. Please try again.'); return; }
    }

    saveSession(matched, 'local_' + matched.id);
    showSuccess('Login successful! Redirecting...');
    setTimeout(() => {
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next || 'dashboard.html';
    }, 800);
  } finally {
    document.getElementById('loginBtnText').style.display   = 'inline';
    document.getElementById('loginBtnLoader').style.display = 'none';
    btn.disabled = false;
  }
}

function socialAuth(provider) {
  alert(provider + ' login requires OAuth setup. Please use email & password for now.');
}

// ============================================
//  INIT on every page load
// ============================================
document.addEventListener('DOMContentLoaded', function () {
  const page = window.location.pathname;
  if (page.includes('register.html') || page.includes('login.html')) {
    redirectIfLoggedIn();
  }
  updateNavbar();
});

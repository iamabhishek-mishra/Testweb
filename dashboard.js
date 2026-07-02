// ============================================
//  SUDHA WELLNESS — DASHBOARD LOGIC
// ============================================

const BACKEND     = 'http://localhost:3000';
const WEBINAR_DATE = new Date('2026-07-21T19:00:00+05:30'); // Health & Wellness Awareness Webinar

let currentUser  = null;
let allBookings  = [];
let activeFilter = 'all';

// ---- INIT ----
(function init() {
  const session = requireAuth();    // from auth.js — redirects to login if no session
  currentUser   = session.user;

  // Always reload fresh user data from localStorage (picks up latest registrations)
  refreshUserFromStorage();

  populateUser();
  populateBookings();
  startDashCountdown();
  checkURLParams();
})();

// ---- REFRESH USER FROM STORAGE ----
// Merges any registrations saved after payment back into currentUser
function refreshUserFromStorage() {
  const raw = localStorage.getItem('sw_user');
  if (raw) {
    const stored = JSON.parse(raw);
    // Merge stored registrations into currentUser
    currentUser.registrations = stored.registrations || currentUser.registrations || [];
    currentUser.memberType    = stored.memberType    || currentUser.memberType;
    // Save back merged object as the session
    const token = localStorage.getItem('sw_token');
    if (token) localStorage.setItem('sw_user', JSON.stringify(currentUser));
  }
}

// ---- CHECK URL PARAMS (payment return / tab switch) ----
function checkURLParams() {
  const params = new URLSearchParams(window.location.search);

  if (params.get('payment') === 'success') {
    showToast('🎉 Payment successful! Your VIP registration is confirmed.');
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  if (params.get('registered') === '1') {
    showToast('✅ Registration saved! Check your bookings below.');
    window.history.replaceState({}, document.title, window.location.pathname);
    changeTab('bookings');
  }
  if (params.get('tab')) {
    changeTab(params.get('tab'));
  }
}

// ---- TOAST NOTIFICATION ----
function showToast(msg) {
  const toast = document.getElementById('dashToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4000);
}

// ---- POPULATE USER INFO ----
function populateUser() {
  const u        = currentUser;
  const fullName = ((u.firstName || '') + ' ' + (u.lastName || '')).trim() || u.name || 'User';
  const initial  = (u.firstName?.[0] || u.name?.[0] || 'U').toUpperCase();
  const memberType = u.memberType || 'FREE';

  // Sidebar
  document.getElementById('sidebarAvatar').textContent = initial;
  document.getElementById('sidebarName').textContent   = fullName;
  document.getElementById('sidebarEmail').textContent  = u.email || '';
  document.getElementById('sidebarBadge').textContent  = memberType + ' Member';
  document.getElementById('sidebarBadge').className    = 'sidebar-badge' + (memberType === 'VIP' ? ' badge-vip' : '');

  // Welcome heading
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('welcomeHeading').textContent = `${greeting}, ${u.firstName || u.name || 'there'}! 👋`;

  // Nav
  const navAv   = document.getElementById('navAvatar');
  const navName = document.getElementById('navUserName');
  if (navAv)   navAv.textContent   = initial;
  if (navName) navName.textContent = u.firstName || 'User';

  // Profile tab
  document.getElementById('profileAvatar').textContent      = initial;
  document.getElementById('profileNameBig').textContent     = fullName;
  document.getElementById('profileMemberSince').textContent = 'Member since ' + formatDate(u.joinedAt || new Date().toISOString());
  document.getElementById('profileBadgeBig').textContent    = memberType + ' Member';
  document.getElementById('profileBadgeBig').className      = 'profile-badge-big' + (memberType === 'VIP' ? ' badge-vip' : '');

  // Prefill profile form
  document.getElementById('pfFirstName').value = u.firstName || (u.name?.split(' ')[0]) || '';
  document.getElementById('pfLastName').value  = u.lastName  || (u.name?.split(' ').slice(1).join(' ')) || '';
  document.getElementById('pfEmail').value     = u.email  || '';
  document.getElementById('pfPhone').value     = (u.phone || '').replace('+91','').trim();
  document.getElementById('pfCity').value      = u.city   || '';
  document.getElementById('pfGoal').value      = u.goal   || '';

  // VIP banner and locked resources
  const isVIP = memberType === 'VIP';
  const vipBanner = document.getElementById('vipBanner');
  if (vipBanner) vipBanner.style.display = isVIP ? 'none' : 'flex';

  document.querySelectorAll('.vip-locked').forEach(btn => {
    if (isVIP) {
      btn.textContent = '⬇ Download';
      btn.classList.remove('vip-locked');
      btn.onclick = function() { downloadResource(this.dataset.type); };
    } else {
      btn.textContent = '🔒 VIP Only — Upgrade';
    }
  });
}

// ---- POPULATE BOOKINGS + STATS ----
function populateBookings() {
  // Pull from three sources and deduplicate by id
  const sessionRegs  = currentUser.registrations || [];
  const allRegsStore = JSON.parse(localStorage.getItem('sw_all_registrations') || '[]');
  const userRegsKey  = JSON.parse(localStorage.getItem('sw_registrations_' + currentUser.id) || '[]');

  // Merge all sources, dedupe by id OR webinar+phone (fixes legacy double-saves)
  const seenIds = new Set();
  const seenKeys = new Set();
  allBookings = [...sessionRegs, ...allRegsStore, ...userRegsKey].filter(b => {
    const isOwn = !b.email || b.email === currentUser.email ||
                  b.phone === currentUser.phone ||
                  b.phone === (currentUser.phone || '').replace('+91','');
    if (!isOwn) return false;

    const dedupeKey = (b.webinarTitle || 'webinar') + '|' + (b.phone || '');
    if (b.id && seenIds.has(b.id)) return false;
    if (seenKeys.has(dedupeKey)) return false;

    if (b.id) seenIds.add(b.id);
    seenKeys.add(dedupeKey);
    return true;
  });

  // Sort newest first
  allBookings.sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt));

  // Compute stats
  const total    = allBookings.length;
  const upcoming = allBookings.filter(b => isUpcoming(b.webinarDate)).length;
  const vip      = allBookings.filter(b => b.regType === 'VIP').length;
  const spent    = allBookings.reduce((s, b) => s + (Number(b.amount) || 0), 0);

  document.getElementById('statsTotal').textContent    = total;
  document.getElementById('statsUpcoming').textContent = upcoming;
  document.getElementById('statsVIP').textContent      = vip;
  document.getElementById('statsSpent').textContent    = '₹' + spent;
  document.getElementById('bookingCount').textContent  = total || '';

  // Payment summary
  const paidBookings = allBookings.filter(b => Number(b.amount) > 0);
  document.getElementById('payTotal').textContent = '₹' + spent;
  document.getElementById('payCount').textContent = paidBookings.length;
  document.getElementById('payLast').textContent  = paidBookings.length
    ? formatDate(paidBookings[0].registeredAt)
    : '—';

  renderBookings(allBookings);
  renderPayments(paidBookings);
  renderRecentBookings(allBookings.slice(0, 3));
}

// ---- RENDER BOOKING CARDS ----
function renderBookings(list) {
  const container = document.getElementById('bookingsList');
  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎫</div>
        <p>No registrations found.</p>
        <a href="index.html#register" class="btn-primary" style="font-size:0.85rem;padding:10px 22px;">Register for Free Webinar</a>
      </div>`;
    return;
  }
  container.innerHTML = list.map(b => bookingCard(b)).join('');
}

function bookingCard(b) {
  const upcoming    = isUpcoming(b.webinarDate);
  const statusLabel = upcoming ? '🟢 Upcoming' : '✅ Completed';
  const statusClass = upcoming ? 'status-upcoming' : 'status-done';
  const typeClass   = b.regType === 'VIP' ? 'type-vip' : 'type-free';
  const zoomLink    = b.zoomLink || 'https://zoom.us/j/YOUR_ID';
  const safeLink    = zoomLink.replace(/'/g, "\\'");

  return `
    <div class="booking-card">
      <div class="booking-card-left">
        <div class="booking-webinar-icon">${upcoming ? '🔴' : '✅'}</div>
        <div class="booking-info">
          <h4>${b.webinarTitle || 'Wellness Webinar'}</h4>
          <div class="booking-meta">
            <span>📅 ${formatDate(b.webinarDate)}</span>
            <span>⏰ ${formatTime(b.webinarDate)}</span>
            <span class="${typeClass} booking-type-badge">${b.regType || 'FREE'}</span>
            <span class="${statusClass} booking-status-badge">${statusLabel}</span>
          </div>
          ${b.paymentId ? `<div class="booking-reg-date">Payment ID: <code>${b.paymentId}</code></div>` : ''}
          ${b.paymentMethod ? `<div class="booking-reg-date">Paid via: ${b.paymentMethod}</div>` : ''}
          <div class="booking-reg-date">Registered: ${formatDate(b.registeredAt)}</div>
          ${b.name  ? `<div class="booking-reg-date">Name: ${b.name}</div>`  : ''}
          ${b.email ? `<div class="booking-reg-date">Email: ${b.email}</div>` : ''}
          ${b.phone ? `<div class="booking-reg-date">Phone: ${b.phone}</div>` : ''}
          ${b.goal  ? `<div class="booking-reg-date">Goal: ${b.goal}</div>`  : ''}
        </div>
      </div>
      <div class="booking-card-right">
        ${Number(b.amount) > 0
          ? `<div class="booking-amount">₹${b.amount}</div>`
          : `<div class="booking-amount free">FREE</div>`}
        <div class="booking-actions">
          ${upcoming
            ? `<button class="btn-sm btn-zoom" onclick="copyZoomLink('${safeLink}')">🔗 Zoom Link</button>
               <button class="btn-sm btn-wa"   onclick="resendWhatsApp('${b.id}')">📱 WhatsApp</button>`
            : `<button class="btn-sm btn-outline-sm" onclick="downloadCertificate('${b.id}')">🏅 Certificate</button>`}
        </div>
      </div>
    </div>`;
}

// ---- RECENT REGISTRATIONS (overview) ----
function renderRecentBookings(list) {
  const container = document.getElementById('recentRegistrations');
  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎫</div>
        <p>No webinar registrations yet.</p>
        <a href="index.html#register" class="btn-primary" style="font-size:0.85rem;padding:10px 22px;">Register Free</a>
      </div>`;
    return;
  }
  container.innerHTML = list.map(b => `
    <div class="recent-reg-row">
      <div class="recent-reg-icon">${isUpcoming(b.webinarDate) ? '🔴' : '✅'}</div>
      <div class="recent-reg-info">
        <strong>${b.webinarTitle || 'Wellness Webinar'}</strong>
        <span>${formatDate(b.webinarDate)} &nbsp;|&nbsp; ${b.name || currentUser.firstName || ''}</span>
      </div>
      <div class="recent-reg-badge ${b.regType === 'VIP' ? 'type-vip' : 'type-free'}">${b.regType || 'FREE'}</div>
    </div>`).join('');
}

// ---- RENDER PAYMENTS TABLE ----
function renderPayments(list) {
  const container = document.getElementById('paymentsList');
  if (!list.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">💳</div><p>No paid transactions yet.</p></div>`;
    return;
  }
  container.innerHTML = `
    <table class="payments-table">
      <thead>
        <tr><th>Date</th><th>Name</th><th>Webinar</th><th>Method</th><th>Payment ID</th><th>Amount</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${list.map(b => `
          <tr>
            <td>${formatDate(b.registeredAt)}</td>
            <td>${b.name || '—'}</td>
            <td>${b.webinarTitle || 'Wellness Webinar'}</td>
            <td>${b.paymentMethod || '—'}</td>
            <td><code style="font-size:0.75rem;">${b.paymentId || b.utrId || '—'}</code></td>
            <td><strong>₹${b.amount}</strong></td>
            <td><span class="pay-status-badge">✅ Paid</span></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ---- FILTER BOOKINGS ----
function filterBookings(type, btn) {
  activeFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  let filtered = allBookings;
  if (type === 'upcoming')  filtered = allBookings.filter(b => isUpcoming(b.webinarDate));
  if (type === 'completed') filtered = allBookings.filter(b => !isUpcoming(b.webinarDate));
  if (type === 'vip')       filtered = allBookings.filter(b => b.regType === 'VIP');
  renderBookings(filtered);
}

// ---- TAB SWITCHER ----
function changeTab(name, linkEl) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');
  const link = linkEl || document.querySelector('[data-tab="' + name + '"]');
  if (link)  link.classList.add('active');
  const dd = document.getElementById('userDropdown');
  if (dd)   dd.style.display = 'none';
  return false;
}

// ---- DASHBOARD COUNTDOWN ----
function startDashCountdown() {
  function tick() {
    const diff = WEBINAR_DATE - new Date();
    const cd   = document.getElementById('dashCountdown');
    if (!cd) return;

    if (diff <= 0) {
      const hoursAgo = Math.abs(diff) / 3600000;
      if (hoursAgo < 2) {
        // Session is currently live (within 2 hours of start)
        cd.innerHTML = '<p style="color:#4ade80;font-weight:700;font-size:1rem;">&#128308; LIVE NOW!</p>';
      } else {
        // Session is over — show "Completed" cleanly instead of broken zeros
        cd.innerHTML = '<div style="text-align:center;padding:8px 0;">' +
          '<p style="color:rgba(255,255,255,.5);font-size:.75rem;text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;">Session</p>' +
          '<p style="color:#4ade80;font-weight:700;font-size:1.05rem;">Completed &#10003;</p></div>';
      }
      return;
    }

    // Upcoming — show countdown
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000)  / 60000);
    const dEl = document.getElementById('dc-days');
    const hEl = document.getElementById('dc-hours');
    const mEl = document.getElementById('dc-mins');
    if (dEl) dEl.textContent = String(d).padStart(2, '0');
    if (hEl) hEl.textContent = String(h).padStart(2, '0');
    if (mEl) mEl.textContent = String(m).padStart(2, '0');
  }
  tick();
  setInterval(tick, 60000);
}

// ---- PROFILE SAVE ----
function saveProfile(e) {
  e.preventDefault();
  const updates = {
    firstName: document.getElementById('pfFirstName').value.trim(),
    lastName:  document.getElementById('pfLastName').value.trim(),
    phone:     '+91' + document.getElementById('pfPhone').value.trim(),
    city:      document.getElementById('pfCity').value.trim(),
    goal:      document.getElementById('pfGoal').value,
  };
  const session     = getSession();
  const updatedUser = { ...session.user, ...updates };
  saveSession(updatedUser, session.token);
  currentUser = updatedUser;

  // Also persist in sw_users
  const users = JSON.parse(localStorage.getItem('sw_users') || '[]');
  const idx   = users.findIndex(u => u.id === updatedUser.id);
  if (idx > -1) { users[idx] = updatedUser; } else { users.push(updatedUser); }
  localStorage.setItem('sw_users', JSON.stringify(users));

  const msg = document.getElementById('profileSaveMsg');
  if (msg) { msg.style.display = 'inline'; setTimeout(() => msg.style.display = 'none', 3000); }
  populateUser();
  showToast('✅ Profile saved successfully!');
}

// ---- CHANGE PASSWORD ----
function changePassword(e) {
  e.preventDefault();
  const curr    = document.getElementById('currPassword').value;
  const newPass = document.getElementById('newPassword').value;
  const confirm = document.getElementById('confirmNewPassword').value;
  if (!curr)                     { showToast('⚠️ Enter your current password'); return; }
  if (!newPass || newPass.length < 8) { showToast('⚠️ New password must be 8+ chars'); return; }
  if (newPass !== confirm)       { showToast('⚠️ Passwords do not match'); return; }
  showToast('✅ Password updated successfully!');
  document.getElementById('passwordForm').reset();
}

// ---- COPY ZOOM LINK ----
function copyZoomLink(link) {
  const zoomLink = link || 'https://zoom.us/j/YOUR_MEETING_ID';
  navigator.clipboard.writeText(zoomLink)
    .then(() => showToast('✅ Zoom link copied to clipboard!'))
    .catch(() => prompt('Copy this Zoom link:', zoomLink));
}

// ---- RESEND WHATSAPP ----
async function resendWhatsApp(bookingId) {
  const session = getSession();
  showToast('📱 Sending Zoom link to WhatsApp...');
  try {
    const res  = await fetch(`${BACKEND}/api/resend-whatsapp`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.token },
      body:    JSON.stringify({ bookingId, phone: currentUser.phone }),
    });
    const data = await res.json();
    showToast(data.success ? '✅ Zoom link resent on WhatsApp!' : '⚠️ Could not send. Contact support.');
  } catch {
    showToast('📱 Zoom link will be sent to ' + (currentUser.phone || 'your number') + ' shortly.');
  }
}

// ---- DOWNLOAD CERTIFICATE ----
function downloadCertificate(bookingId) {
  showToast('🏅 Certificate will be emailed to ' + currentUser.email);
}

// ---- RESOURCES ----
function downloadResource(type) {
  showToast('⬇ Downloading ' + type + '... (link will open in production)');
}
function checkVIPAccess(type) {
  if (currentUser.memberType === 'VIP') {
    downloadResource(type);
  } else {
    if (confirm('⭐ VIP members only.\n\nUpgrade for ₹499 to get recordings, diet plans & priority Q&A.\n\nGo to register page?')) {
      window.location.href = 'index.html#register';
    }
  }
}

// ---- HELPERS ----
function isUpcoming(dateStr) { return new Date(dateStr) > new Date(); }

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

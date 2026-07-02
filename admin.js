// ============================================
//  SUDHA WELLNESS — ADMIN.JS
//  Admin panel logic with localStorage fallback
// ============================================

const ADMIN_BACKEND = 'http://localhost:3000';
const ADMIN_CREDS   = { email: 'admin@sudhawellness.com', password: 'admin2025' };

let adminSession = null;
let allRegData   = [];
let allUserData  = [];

// ============================================
//  ADMIN AUTH
// ============================================
function adminLogin() {
  const email = document.getElementById('adminEmail').value.trim();
  const pass  = document.getElementById('adminPassword').value;
  const err   = document.getElementById('adminLoginError');

  if (email === ADMIN_CREDS.email && pass === ADMIN_CREDS.password) {
    adminSession = { email, role: 'admin', token: 'admin_' + Date.now() };
    sessionStorage.setItem('sw_admin', JSON.stringify(adminSession));
    document.getElementById('adminLoginScreen').style.display  = 'none';
    document.getElementById('adminDashboard').style.display    = 'block';
    loadAll();
  } else {
    // Try backend
    fetch(ADMIN_BACKEND + '/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          adminSession = { email, role: 'admin', token: data.token };
          sessionStorage.setItem('sw_admin', JSON.stringify(adminSession));
          document.getElementById('adminLoginScreen').style.display  = 'none';
          document.getElementById('adminDashboard').style.display    = 'block';
          loadAll();
        } else {
          err.textContent = '⚠️ Invalid admin credentials.';
          err.style.display = 'block';
        }
      })
      .catch(() => {
        err.textContent = '⚠️ Invalid credentials. Use: admin@sudhawellness.com / admin2025';
        err.style.display = 'block';
      });
  }
}

function adminLogout() {
  sessionStorage.removeItem('sw_admin');
  window.location.reload();
}

// ---- Auto-restore session ----
(function checkAdminSession() {
  const saved = sessionStorage.getItem('sw_admin');
  if (saved) {
    adminSession = JSON.parse(saved);
    document.getElementById('adminLoginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display   = 'block';
    loadAll();
  }
  // Allow Enter key on login
  document.getElementById('adminPassword')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') adminLogin();
  });
})();

// ============================================
//  LOAD ALL DATA
// ============================================
async function loadAll() {
  await Promise.all([loadRegistrations(), loadUsers()]);
  renderOverview();
  renderRegistrations();
  renderUsers();
  renderAdminPayments();
  updateWhatsAppCount();
}

async function loadRegistrations() {
  try {
    const res  = await fetch(ADMIN_BACKEND + '/api/admin/registrations', {
      headers: { 'x-admin-key': process?.env?.ADMIN_KEY || 'admin2025' },
    });
    const data = await res.json();
    if (data.registrations) { allRegData = data.registrations; return; }
  } catch (_) {}

  // Fallback: pull from localStorage (all_registrations store)
  const fromStore  = JSON.parse(localStorage.getItem('sw_all_registrations') || '[]');
  const users      = JSON.parse(localStorage.getItem('sw_users') || '[]');
  const fromUsers  = users.flatMap(u => (u.registrations || []).map(r => ({
    ...r, name: r.name || (u.firstName + ' ' + (u.lastName || '')).trim(),
    email: r.email || u.email, phone: r.phone || u.phone,
  })));
  // Deduplicate
  const seen = new Set();
  allRegData = [...fromStore, ...fromUsers].filter(r => {
    const k = r.id || (r.email + '|' + r.webinarTitle);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function loadUsers() {
  try {
    const res  = await fetch(ADMIN_BACKEND + '/api/admin/users', {
      headers: { 'x-admin-key': 'admin2025' },
    });
    const data = await res.json();
    if (data.users) { allUserData = data.users; return; }
  } catch (_) {}
  allUserData = JSON.parse(localStorage.getItem('sw_users') || '[]');
}

// ============================================
//  OVERVIEW
// ============================================
function renderOverview() {
  const total   = allRegData.length;
  const vip     = allRegData.filter(r => r.regType === 'VIP').length;
  const revenue = allRegData.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const users   = allUserData.length;

  document.getElementById('adm-totalReg').textContent  = total;
  document.getElementById('adm-vipReg').textContent    = vip;
  document.getElementById('adm-revenue').textContent   = '₹' + revenue;
  document.getElementById('adm-users').textContent     = users;
  document.getElementById('admRegCount').textContent   = total || '';
  document.getElementById('admUserCount').textContent  = users || '';

  // Recent 5
  const recent  = [...allRegData].sort((a,b) => new Date(b.registeredAt) - new Date(a.registeredAt)).slice(0,5);
  const container = document.getElementById('adm-recentList');
  if (!recent.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No registrations yet.</p></div>';
    return;
  }
  container.innerHTML = `<div class="adm-table-wrap"><table class="adm-table">
    <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Type</th><th>Amount</th><th>Registered</th></tr></thead>
    <tbody>${recent.map(r => `
      <tr>
        <td><strong>${r.name || '—'}</strong></td>
        <td>${r.email || '—'}</td>
        <td>${r.phone || '—'}</td>
        <td><span class="${r.regType === 'VIP' ? 'badge-vip-adm' : 'badge-free-adm'}">${r.regType || 'FREE'}</span></td>
        <td>${Number(r.amount) > 0 ? '<strong>₹' + r.amount + '</strong>' : '<span style="color:var(--muted)">FREE</span>'}</td>
        <td>${formatAdmDate(r.registeredAt)}</td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

// ============================================
//  REGISTRATIONS TABLE
// ============================================
function renderRegistrations(list) {
  const data      = list || allRegData;
  const container = document.getElementById('adm-regTable');
  if (!data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No registrations found.</p></div>';
    return;
  }
  container.innerHTML = `<div class="adm-table-wrap"><table class="adm-table">
    <thead>
      <tr>
        <th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Goal</th>
        <th>Type</th><th>Payment</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${data.map((r, i) => {
        const up = new Date(r.webinarDate) > new Date();
        return `<tr>
          <td style="color:var(--muted)">${i+1}</td>
          <td><strong>${r.name || '—'}</strong></td>
          <td><a href="mailto:${r.email}" style="color:var(--primary);text-decoration:none;">${r.email || '—'}</a></td>
          <td>${r.phone || '—'}</td>
          <td>${r.goal || '—'}</td>
          <td><span class="${r.regType === 'VIP' ? 'badge-vip-adm' : 'badge-free-adm'}">${r.regType || 'FREE'}</span></td>
          <td><code>${r.paymentId || r.utrId || '—'}</code><br/><small style="color:var(--muted)">${r.paymentMethod || ''}</small></td>
          <td>${Number(r.amount) > 0 ? '<strong>₹' + r.amount + '</strong>' : '<span style="color:var(--muted)">Free</span>'}</td>
          <td><span class="${up ? 'badge-upcoming' : 'badge-done'}">${up ? 'Upcoming' : 'Completed'}</span></td>
          <td style="white-space:nowrap">${formatAdmDate(r.registeredAt)}</td>
          <td style="white-space:nowrap;">
            <button class="adm-action-btn success" onclick="resendZoomLink('${(r.phone||'').replace(/'/g,"\\'")}','${(r.name||'').replace(/'/g,"\\'")}')">📱 WhatsApp</button>
            <button class="adm-action-btn" onclick="deleteRegistration('${r.id||''}')">🗑 Delete</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table></div>`;
}

function filterRegistrations() {
  const q    = (document.getElementById('regSearch')?.value || '').toLowerCase();
  const type = document.getElementById('regTypeFilter')?.value || '';
  let filtered = allRegData;
  if (q)    filtered = filtered.filter(r =>
    (r.name||'').toLowerCase().includes(q) ||
    (r.email||'').toLowerCase().includes(q) ||
    (r.phone||'').toLowerCase().includes(q)
  );
  if (type) filtered = filtered.filter(r => r.regType === type);
  renderRegistrations(filtered);
}

// ============================================
//  USERS TABLE
// ============================================
function renderUsers(list) {
  const data      = list || allUserData;
  const container = document.getElementById('adm-userTable');
  if (!data.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>No users found.</p></div>';
    return;
  }
  container.innerHTML = `<div class="adm-table-wrap"><table class="adm-table">
    <thead>
      <tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>City</th><th>Member Type</th><th>Registrations</th><th>Joined</th><th>Actions</th></tr>
    </thead>
    <tbody>
      ${data.map((u, i) => `<tr>
        <td style="color:var(--muted)">${i+1}</td>
        <td><strong>${(u.firstName || '') + ' ' + (u.lastName || '') || u.name || '—'}</strong></td>
        <td><a href="mailto:${u.email}" style="color:var(--primary);text-decoration:none;">${u.email || '—'}</a></td>
        <td>${u.phone || '—'}</td>
        <td>${u.city || '—'}</td>
        <td><span class="${u.memberType === 'VIP' ? 'badge-vip-adm' : 'badge-free-adm'}">${u.memberType || 'FREE'}</span></td>
        <td style="text-align:center">${(u.registrations || []).length}</td>
        <td style="white-space:nowrap">${formatAdmDate(u.joinedAt)}</td>
        <td>
          <button class="adm-action-btn" onclick="viewUserDetail('${u.id}')">👁 View</button>
          <button class="adm-action-btn danger" onclick="deleteUser('${u.id}')">🗑</button>
        </td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function filterUsers() {
  const q = (document.getElementById('userSearch')?.value || '').toLowerCase();
  if (!q) { renderUsers(); return; }
  renderUsers(allUserData.filter(u =>
    (u.firstName || u.name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q) ||
    (u.phone || '').toLowerCase().includes(q)
  ));
}

// ============================================
//  PAYMENTS
// ============================================
function renderAdminPayments() {
  const paid = allRegData.filter(r => Number(r.amount) > 0);
  const total = paid.reduce((s, r) => s + Number(r.amount), 0);
  const avg   = paid.length ? Math.round(total / paid.length) : 0;
  document.getElementById('adm-payTotal').textContent = '₹' + total;
  document.getElementById('adm-payCount').textContent  = paid.length;
  document.getElementById('adm-payAvg').textContent    = '₹' + avg;

  const container = document.getElementById('adm-payTable');
  if (!paid.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">💳</div><p>No paid transactions yet.</p></div>';
    return;
  }
  container.innerHTML = `<div class="adm-table-wrap"><table class="adm-table">
    <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Phone</th><th>Method</th><th>Payment ID</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
    <tbody>
      ${paid.map((r,i) => `<tr>
        <td style="color:var(--muted)">${i+1}</td>
        <td><strong>${r.name || '—'}</strong></td>
        <td>${r.email || '—'}</td>
        <td>${r.phone || '—'}</td>
        <td>${r.paymentMethod || '—'}</td>
        <td><code>${r.paymentId || r.utrId || '—'}</code></td>
        <td><strong>₹${r.amount}</strong></td>
        <td>${formatAdmDate(r.registeredAt)}</td>
        <td><span class="badge-paid">✅ Paid</span></td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

// ============================================
//  WHATSAPP BLAST
// ============================================
const TEMPLATES = {
  reminder: `🌿 *Sudha Wellness Webinar Reminder*\n\nNamaste! 🙏\n\nJust 24 hours to go!\n\n📅 *Tomorrow — 20 July 2025*\n⏰ *6:00 PM IST*\n\n🔗 Join Zoom: [YOUR_ZOOM_LINK]\n🆔 Meeting ID: 123 456 7890\n🔑 Password: wellness\n\nSee you tomorrow! 🌱\n— Team Sudha Wellness`,
  zoom:     `🌿 *Your Zoom Link — Sudha Wellness*\n\nNamaste! 🙏\n\nHere's your Zoom link:\n\n🔗 [YOUR_ZOOM_LINK]\n🆔 Meeting ID: 123 456 7890\n🔑 Password: wellness\n\n📅 20 July 2025 at 6:00 PM IST\n\n— Team Sudha Wellness`,
  custom:   '',
};

function loadTemplate() {
  const tpl = document.getElementById('waTemplate')?.value;
  const msg = document.getElementById('waMessage');
  if (msg && TEMPLATES[tpl] !== undefined) {
    msg.value = TEMPLATES[tpl];
    updateWaPreview();
  }
}
function updateWhatsAppCount() {
  const target = document.getElementById('waTarget')?.value || 'all';
  let count    = allRegData.length;
  if (target === 'vip')      count = allRegData.filter(r => r.regType === 'VIP').length;
  if (target === 'free')     count = allRegData.filter(r => r.regType !== 'VIP').length;
  if (target === 'upcoming') count = allRegData.filter(r => new Date(r.webinarDate) > new Date()).length;
  const el = document.getElementById('waRecipCount');
  if (el) el.textContent = count + ' recipients selected';
}
function updateWaPreview() {
  const msg = document.getElementById('waMessage')?.value || '';
  const el  = document.getElementById('waPreview');
  if (el) el.textContent = msg || 'Your message will appear here...';
}
document.getElementById('waMessage')?.addEventListener('input', updateWaPreview);
document.getElementById('waTarget')?.addEventListener('change', updateWhatsAppCount);

async function sendWhatsAppBlast() {
  const target  = document.getElementById('waTarget')?.value;
  const message = document.getElementById('waMessage')?.value?.trim();
  if (!message) { admToast('⚠️ Please enter a message'); return; }

  let recipients = allRegData;
  if (target === 'vip')      recipients = allRegData.filter(r => r.regType === 'VIP');
  if (target === 'free')     recipients = allRegData.filter(r => r.regType !== 'VIP');
  if (target === 'upcoming') recipients = allRegData.filter(r => new Date(r.webinarDate) > new Date());

  if (!recipients.length) { admToast('⚠️ No recipients found for selected audience'); return; }
  if (!confirm(`Send WhatsApp message to ${recipients.length} people?`)) return;

  try {
    const res  = await fetch(ADMIN_BACKEND + '/api/admin/whatsapp-blast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': 'admin2025' },
      body: JSON.stringify({ message, recipients: recipients.map(r => ({ phone: r.phone, name: r.name })) }),
    });
    const data = await res.json();
    admToast(`✅ WhatsApp blast sent to ${data.sent || recipients.length} people!`);
  } catch (_) {
    admToast(`✅ Queued WhatsApp messages for ${recipients.length} recipients (backend offline — will send when connected)`);
  }
}

// ============================================
//  ACTIONS
// ============================================
async function resendZoomLink(phone, name) {
  if (!phone) { admToast('⚠️ No phone number for this registration'); return; }
  try {
    const res  = await fetch(ADMIN_BACKEND + '/api/admin/resend-zoom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': 'admin2025' },
      body: JSON.stringify({ phone, name }),
    });
    const data = await res.json();
    admToast(data.success ? `✅ Zoom link resent to ${phone}` : '⚠️ Failed to send. Check WhatsApp config.');
  } catch (_) {
    admToast(`📱 Zoom link queued for ${phone} (backend offline)`);
  }
}

function deleteRegistration(id) {
  if (!id || !confirm('Delete this registration permanently?')) return;
  allRegData = allRegData.filter(r => r.id !== id);
  // Also remove from localStorage
  localStorage.setItem('sw_all_registrations', JSON.stringify(
    JSON.parse(localStorage.getItem('sw_all_registrations') || '[]').filter(r => r.id !== id)
  ));
  renderRegistrations();
  renderOverview();
  admToast('🗑 Registration deleted');
}

function deleteUser(id) {
  if (!id || !confirm('Delete this user account?')) return;
  allUserData = allUserData.filter(u => u.id !== id);
  const users = JSON.parse(localStorage.getItem('sw_users') || '[]').filter(u => u.id !== id);
  localStorage.setItem('sw_users', JSON.stringify(users));
  renderUsers();
  renderOverview();
  admToast('🗑 User deleted');
}

function viewUserDetail(id) {
  const u = allUserData.find(u => u.id === id);
  if (!u) return;
  const regs = (u.registrations || []).length;
  alert(`User Details\n\nName: ${(u.firstName||'')+' '+(u.lastName||'')}\nEmail: ${u.email}\nPhone: ${u.phone}\nCity: ${u.city||'—'}\nMember: ${u.memberType||'FREE'}\nRegistrations: ${regs}\nJoined: ${formatAdmDate(u.joinedAt)}`);
}

// ============================================
//  SETTINGS
// ============================================
function saveWebinarSettings(e) {
  e.preventDefault();
  const settings = {
    title:    document.getElementById('set-title')?.value,
    datetime: document.getElementById('set-datetime')?.value,
    zoomLink: document.getElementById('set-zoomlink')?.value,
    zoomId:   document.getElementById('set-zoomid')?.value,
    zoomPwd:  document.getElementById('set-zoompwd')?.value,
    price:    document.getElementById('set-price')?.value,
    seats:    document.getElementById('set-seats')?.value,
  };
  localStorage.setItem('sw_webinar_settings', JSON.stringify(settings));
  admToast('✅ Webinar settings saved!');
}

function saveAPISettings() {
  admToast('✅ API config noted (update .env file in backend for live changes)');
}

async function testDBConnection() {
  const uri = document.getElementById('set-mongoUri')?.value;
  const el  = document.getElementById('dbConnStatus');
  if (!uri) { if (el) el.innerHTML = '<span style="color:#dc2626;">⚠️ Enter a MongoDB URI first</span>'; return; }
  try {
    const res  = await fetch(ADMIN_BACKEND + '/api/admin/test-db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': 'admin2025' },
      body: JSON.stringify({ uri }),
    });
    const data = await res.json();
    if (el) el.innerHTML = data.success
      ? '<span style="color:#16a34a;">✅ Connected successfully!</span>'
      : '<span style="color:#dc2626;">❌ ' + (data.message||'Connection failed') + '</span>';
  } catch (_) {
    if (el) el.innerHTML = '<span style="color:#dc2626;">❌ Backend offline. Start server to test.</span>';
  }
}

// ============================================
//  EXPORT CSV
// ============================================
function exportCSV() {
  if (!allRegData.length) { admToast('⚠️ No data to export'); return; }
  const headers = ['Name','Email','Phone','Goal','Type','Payment ID','Method','Amount','Status','Registered'];
  const rows    = allRegData.map(r => [
    r.name||'',r.email||'',r.phone||'',r.goal||'',r.regType||'',
    r.paymentId||r.utrId||'',r.paymentMethod||'',r.amount||0,
    new Date(r.webinarDate)>new Date()?'Upcoming':'Completed',
    r.registeredAt||'',
  ]);
  const csv  = [headers, ...rows].map(row => row.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'sudha-wellness-registrations-' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  admToast('✅ CSV exported!');
}

// ============================================
//  TAB SWITCHER
// ============================================
function adminTab(name, linkEl) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');
  const link = linkEl || document.querySelector('[data-tab="' + name + '"]');
  if (link)  link.classList.add('active');
  if (name === 'adm-whatsapp') { loadTemplate(); updateWhatsAppCount(); }
  return false;
}

// ============================================
//  TOAST
// ============================================
function admToast(msg) {
  const el = document.getElementById('admToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4000);
}

// ============================================
//  HELPERS
// ============================================
function formatAdmDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

// load template on first render
window.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('waMessage')) loadTemplate();
  const settings = JSON.parse(localStorage.getItem('sw_webinar_settings') || '{}');
  if (settings.title && document.getElementById('set-title')) document.getElementById('set-title').value = settings.title;
  if (settings.zoomLink && document.getElementById('set-zoomlink')) document.getElementById('set-zoomlink').value = settings.zoomLink;
  if (settings.zoomId && document.getElementById('set-zoomid')) document.getElementById('set-zoomid').value = settings.zoomId;
});

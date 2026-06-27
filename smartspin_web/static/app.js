const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
let currentUser = null;

const d = new Date();
document.getElementById('topbar-date').textContent = d.toLocaleDateString('en-PH', {
  weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
});

document.getElementById('login-pass')?.addEventListener('keydown', event => {
  if (event.key === 'Enter') doLogin();
});

document.getElementById('register-pass')?.addEventListener('keydown', event => {
  if (event.key === 'Enter') registerAccount();
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

async function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value.trim();
  if (!u || !p) { showToast('Please enter credentials.'); return; }
  try {
    currentUser = await api('/api/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('app-page').classList.add('active');
    document.querySelector('.avatar').textContent = u[0].toUpperCase();
    applyRoleView();
    await refreshDashboard();
    if (currentUser.role === 'admin') loadNotifications();
  } catch (error) {
    showToast(error.message);
  }
}

function doLogout() {
  currentUser = null;
  document.getElementById('app-page').classList.remove('active');
  document.getElementById('login-page').classList.add('active');
}

async function registerAccount() {
  const username = document.getElementById('register-user').value.trim();
  const password = document.getElementById('register-pass').value.trim();
  const email = document.getElementById('register-email')?.value.trim() || '';
  if (!username || !password) { showToast('Enter a new username and password.'); return; }
  try {
    await api('/api/register', { method: 'POST', body: JSON.stringify({ username, password, email }) });
    document.getElementById('login-user').value = username;
    document.getElementById('login-pass').value = password;
    document.getElementById('register-user').value = '';
    document.getElementById('register-pass').value = '';
    if (document.getElementById('register-email')) document.getElementById('register-email').value = '';
    showToast('Customer account registered. Notification saved.');
  } catch (error) {
    showToast(error.message);
  }
}

function applyRoleView() {
  const isAdmin = currentUser?.role === 'admin';
  document.body.classList.toggle('role-admin', isAdmin);
  document.body.classList.toggle('role-customer', !isAdmin);
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
  document.querySelectorAll('.customer-only').forEach(el => el.style.display = isAdmin ? 'none' : '');
  document.getElementById('topbar-title').textContent = isAdmin ? 'Dashboard' : 'My Laundry';
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-dashboard').classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('.nav-item')?.classList.add('active');
  const firstStat = document.querySelector('.stat-card.blue .stat-label');
  const secondStat = document.querySelector('.stat-card.teal .stat-label');
  const thirdStat = document.querySelector('.stat-card.amber .stat-label');
  if (firstStat) firstStat.textContent = isAdmin ? 'Total Customers' : 'Your Account';
  if (secondStat) secondStat.textContent = isAdmin ? 'Total Orders' : 'Your Orders';
  if (thirdStat) thirdStat.textContent = isAdmin ? 'Total Revenue' : 'Total Spent';
}

function showSection(name, el) {
  if (currentUser?.role !== 'admin' && ['customers', 'reports', 'analytics'].includes(name)) {
    showToast('Customers can only view their own laundry records.');
    return;
  }
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  const titles = {dashboard:'Dashboard',customers:'Customer Records',transactions:'Laundry Transactions',reports:'Reports',analytics:'Analytics'};
  document.getElementById('topbar-title').textContent = currentUser?.role === 'customer' && name === 'transactions' ? 'My Orders' : (titles[name] || name);
  if (name === 'dashboard' || name === 'analytics' || name === 'transactions') refreshDashboard();
  if (name === 'reports' && currentUser?.role === 'admin') loadNotifications();
}

async function refreshDashboard() {
  try {
    const username = currentUser?.username ? '?username=' + encodeURIComponent(currentUser.username) : '';
    const summary = await api('/api/summary' + username);
    updateStats(summary);
    renderOrders(summary.orders || []);
    buildChart(summary.weeklyRevenue || []);
  } catch (error) {
    showToast(error.message);
  }
}

function updateStats(summary) {
  const values = document.querySelectorAll('.stat-value');
  if (values[0]) values[0].textContent = currentUser?.role === 'admin' ? summary.totalCustomers : 'Active';
  if (values[1]) values[1].textContent = summary.totalOrders;
  if (values[2]) values[2].textContent = peso.format(summary.totalRevenue || 0).replace('PHP', '₱');
}

function renderOrders(orders) {
  const customerList = document.getElementById('customer-orders-list');
  if (customerList) {
    customerList.innerHTML = orders.length ? orders.map(order => '<div class="customer-order"><strong>' + order.service + '</strong><span>' + order.status + ' · ' + order.weight + ' kg · ₱' + Number(order.amount).toFixed(2) + '</span></div>').join('') : '<div class="empty-state">No orders yet.</div>';
  }
}

async function loadNotifications() {
  const panel = document.getElementById('notification-list');
  if (!panel) return;
  try {
    const data = await api('/api/notifications');
    const items = data.notifications || [];
    panel.innerHTML = items.length ? items.map(item => '<div class="activity-item"><div class="activity-dot" style="background:' + (item.sent ? 'var(--green)' : 'var(--amber)') + '"></div><div><div class="activity-text"><strong>' + item.subject + '</strong> to ' + item.to + '</div><div class="activity-time">' + item.status + ' · ' + item.createdAt + '</div></div></div>').join('') : '<div class="empty-state">No notifications yet.</div>';
  } catch (error) {
    panel.innerHTML = '<div class="empty-state">Could not load notifications.</div>';
  }
}

function buildChart(data = []) {
  const fallback = [
    {label:'Mon', val:0}, {label:'Tue', val:0}, {label:'Wed', val:0},
    {label:'Thu', val:0}, {label:'Fri', val:50}, {label:'Sat', val:0}, {label:'Sun', val:0}
  ];
  const chartData = data.length ? data : fallback;
  const max = Math.max(...chartData.map(d => d.val), 1);
  const area = document.getElementById('chart-bars');
  if (!area) return;
  area.innerHTML = chartData.map(d => {
    const h = Math.max((d.val / max) * 130, d.val > 0 ? 6 : 0);
    return '<div class="chart-bar-col"><div class="chart-bar-val">' + (d.val > 0 ? '₱' + d.val : '') + '</div><div class="chart-bar" style="height:' + h + 'px"></div><div class="chart-bar-lbl">' + d.label + '</div></div>';
  }).join('');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

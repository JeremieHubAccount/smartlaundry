const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

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
    await api('/api/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) });
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('app-page').classList.add('active');
    document.querySelector('.avatar').textContent = u[0].toUpperCase();
    await refreshDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

function doLogout() {
  document.getElementById('app-page').classList.remove('active');
  document.getElementById('login-page').classList.add('active');
}

async function registerAccount() {
  const username = document.getElementById('register-user').value.trim();
  const password = document.getElementById('register-pass').value.trim();
  if (!username || !password) { showToast('Enter a new username and password.'); return; }

  try {
    await api('/api/register', { method: 'POST', body: JSON.stringify({ username, password }) });
    document.getElementById('login-user').value = username;
    document.getElementById('login-pass').value = password;
    document.getElementById('register-user').value = '';
    document.getElementById('register-pass').value = '';
    showToast('Account registered. You can sign in now.');
  } catch (error) {
    showToast(error.message);
  }
}

function showSection(name, el) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-' + name).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  const titles = {dashboard:'Dashboard',customers:'Customer Records',transactions:'Laundry Transactions',reports:'Reports',analytics:'Analytics'};
  document.getElementById('topbar-title').textContent = titles[name] || name;
  if (name === 'dashboard' || name === 'analytics') refreshDashboard();
}

async function refreshDashboard() {
  try {
    const summary = await api('/api/summary');
    updateStats(summary);
    buildChart(summary.weeklyRevenue || []);
  } catch (error) {
    showToast(error.message);
  }
}

function updateStats(summary) {
  const values = document.querySelectorAll('.stat-value');
  if (values[0]) values[0].textContent = summary.totalCustomers;
  if (values[1]) values[1].textContent = summary.totalOrders;
  if (values[2]) values[2].textContent = peso.format(summary.totalRevenue || 0).replace('PHP', '₱');
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
    return `<div class="chart-bar-col">
      <div class="chart-bar-val">${d.val > 0 ? '₱' + d.val : ''}</div>
      <div class="chart-bar" style="height:${h}px"></div>
      <div class="chart-bar-lbl">${d.label}</div>
    </div>`;
  }).join('');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

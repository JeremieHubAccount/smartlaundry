const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
let currentUser = null;
let currentOrders = [];

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
    if (currentUser.role === 'admin') { loadNotifications(); loadCustomers(); }
  } catch (error) {
    showToast(error.message);
  }
}

function doLogout() {
  currentUser = null;
  currentOrders = [];
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
    showToast('Customer account registered. Notification saved/sent.');
  } catch (error) {
    showToast(error.message);
  }
}

async function addCustomer() {
  if (currentUser?.role !== 'admin') { showToast('Only admin can add customers.'); return; }
  const name = document.getElementById('customer-name')?.value.trim();
  const email = document.getElementById('customer-email')?.value.trim() || '';
  const phone = document.getElementById('customer-phone')?.value.trim() || '';
  const address = document.getElementById('customer-address')?.value.trim() || '';
  if (!name) { showToast('Enter customer name.'); return; }
  try {
    await api('/api/customers', { method: 'POST', body: JSON.stringify({ name, email, phone, address }) });
    ['customer-name','customer-email','customer-phone','customer-address'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    showToast('Customer added. Login password is customer.');
    await loadCustomers();
    await refreshDashboard();
    loadNotifications();
  } catch (error) {
    showToast(error.message);
  }
}

async function loadCustomers() {
  const table = document.getElementById('customers-table-body');
  if (!table || currentUser?.role !== 'admin') return;
  try {
    const data = await api('/api/customers');
    const customers = data.customers || [];
    table.innerHTML = customers.length ? customers.map((customer, index) => '<tr><td style="color:var(--gray-400);font-weight:600">#' + String(index + 1).padStart(3, '0') + '</td><td><strong>' + escapeHtml(customer.name || '') + '</strong></td><td>' + escapeHtml(customer.email || '-') + '</td><td>' + escapeHtml(customer.phone || '-') + '</td><td>' + escapeHtml(customer.address || '-') + '</td><td><span class="badge badge-active">' + escapeHtml(customer.username || '-') + '</span></td></tr>').join('') : '<tr><td colspan="6" class="empty-state">No customers yet.</td></tr>';
  } catch (error) {
    table.innerHTML = '<tr><td colspan="6" class="empty-state">Could not load customers.</td></tr>';
  }
}

async function createOrder() {
  const service = document.getElementById('order-service')?.value || 'Wash & Fold';
  const weight = Number(document.getElementById('order-weight')?.value || 0);
  const customerInput = document.getElementById('order-customer');
  const customer = currentUser?.role === 'admin' ? customerInput?.value.trim() : currentUser?.name;
  if (currentUser?.role === 'admin' && !customer) { showToast('Enter customer name.'); return; }
  if (!weight || weight <= 0) { showToast('Enter weight in kg.'); return; }
  try {
    await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ customer, service, weight, username: currentUser?.username, role: currentUser?.role })
    });
    if (customerInput && currentUser?.role === 'admin') customerInput.value = '';
    document.getElementById('order-weight').value = '';
    showToast('Order created. Notification saved/sent.');
    await refreshDashboard();
    if (currentUser?.role === 'admin') loadNotifications();
  } catch (error) {
    showToast(error.message);
  }
}

async function updateOrderStatus(id, status) {
  if (currentUser?.role !== 'admin') return;
  try {
    await api('/api/orders/status', { method: 'POST', body: JSON.stringify({ id, status }) });
    showToast('Order status updated.');
    await refreshDashboard();
    loadNotifications();
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
  const customerInput = document.getElementById('order-customer');
  if (customerInput) {
    customerInput.style.display = isAdmin ? '' : 'none';
    customerInput.value = isAdmin ? customerInput.value : currentUser?.name || '';
  }
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
  document.getElementById('topbar-title').textContent = currentUser?.role === 'customer' && name === 'transactions' ? 'Create Order' : (titles[name] || name);
  if (name === 'dashboard' || name === 'analytics' || name === 'transactions') refreshDashboard();
  if (name === 'customers' && currentUser?.role === 'admin') loadCustomers();
  if (name === 'reports' && currentUser?.role === 'admin') loadNotifications();
}

async function refreshDashboard() {
  try {
    const username = currentUser?.username ? '?username=' + encodeURIComponent(currentUser.username) : '';
    const summary = await api('/api/summary' + username);
    currentOrders = summary.orders || [];
    updateStats(summary);
    renderOrders(currentOrders);
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

function statusBadge(status) {
  const cls = status === 'Delivered' || status === 'Ready' ? 'badge-active' : 'badge-pending';
  return '<span class="badge ' + cls + '">' + escapeHtml(status || 'Pending') + '</span>';
}

function renderOrders(orders) {
  const customerList = document.getElementById('customer-orders-list');
  if (customerList) {
    customerList.innerHTML = orders.length ? orders.map(order => '<div class="customer-order"><strong>' + escapeHtml(order.service) + '</strong><span>' + escapeHtml(order.status) + ' · ' + order.weight + ' kg · ₱' + Number(order.amount).toFixed(2) + '</span><button class="btn-tbl btn-receipt" onclick="showReceipt(' + order.id + ')">Receipt</button></div>').join('') : '<div class="empty-state">No orders yet.</div>';
  }
  const tableBody = document.getElementById('orders-table-body');
  if (tableBody) {
    tableBody.innerHTML = orders.length ? orders.map((order, index) => {
      const adminActions = currentUser?.role === 'admin' ? '<select class="tbl-select status-select" onchange="updateOrderStatus(' + order.id + ', this.value)"><option ' + selected(order.status, 'Pending') + '>Pending</option><option ' + selected(order.status, 'Washing') + '>Washing</option><option ' + selected(order.status, 'Drying') + '>Drying</option><option ' + selected(order.status, 'Ready') + '>Ready</option><option ' + selected(order.status, 'Delivered') + '>Delivered</option></select>' : '';
      return '<tr><td style="color:var(--gray-400);font-weight:600">#' + String(index + 1).padStart(3, '0') + '</td><td><strong>' + escapeHtml(order.customer) + '</strong></td><td>' + escapeHtml(order.service) + '</td><td>' + order.weight + ' kg</td><td><strong>₱' + Number(order.amount).toFixed(2) + '</strong></td><td><span class="badge badge-active">● Active</span></td><td>' + statusBadge(order.status) + '</td><td><div class="tbl-actions">' + adminActions + '<button class="btn-tbl btn-receipt" onclick="showReceipt(' + order.id + ')">Receipt</button></div></td></tr>';
    }).join('') : '<tr><td colspan="8" class="empty-state">No orders yet.</td></tr>';
  }
}

function selected(current, value) {
  return (current || 'Pending') === value ? 'selected' : '';
}

function showReceipt(id) {
  const order = currentOrders.find(item => Number(item.id) === Number(id));
  if (!order) { showToast('Receipt not found.'); return; }
  const receiptBody = document.getElementById('receipt-body');
  receiptBody.innerHTML = '<div class="receipt-line"><span>Receipt No.</span><strong>#' + String(order.id).padStart(3, '0') + '</strong></div>' +
    '<div class="receipt-line"><span>Customer</span><strong>' + escapeHtml(order.customer) + '</strong></div>' +
    '<div class="receipt-line"><span>Service</span><strong>' + escapeHtml(order.service) + '</strong></div>' +
    '<div class="receipt-line"><span>Weight</span><strong>' + order.weight + ' kg</strong></div>' +
    '<div class="receipt-line"><span>Status</span><strong>' + escapeHtml(order.status) + '</strong></div>' +
    '<div class="receipt-total"><span>Total</span><strong>₱' + Number(order.amount).toFixed(2) + '</strong></div>';
  document.getElementById('receipt-modal').classList.add('show');
}

function closeReceipt() {
  document.getElementById('receipt-modal').classList.remove('show');
}

async function loadNotifications() {
  const panel = document.getElementById('notification-list');
  if (!panel) return;
  try {
    const data = await api('/api/notifications');
    const items = data.notifications || [];
    panel.innerHTML = items.length ? items.map(item => '<div class="activity-item"><div class="activity-dot" style="background:' + (item.sent ? 'var(--green)' : 'var(--amber)') + '"></div><div><div class="activity-text"><strong>' + escapeHtml(item.subject) + '</strong> to ' + escapeHtml(item.to) + '</div><div class="activity-time">' + escapeHtml(item.status || 'saved') + ' · ' + escapeHtml(item.createdAt) + '</div></div></div>').join('') : '<div class="empty-state">No notifications yet.</div>';
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

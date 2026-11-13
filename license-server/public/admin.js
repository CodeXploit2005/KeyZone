import { DAY, formatDate, parseDate, relativeExpiry } from './admin-time.js';
const $ = id => document.getElementById(id);
let keys = [], editing, filter = 'all', expiryMode = 'relative';
function auth(value) {
  document.body.dataset.auth = String(value);
  $('workspace').hidden = !value; $('login').hidden = value; $('logout').hidden = !value;
}
function connection(text) { $('connection').lastChild.textContent = ' ' + text; }
async function api(path, method = 'GET', data) {
  let res;
  try { res = await fetch('/api/admin/' + path, { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(20000) }); }
  catch { connection('Mất kết nối'); throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.'); }
  const result = await res.json();
  if (res.status === 401) { auth(false); connection('Chưa đăng nhập'); }
  if (!res.ok) throw new Error(result.error || 'Không thể kết nối.');
  connection('Đã kết nối'); return result;
}
function message(value) { $('message').textContent = value; $('message').hidden = !value; }
function state(key) { return key.revoked ? 'revoked' : key.expires_at <= Date.now() ? 'expired' : 'active'; }
function view(name) {
  document.body.dataset.view = name;
  document.querySelectorAll('[data-view-button]').forEach(button => { button.classList.toggle('selected', button.dataset.viewButton === name); });
  if (name === 'create') {
    $('create').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('customer').focus({ preventScroll: true });
  }
}
document.querySelectorAll('[data-view-button]').forEach(button => { button.onclick = () => view(button.dataset.viewButton); });
async function load() {
  const result = await api('keys'); keys = result.keys; auth(true);
  $('total').textContent = keys.length; $('navCount').textContent = keys.length;
  $('active').textContent = keys.filter(k => state(k) === 'active').length;
  $('expired').textContent = keys.filter(k => state(k) === 'expired').length;
  $('devices').textContent = keys.reduce((n, k) => n + k.device_count, 0);
  render();
}
function render() {
  const rows = $('rows'); rows.replaceChildren();
  const query = $('search').value.trim().toLocaleLowerCase('vi');
  const filtered = keys.filter(k => (k.customer + ' ' + k.prefix).toLocaleLowerCase('vi').includes(query) && (filter === 'all' || state(k) === filter));
  $('listCount').textContent = keys.length; $('resultCount').textContent = `Hiển thị ${filtered.length} / ${keys.length} key`;
  for (const key of filtered) {
    const row = document.createElement('tr');
    const cell = (label, className) => { const td = document.createElement('td'); if (label) td.dataset.label = label; if (className) td.className = className; row.append(td); return td; };
    const who = cell(); const name = document.createElement('strong'); name.textContent = key.customer;
    const code = document.createElement('code'); code.textContent = key.prefix + '…'; who.append(name, code);
    const badge = document.createElement('span'), status = state(key);
    badge.className = 'badge ' + status; badge.textContent = { revoked: 'Đã thu hồi', expired: 'Hết hạn', active: 'Hoạt động' }[status]; cell().append(badge);
    const [date, time] = formatDate(key.expires_at).split(' '), dateCell = cell('Hết hạn', 'date-cell');
    dateCell.append(document.createTextNode(date)); const clock = document.createElement('small'); clock.textContent = time; dateCell.append(clock);
    cell('Thiết bị', 'device-count').textContent = `${key.device_count} / ${key.max_devices}`;
    const actions = cell(null, 'actions'), inner = document.createElement('div'); inner.className = 'actions-inner'; actions.append(inner);
    for (const [label, action] of [['Gia hạn', 'edit'], ['Thu hồi', 'revoke'], ['Gỡ máy', 'reset']]) {
      const button = document.createElement('button'); button.textContent = label;
      button.setAttribute('aria-label', `${label} key của ${key.customer}`);
      if (action === 'revoke') { button.className = 'danger'; button.disabled = Boolean(key.revoked); }
      button.onclick = async () => {
        if (action === 'edit') {
          editing = key.id; $('editCustomer').value = key.customer; $('editExpiry').value = formatDate(key.expires_at); $('editDevices').value = key.max_devices;
          $('editError').textContent = ''; $('editKey').showModal(); return;
        }
        if (!confirm(action === 'revoke' ? `Thu hồi key của ${key.customer}? Ứng dụng sẽ khóa khi kiểm tra quyền tiếp theo.` : `Gỡ tất cả thiết bị của ${key.customer}? Các máy phải nhập key lại.`)) return;
        button.disabled = true;
        try { await api('keys/' + key.id, 'PATCH', { action }); await load(); message('Đã cập nhật quyền sử dụng.'); } catch (e) { message(e.message); } finally { button.disabled = false; }
      };
      inner.append(button);
    }
    rows.append(row);
  }
  $('empty').hidden = filtered.length > 0;
  $('emptyTitle').textContent = keys.length ? 'Không tìm thấy key phù hợp' : 'Chưa có key nào';
  $('emptyText').textContent = keys.length ? 'Thử từ khóa khác hoặc thay đổi bộ lọc trạng thái.' : 'Tạo key đầu tiên để bắt đầu quản lý quyền sử dụng.';
  $('empty').querySelector('button').hidden = keys.length > 0;
}
document.querySelectorAll('[data-filter]').forEach(button => { button.onclick = () => {
  filter = button.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(b => { const selected = b === button; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); }); render();
}; });
function expires() { return expiryMode === 'absolute' ? parseDate($('expiry').value) : relativeExpiry($('durationAmount').value, $('durationUnit').value); }
function syncExpiry(relative = false) {
  if (relative) { expiryMode = 'relative'; $('durationAmount').required = true; }
  $('durationAmount').max = $('durationUnit').value === 'days' ? 3660 : 87840;
  const date = expires();
  if (relative && date) $('expiry').value = formatDate(date);
  $('expirySummary').textContent = date ? formatDate(date) : expiryMode === 'absolute' ? 'Nhập đúng DD/MM/YYYY HH:mm' : 'Nhập thời hạn hợp lệ, tối đa 10 năm';
  $('expirySummary').parentElement.classList.toggle('invalid', !date || date <= new Date());
  document.querySelectorAll('[data-days]').forEach(b => {
    const selected = expiryMode === 'relative' && $('durationUnit').value === 'days' && b.dataset.days === $('durationAmount').value;
    b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected));
  });
}
document.querySelectorAll('[data-days]').forEach(b => { b.onclick = () => { $('durationAmount').value = b.dataset.days; $('durationUnit').value = 'days'; syncExpiry(true); }; });
$('durationAmount').oninput = () => syncExpiry(true); $('durationUnit').onchange = () => syncExpiry(true);
$('expiry').oninput = () => { expiryMode = 'absolute'; $('durationAmount').required = false; syncExpiry(); };
document.querySelectorAll('[data-extend]').forEach(b => { b.onclick = () => {
  const current = parseDate($('editExpiry').value);
  $('editExpiry').value = formatDate(Math.max(current?.getTime() || 0, Date.now()) + Number(b.dataset.extend) * DAY);
}; });
async function submit(form, work) {
  const button = form.querySelector('[type=submit]'); button.disabled = true;
  try { await work(); } catch (e) { message(e.message); } finally { button.disabled = false; }
}
$('login').onsubmit = e => { e.preventDefault(); submit(e.currentTarget, async () => { await api('login', 'POST', { password: $('password').value }); $('password').value = ''; await load(); message(''); }); };
$('create').onsubmit = e => { e.preventDefault(); submit(e.currentTarget, async () => {
  const expiry = expires();
  if (!expiry || expiry <= new Date()) { $('dateOptions').open = expiryMode === 'absolute'; throw new Error('Nhập thời hạn trong tương lai. Ngày giờ theo định dạng DD/MM/YYYY HH:mm.'); }
  const result = await api('keys', 'POST', { customer: $('customer').value, customKey: $('customKey').value.trim(), expiresAt: expiry.toISOString(), maxDevices: Number($('maxDevices').value) });
  $('keyValue').textContent = result.key; $('copy').textContent = 'Sao chép key'; $('newKey').showModal();
  $('customKey').value = ''; message(''); await load();
}); };
$('edit').onsubmit = async e => { e.preventDefault(); await submit(e.currentTarget, async () => {
  try {
    const expiry = parseDate($('editExpiry').value);
    if (!expiry || expiry <= new Date()) throw new Error('Nhập ngày giờ trong tương lai: DD/MM/YYYY HH:mm.');
    await api('keys/' + editing, 'PATCH', { action: 'update', customer: $('editCustomer').value, expiresAt: expiry.toISOString(), maxDevices: Number($('editDevices').value) });
    $('editKey').close(); await load(); message('Đã lưu thay đổi cho key.');
  } catch (err) { $('editError').textContent = err.message; }
}); };
$('cancelEdit').onclick = () => $('editKey').close();
$('copy').onclick = async () => { try { await navigator.clipboard.writeText($('keyValue').textContent); $('copy').textContent = '✓ Đã sao chép'; } catch { $('copy').textContent = 'Hãy chọn và sao chép key'; } };
$('closeKey').onclick = () => $('newKey').close();
$('newKey').addEventListener('close', () => { $('keyValue').textContent = ''; view('list'); });
$('logout').onclick = async () => { try { await api('logout', 'POST', {}); auth(false); connection('Chưa đăng nhập'); keys = []; $('rows').replaceChildren(); message(''); } catch (e) { message(e.message); } };
$('refresh').onclick = async () => { $('refresh').disabled = true; try { await load(); message('Đã cập nhật danh sách key.'); } catch (e) { message(e.message); } finally { $('refresh').disabled = false; } };
$('search').oninput = render; syncExpiry(true);
load().catch(e => { if (!e.message.includes('đăng nhập')) message(e.message); });
setInterval(() => { if (!$('workspace').hidden && !document.querySelector('dialog[open]') && !document.hidden) load().catch(e => message(e.message)); }, 30000);

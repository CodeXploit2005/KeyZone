const $ = id => document.getElementById(id);
let keys = [], editing;
const localDate = date => { const d = new Date(date); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
async function api(path, method = 'GET', data) {
  const res = await fetch('/api/admin/' + path, { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  const result = await res.json();
  if (res.status === 401) { $('workspace').hidden = true; $('login').hidden = false; $('logout').hidden = true; }
  if (!res.ok) throw new Error(result.error || 'Không thể kết nối.');
  return result;
}
const message = value => { $('message').textContent = value; };
async function load() {
  const result = await api('keys'); keys = result.keys;
  $('workspace').hidden = false; $('login').hidden = true; $('logout').hidden = false;
  $('total').textContent = keys.length;
  $('active').textContent = keys.filter(k => !k.revoked && k.expires_at > Date.now()).length;
  $('devices').textContent = keys.reduce((n, k) => n + k.device_count, 0);
  render();
}
function render() {
  const rows = $('rows'); rows.replaceChildren();
  const query = $('search').value.toLowerCase();
  for (const key of keys.filter(k => (k.customer + ' ' + k.prefix).toLowerCase().includes(query))) {
    const row = document.createElement('tr');
    const cell = () => { const td = document.createElement('td'); row.append(td); return td; };
    const who = cell(); const name = document.createElement('strong'); name.textContent = key.customer;
    const code = document.createElement('code'); code.textContent = key.prefix + '…'; who.append(name, code);
    const expired = key.expires_at <= Date.now(); const badge = document.createElement('span');
    badge.className = 'badge' + (key.revoked || expired ? ' dead' : ''); badge.textContent = key.revoked ? 'Đã thu hồi' : expired ? 'Hết hạn' : 'Hoạt động'; cell().append(badge);
    cell().textContent = new Date(key.expires_at).toLocaleString('vi-VN');
    cell().textContent = `${key.device_count} / ${key.max_devices}`;
    const actions = cell(); actions.className = 'actions';
    for (const [label, action] of [['Gia hạn / sửa', 'edit'], ['Thu hồi', 'revoke'], ['Gỡ thiết bị', 'reset']]) {
      const button = document.createElement('button'); button.textContent = label;
      button.onclick = async () => {
        if (action === 'edit') {
          editing = key.id; $('editCustomer').value = key.customer; $('editExpiry').value = localDate(key.expires_at); $('editDevices').value = key.max_devices;
          $('editError').textContent = ''; $('editKey').showModal(); return;
        }
        if (!confirm(action === 'revoke' ? `Thu hồi key của ${key.customer}? Ứng dụng sẽ khóa khi kiểm tra quyền tiếp theo.` : `Gỡ tất cả thiết bị của ${key.customer}? Các máy phải nhập key lại.`)) return;
        button.disabled = true;
        try { await api('keys/' + key.id, 'PATCH', { action }); await load(); message('Đã cập nhật quyền sử dụng.'); } catch (e) { message(e.message); } finally { button.disabled = false; }
      };
      actions.append(button);
    }
    rows.append(row);
  }
  $('empty').hidden = rows.children.length > 0;
}
async function submit(form, work) {
  const button = form.querySelector('button'); button.disabled = true;
  try { await work(); } catch (e) { message(e.message); } finally { button.disabled = false; }
}
$('login').onsubmit = e => { e.preventDefault(); submit(e.currentTarget, async () => { await api('login', 'POST', { password: $('password').value }); $('password').value = ''; await load(); message(''); }); };
$('create').onsubmit = e => { e.preventDefault(); submit(e.currentTarget, async () => {
  const result = await api('keys', 'POST', { customer: $('customer').value, expiresAt: new Date($('expiry').value).toISOString(), maxDevices: Number($('maxDevices').value) });
  $('keyValue').textContent = result.key; $('copy').textContent = 'Sao chép key'; $('newKey').showModal(); await load();
}); };
$('edit').onsubmit = async e => { e.preventDefault(); await submit(e.currentTarget, async () => {
  try { await api('keys/' + editing, 'PATCH', { action: 'update', customer: $('editCustomer').value, expiresAt: new Date($('editExpiry').value).toISOString(), maxDevices: Number($('editDevices').value) }); $('editKey').close(); await load(); message('Đã lưu key.'); }
  catch (err) { $('editError').textContent = err.message; }
}); };
$('cancelEdit').onclick = () => $('editKey').close();
$('copy').onclick = async () => { try { await navigator.clipboard.writeText($('keyValue').textContent); $('copy').textContent = 'Đã sao chép'; } catch { $('copy').textContent = 'Hãy chọn và sao chép key'; } };
$('closeKey').onclick = () => $('newKey').close();
$('newKey').addEventListener('close', () => { $('keyValue').textContent = ''; });
$('logout').onclick = async () => { try { await api('logout', 'POST', {}); $('workspace').hidden = true; $('login').hidden = false; $('logout').hidden = true; keys = []; $('rows').replaceChildren(); } catch(e) { message(e.message); } };
$('refresh').onclick = () => load().catch(e => message(e.message));
$('search').oninput = render;
$('duration').onchange = () => { if ($('duration').value !== 'custom') $('expiry').value = localDate(Date.now() + Number($('duration').value) * 86400000); };
$('expiry').oninput = () => { $('duration').value = 'custom'; };
$('duration').onchange();
load().catch(e => { if (!e.message.includes('đăng nhập')) message(e.message); });
setInterval(() => { if (!$('workspace').hidden && !document.querySelector('dialog[open]')) load().catch(e => message(e.message)); }, 30000);

/* PickInDes Admin — frontend logic
   Served as /admin.js via express.static('public').
   No inline handlers in HTML — all listeners attached here. */

'use strict';

// ── State ───────────────────────────────────────────────────────────────────
let allProducts = [];
let allUsers = [];
let currentEditingProductId = null;
let currentEditingUserId = null;
let importPreviewToken = null;

// ── Auth helpers ─────────────────────────────────────────────────────────────
function getToken() {
  return sessionStorage.getItem('adminToken') || '';
}

function setToken(t) {
  sessionStorage.setItem('adminToken', t);
}

function clearToken() {
  sessionStorage.removeItem('adminToken');
}

function showLogin(errorMsg) {
  clearToken();
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('admin-shell').style.display = 'none';
  if (errorMsg) {
    const el = document.getElementById('login-error');
    el.textContent = errorMsg;
    el.style.display = 'block';
  }
}

function showShell() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-shell').style.display = 'block';
}

// ── API fetch wrapper ─────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    showLogin('Sesija pasibaigė. Prisijunkite iš naujo.');
    throw new Error('Unauthorized');
  }

  return res;
}

async function apiFetchFormData(url, formData) {
  const token = getToken();
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData
  });

  if (res.status === 401) {
    showLogin('Sesija pasibaigė. Prisijunkite iš naujo.');
    throw new Error('Unauthorized');
  }

  return res;
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function performLogin() {
  const btn = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value;

  errorEl.style.display = 'none';
  errorEl.textContent = '';

  if (!username || !password) {
    errorEl.textContent = 'Įveskite vartotojo vardą ir slaptažodį.';
    errorEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Jungiamasi...';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || 'Prisijungti nepavyko.';
      errorEl.style.display = 'block';
      return;
    }

    setToken(data.token);
    showShell();
    loadOverview();
    loadProducts();
    loadUsers();
  } catch {
    errorEl.textContent = 'Serverio klaida. Bandykite dar kartą.';
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Prisijungti';
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────
async function performLogout() {
  try {
    await apiFetch('/api/admin/logout', { method: 'POST' });
  } catch { /* ignore */ }
  showLogin();
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.admin-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === 'tab-' + tabId);
  });
}

// ── Overview ──────────────────────────────────────────────────────────────────
async function loadOverview() {
  try {
    const res = await apiFetch('/api/admin/stats');
    const d = await res.json();
    const cards = document.querySelectorAll('#stats-grid .stat-card .stat-card-n');
    const values = [
      d.total_products ?? 0,
      d.active_products ?? 0,
      d.total_users ?? 0,
      d.active_users ?? 0,
      d.total_downloads ?? 0,
      d.total_likes ?? 0,
      d.total_link_clicks ?? 0
    ];
    cards.forEach((el, i) => { el.textContent = values[i]; });
  } catch { /* showLogin already called on 401 */ }
}

// ── Products ──────────────────────────────────────────────────────────────────
async function loadProducts() {
  try {
    const res = await apiFetch('/api/admin/products');
    allProducts = await res.json();
    renderProducts();
  } catch { }
}

function renderProducts() {
  const query = document.getElementById('products-search').value.toLowerCase();
  const showInactive = document.getElementById('show-inactive-products').checked;
  const tbody = document.getElementById('products-tbody');

  const filtered = allProducts.filter(p => {
    if (!showInactive && !p.is_active) return false;
    if (query) {
      const haystack = ((p.name || '') + ' ' + (p.sku || '') + ' ' + (p.brand || '')).toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    const tr = tbody.insertRow();
    tr.className = 'empty-row';
    const td = tr.insertCell();
    td.colSpan = 8;
    td.textContent = query ? 'Nieko nerasta.' : 'Produktų nėra.';
    return;
  }

  filtered.forEach(p => {
    const tr = tbody.insertRow();
    tr.dataset.id = p.id;
    tr.dataset.active = p.is_active ? '1' : '0';

    const cells = [
      p.sku || '—',
      p.name || '—',
      p.brand || '—',
      p.category || '—',
      p.price != null ? (p.price_from ? 'nuo ' : '') + '€ ' + Number(p.price).toLocaleString('lt-LT') : '—',
      p.download_count ?? 0
    ];
    cells.forEach(val => {
      const td = tr.insertCell();
      td.textContent = val;
    });

    // Active badge cell
    const activeTd = tr.insertCell();
    const badge = document.createElement('span');
    badge.className = 'badge ' + (p.is_active ? 'badge-green' : 'badge-red');
    badge.textContent = p.is_active ? 'Aktyvus' : 'Neaktyvus';
    activeTd.appendChild(badge);

    // Actions cell
    const actionsTd = tr.insertCell();
    actionsTd.style.whiteSpace = 'nowrap';

    const viewBtn = document.createElement('a');
    viewBtn.className = 'btn-sm';
    viewBtn.textContent = '↗ Peržiūrėti';
    viewBtn.href = '/#product=' + p.id;
    viewBtn.target = '_blank';
    viewBtn.rel = 'noopener noreferrer';
    viewBtn.style.textDecoration = 'none';
    actionsTd.appendChild(viewBtn);

    actionsTd.appendChild(document.createTextNode(' '));

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-sm';
    editBtn.textContent = 'Redaguoti';
    editBtn.addEventListener('click', () => openProductModal(p.id));
    actionsTd.appendChild(editBtn);

    actionsTd.appendChild(document.createTextNode(' '));

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn-sm';
    toggleBtn.textContent = p.is_active ? 'Išjungti' : 'Įjungti';
    toggleBtn.addEventListener('click', () => toggleProductStatus(p.id, !p.is_active, toggleBtn));
    actionsTd.appendChild(toggleBtn);

    actionsTd.appendChild(document.createTextNode(' '));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-sm btn-danger';
    delBtn.textContent = 'Ištrinti';
    delBtn.addEventListener('click', () => deleteProduct(p.id, p.name, delBtn));
    actionsTd.appendChild(delBtn);
  });
}

async function toggleProductStatus(id, newActive, btn) {
  btn.disabled = true;
  try {
    const res = await apiFetch(`/api/admin/products/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: newActive })
    });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Klaida'); return; }
    const p = allProducts.find(x => x.id === id);
    if (p) p.is_active = newActive;
    renderProducts();
  } catch { } finally { btn.disabled = false; }
}

async function deleteProduct(id, name, btn) {
  if (!confirm(`Ištrinti produktą "${name}"?\n\nVisi failai bus ištrinti iš disko. Šio veiksmo atšaukti negalima.`)) return;
  btn.disabled = true;
  try {
    const res = await apiFetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Klaida'); return; }
    allProducts = allProducts.filter(x => x.id !== id);
    renderProducts();
    // Refresh stats
    loadOverview();
  } catch { } finally { btn.disabled = false; }
}

function openProductModal(productId) {
  const product = allProducts.find(x => x.id === productId);
  if (!product) return;

  currentEditingProductId = product.id;
  document.getElementById('product-edit-id').value = String(product.id);
  document.getElementById('product-edit-name').value = product.name || '';
  document.getElementById('product-edit-brand').value = product.brand || '';
  const categorySelect = document.getElementById('product-edit-category');
  const categoryValue = product.category || '';
  if (categoryValue && !Array.from(categorySelect.options).some(opt => opt.value === categoryValue)) {
    const customOption = document.createElement('option');
    customOption.value = categoryValue;
    customOption.textContent = categoryValue;
    categorySelect.appendChild(customOption);
  }
  categorySelect.value = categoryValue;
  document.getElementById('product-edit-price').value = product.price == null ? '' : String(product.price);
  document.getElementById('product-edit-price-from').checked = !!product.price_from;
  document.getElementById('product-edit-sku').value = product.sku || '';
  document.getElementById('product-edit-stock').value = product.stock == null ? '' : String(product.stock);
  document.getElementById('product-edit-description').value = product.description || '';
  document.getElementById('product-edit-dimensions').value = product.dimensions || '';
  document.getElementById('product-edit-material').value = product.material || '';
  document.getElementById('product-edit-delivery').value = product.delivery || '';
  document.getElementById('product-edit-link').value = product.link || '';
  document.getElementById('product-edit-active').checked = !!product.is_active;
  document.getElementById('product-edit-meta').textContent = `Sukurta: ${product.created_at ? new Date(product.created_at).toLocaleString('lt-LT') : '—'}`;

  // File inputs cannot be prefilled by browser; clear on open.
  document.getElementById('product-edit-photos').value = '';
  document.getElementById('product-edit-replace-photos').checked = false;
  document.getElementById('product-edit-model-skp').value = '';
  document.getElementById('product-edit-model-obj').value = '';
  document.getElementById('product-edit-model-mtl').value = '';
  document.getElementById('product-edit-model-3ds').value = '';
  document.getElementById('product-edit-model-step').value = '';
  document.getElementById('product-edit-model-dwg').value = '';
  document.getElementById('product-edit-model-textures').value = '';
  document.getElementById('product-edit-model-archive').value = '';

  const err = document.getElementById('product-edit-error');
  err.textContent = '';
  err.style.display = 'none';

  const overlay = document.getElementById('product-modal');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeProductModal() {
  currentEditingProductId = null;
  const overlay = document.getElementById('product-modal');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
}

async function saveProductFromModal(event) {
  event.preventDefault();
  if (!currentEditingProductId) return;

  const saveBtn = document.getElementById('product-edit-save');
  const errorEl = document.getElementById('product-edit-error');
  errorEl.textContent = '';
  errorEl.style.display = 'none';

  const payload = {
    name: document.getElementById('product-edit-name').value.trim(),
    brand: document.getElementById('product-edit-brand').value.trim(),
    category: document.getElementById('product-edit-category').value.trim(),
    price: document.getElementById('product-edit-price').value,
    price_from: document.getElementById('product-edit-price-from').checked,
    description: document.getElementById('product-edit-description').value.trim(),
    dimensions: document.getElementById('product-edit-dimensions').value.trim(),
    material: document.getElementById('product-edit-material').value.trim(),
    delivery: document.getElementById('product-edit-delivery').value.trim(),
    link: document.getElementById('product-edit-link').value.trim(),
    sku: document.getElementById('product-edit-sku').value.trim(),
    stock: document.getElementById('product-edit-stock').value,
    is_active: document.getElementById('product-edit-active').checked
  };

  if (!payload.name || !payload.category || !payload.sku) {
    errorEl.textContent = 'Užpildykite privalomus laukus: pavadinimas, kategorija, SKU.';
    errorEl.style.display = 'block';
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saugoma...';

  try {
    const res = await apiFetch(`/api/admin/products/${currentEditingProductId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Nepavyko išsaugoti produkto.';
      errorEl.style.display = 'block';
      return;
    }

    const photosInput = document.getElementById('product-edit-photos');
    const modelSkpInput = document.getElementById('product-edit-model-skp');
    const modelObjInput = document.getElementById('product-edit-model-obj');
    const modelMtlInput = document.getElementById('product-edit-model-mtl');
    const model3dsInput = document.getElementById('product-edit-model-3ds');
    const modelStepInput = document.getElementById('product-edit-model-step');
    const modelDwgInput = document.getElementById('product-edit-model-dwg');
    const modelTexturesInput = document.getElementById('product-edit-model-textures');
    const modelArchiveInput = document.getElementById('product-edit-model-archive');

    const hasMediaFiles =
      photosInput.files.length > 0 ||
      modelSkpInput.files.length > 0 ||
      modelObjInput.files.length > 0 ||
      modelMtlInput.files.length > 0 ||
      model3dsInput.files.length > 0 ||
      modelStepInput.files.length > 0 ||
      modelDwgInput.files.length > 0 ||
      modelTexturesInput.files.length > 0 ||
      modelArchiveInput.files.length > 0;

    if (hasMediaFiles) {
      const formData = new FormData();
      formData.append('sku', payload.sku);
      formData.append('replace_photos', document.getElementById('product-edit-replace-photos').checked ? '1' : '0');

      Array.from(photosInput.files).forEach(file => formData.append('photos', file));
      if (modelSkpInput.files[0]) formData.append('model_skp', modelSkpInput.files[0]);
      if (modelObjInput.files[0]) formData.append('model_obj', modelObjInput.files[0]);
      if (modelMtlInput.files[0]) formData.append('model_mtl', modelMtlInput.files[0]);
      if (model3dsInput.files[0]) formData.append('model_3ds', model3dsInput.files[0]);
      if (modelStepInput.files[0]) formData.append('model_step', modelStepInput.files[0]);
      if (modelDwgInput.files[0]) formData.append('model_dwg', modelDwgInput.files[0]);
      Array.from(modelTexturesInput.files).forEach(file => formData.append('model_texture', file));
      if (modelArchiveInput.files[0]) formData.append('model_archive', modelArchiveInput.files[0]);

      const mediaRes = await apiFetchFormData(`/api/admin/products/${currentEditingProductId}/media`, formData);
      const mediaData = await mediaRes.json();
      if (!mediaRes.ok) {
        errorEl.textContent = mediaData.error || 'Nepavyko išsaugoti media failų.';
        errorEl.style.display = 'block';
        return;
      }
    }

    await loadProducts();
    loadOverview();
    closeProductModal();
  } catch {
    errorEl.textContent = 'Serverio klaida. Bandykite dar kartą.';
    errorEl.style.display = 'block';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Išsaugoti';
  }
}

// ── Import ────────────────────────────────────────────────────────────────────
function resetImportUI() {
  importPreviewToken = null;
  document.getElementById('import-summary').style.display = 'none';
  document.getElementById('import-preview-wrap').style.display = 'none';
  document.getElementById('import-action-bar').classList.remove('visible');
  document.getElementById('import-result').style.display = 'none';
  const err = document.getElementById('import-csv-error');
  err.textContent = '';
  err.style.display = 'none';
}

async function handleCsvPreview() {
  const fileInput = document.getElementById('import-csv-file');
  const btn = document.getElementById('import-preview-btn');
  const errEl = document.getElementById('import-csv-error');

  errEl.textContent = '';
  errEl.style.display = 'none';
  importPreviewToken = null;
  document.getElementById('import-action-bar').classList.remove('visible');
  document.getElementById('import-result').style.display = 'none';

  if (!fileInput.files.length) {
    errEl.textContent = 'Pasirinkite CSV failą.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Tikrinama...';

  try {
    const formData = new FormData();
    formData.append('csv', fileInput.files[0]);

    const token = getToken();
    const res = await fetch('/api/admin/import/preview', {
      method: 'POST',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      body: formData
    });

    if (res.status === 401) { showLogin('Sesija pasibaigė. Prisijunkite iš naujo.'); return; }

    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.error || 'Peržiūros klaida.';
      errEl.style.display = 'block';
      return;
    }

    importPreviewToken = data.token;
    renderImportSummary(data);
    renderImportPreviewTable(data.preview);
  } catch {
    errEl.textContent = 'Serverio klaida. Bandykite dar kartą.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Peržiūrėti';
  }
}

function renderImportSummary(data) {
  const el = document.getElementById('import-summary');
  el.style.display = 'block';
  el.innerHTML =
    `Iš viso: <b>${data.total}</b> eilutės &nbsp;•&nbsp; ` +
    `Galiojančios: <b>${data.valid}</b> &nbsp;•&nbsp; ` +
    `Su klaidomis (praleidžiamos): <b>${data.invalid}</b><br>` +
    `Naujų produktų: <b>${data.toCreate}</b> &nbsp;•&nbsp; ` +
    `Atnaujinimų (SKU jau yra): <b>${data.toUpdate}</b>`;

  const bar = document.getElementById('import-action-bar');
  if (data.valid > 0) {
    document.getElementById('import-action-label').textContent =
      `${data.valid} eilutė(-ės) paruoštos importuoti. Patvirtinkite veiksmą.`;
    bar.classList.add('visible');
  } else {
    bar.classList.remove('visible');
  }
}

function renderImportPreviewTable(rows) {
  const wrap = document.getElementById('import-preview-wrap');
  const tbody = document.getElementById('import-preview-tbody');
  wrap.style.display = 'block';
  tbody.innerHTML = '';

  rows.forEach(r => {
    const tr = tbody.insertRow();
    const actionClass = r._action === 'create' ? 'action-create'
      : r._action === 'update' ? 'action-update' : 'action-skip';
    const actionLabel = r._action === 'create' ? 'Kurti'
      : r._action === 'update' ? 'Atnaujinti' : 'Praleisti';
    const issues = [
      ...r._errors.map(e => `❌ ${esc(e)}`),
      ...r._warnings.map(w => `⚠️ ${esc(w)}`)
    ].join('<br>');
    tr.innerHTML =
      `<td>${r._rowNum}</td>` +
      `<td>${esc(r.sku)}</td>` +
      `<td>${esc(r.name)}</td>` +
      `<td>${esc(r.category)}</td>` +
      `<td>${r.price != null ? '€ ' + Number(r.price).toLocaleString('lt-LT') : '—'}</td>` +
      `<td>${r.stock ?? 0}</td>` +
      `<td><span class="action-badge ${actionClass}">${actionLabel}</span></td>` +
      `<td style="font-size:11px;line-height:1.5">${issues || '—'}</td>`;
  });
}

function esc(v) {
  if (v == null) return '—';
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function handleImportApply() {
  if (!importPreviewToken) return;
  const btn = document.getElementById('import-apply-btn');
  const resultEl = document.getElementById('import-result');
  resultEl.style.display = 'none';

  btn.disabled = true;
  btn.textContent = 'Importuojama...';

  try {
    const res = await apiFetch('/api/admin/import/apply', {
      method: 'POST',
      body: JSON.stringify({ token: importPreviewToken })
    });
    const data = await res.json();

    if (!res.ok) {
      resultEl.className = 'import-result err';
      resultEl.textContent = data.error || 'Importas nepavyko.';
      resultEl.style.display = 'block';
      return;
    }

    importPreviewToken = null;
    document.getElementById('import-action-bar').classList.remove('visible');
    resultEl.className = 'import-result ok';
    resultEl.innerHTML =
      `✓ Importas baigtas! &nbsp;•&nbsp; ` +
      `Sukurta: <b>${data.created}</b> &nbsp;•&nbsp; ` +
      `Atnaujinta: <b>${data.updated}</b> &nbsp;•&nbsp; ` +
      `Nepavyko: <b>${data.failed}</b>`;
    resultEl.style.display = 'block';
    loadProducts();
    loadOverview();
  } catch {
    resultEl.className = 'import-result err';
    resultEl.textContent = 'Serverio klaida. Bandykite dar kartą.';
    resultEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Patvirtinti ir importuoti';
  }
}

function buildCsvTemplateHref() {
  const header = 'sku,name,brand,category,price,price_from,description,dimensions,material,delivery,link,stock,is_active';
  const example = 'EXAMPLE-001,Pavyzdinis produktas,Gamintojas,Kėdės,299.00,Aprašymas,80x60x90 cm,Medis,4-6 sav.,https://example.com,5,1';
  const csv = header + '\n' + example;
  return 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
}

// ── Users ─────────────────────────────────────────────────────────────────────
async function loadUsers() {
  try {
    const res = await apiFetch('/api/admin/users');
    allUsers = await res.json();
    renderUsers();
  } catch { }
}

function renderUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '';

  if (allUsers.length === 0) {
    const tr = tbody.insertRow();
    tr.className = 'empty-row';
    const td = tr.insertCell();
    td.colSpan = 7;
    td.textContent = 'Vartotojų nėra.';
    return;
  }

  allUsers.forEach(u => {
    const tr = tbody.insertRow();

    const roleLabel = u.role === 'tiekejas' ? 'Tiekėjas' : u.role === 'dizaineris' ? 'Dizaineris' : u.role || '—';
    const roleClass = u.role === 'tiekejas' ? 'badge-blue' : 'badge-orange';
    const created = u.created_at ? new Date(u.created_at).toLocaleDateString('lt-LT') : '—';

    const textCells = [
      u.name || '—',
      u.email || '—',
      u.phone || '—'
    ];
    textCells.forEach(val => {
      const td = tr.insertCell();
      td.textContent = val;
    });

    // Role badge
    const roleTd = tr.insertCell();
    const roleBadge = document.createElement('span');
    roleBadge.className = 'badge ' + roleClass;
    roleBadge.textContent = roleLabel;
    roleTd.appendChild(roleBadge);

    // Created
    const createdTd = tr.insertCell();
    createdTd.textContent = created;

    // Active badge
    const activeTd = tr.insertCell();
    const badge = document.createElement('span');
    badge.className = 'badge ' + (u.is_active ? 'badge-green' : 'badge-red');
    badge.textContent = u.is_active ? 'Aktyvus' : 'Neaktyvus';
    activeTd.appendChild(badge);

    // Actions
    const actionsTd = tr.insertCell();

    const openBtn = document.createElement('button');
    openBtn.className = 'btn-sm';
    openBtn.textContent = 'Atidaryti';
    openBtn.addEventListener('click', () => openUserModal(u.id));
    actionsTd.appendChild(openBtn);

    actionsTd.appendChild(document.createTextNode(' '));

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn-sm';
    toggleBtn.textContent = u.is_active ? 'Išjungti' : 'Įjungti';
    toggleBtn.addEventListener('click', () => toggleUserStatus(u.id, !u.is_active, toggleBtn));
    actionsTd.appendChild(toggleBtn);
  });
}

function openUserModal(userId) {
  const user = allUsers.find(x => x.id === userId);
  if (!user) return;

  currentEditingUserId = user.id;
  document.getElementById('user-edit-id').value = String(user.id);
  document.getElementById('user-edit-name').value = user.name || '';
  document.getElementById('user-edit-email').value = user.email || '';
  document.getElementById('user-edit-phone').value = user.phone || '';
  document.getElementById('user-edit-role').value = user.role || 'dizaineris';
  document.getElementById('user-edit-active').checked = !!user.is_active;
  document.getElementById('user-edit-meta').textContent = `Sukurta: ${user.created_at ? new Date(user.created_at).toLocaleString('lt-LT') : '—'}`;

  const err = document.getElementById('user-edit-error');
  err.textContent = '';
  err.style.display = 'none';

  const overlay = document.getElementById('user-modal');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeUserModal() {
  currentEditingUserId = null;
  const overlay = document.getElementById('user-modal');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
}

async function saveUserFromModal(event) {
  event.preventDefault();
  if (!currentEditingUserId) return;

  const saveBtn = document.getElementById('user-edit-save');
  const errorEl = document.getElementById('user-edit-error');
  errorEl.textContent = '';
  errorEl.style.display = 'none';

  const payload = {
    name: document.getElementById('user-edit-name').value.trim(),
    email: document.getElementById('user-edit-email').value.trim(),
    phone: document.getElementById('user-edit-phone').value.trim(),
    role: document.getElementById('user-edit-role').value,
    is_active: document.getElementById('user-edit-active').checked
  };

  if (!payload.name || !payload.email || !payload.role) {
    errorEl.textContent = 'Užpildykite privalomus laukus: vardas, el. paštas, rolė.';
    errorEl.style.display = 'block';
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saugoma...';

  try {
    const res = await apiFetch(`/api/admin/users/${currentEditingUserId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.error || 'Nepavyko išsaugoti vartotojo.';
      errorEl.style.display = 'block';
      return;
    }

    const idx = allUsers.findIndex(x => x.id === currentEditingUserId);
    if (idx >= 0) {
      allUsers[idx] = {
        ...allUsers[idx],
        name: payload.name,
        email: payload.email,
        phone: payload.phone || null,
        role: payload.role,
        is_active: payload.is_active
      };
    }

    renderUsers();
    loadOverview();
    closeUserModal();
  } catch {
    errorEl.textContent = 'Serverio klaida. Bandykite dar kartą.';
    errorEl.style.display = 'block';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Išsaugoti';
  }
}

async function toggleUserStatus(id, newActive, btn) {
  btn.disabled = true;
  try {
    const res = await apiFetch(`/api/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: newActive })
    });
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Klaida'); return; }
    const u = allUsers.find(x => x.id === id);
    if (u) u.is_active = newActive;
    renderUsers();
    loadOverview();
  } catch { } finally { btn.disabled = false; }
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Tab switching
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', performLogout);

  // Login form
  document.getElementById('login-btn').addEventListener('click', performLogin);
  document.getElementById('admin-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') performLogin();
  });
  document.getElementById('admin-username').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('admin-password').focus();
  });

  // Products filters
  document.getElementById('products-search').addEventListener('input', renderProducts);
  document.getElementById('show-inactive-products').addEventListener('change', renderProducts);

  // Product modal
  document.getElementById('product-edit-form').addEventListener('submit', saveProductFromModal);
  document.getElementById('product-modal-close').addEventListener('click', closeProductModal);
  document.getElementById('product-edit-cancel').addEventListener('click', closeProductModal);
  document.getElementById('product-modal').addEventListener('click', e => {
    if (e.target.id === 'product-modal') closeProductModal();
  });

  // User modal
  document.getElementById('user-edit-form').addEventListener('submit', saveUserFromModal);
  document.getElementById('user-modal-close').addEventListener('click', closeUserModal);
  document.getElementById('user-edit-cancel').addEventListener('click', closeUserModal);
  document.getElementById('user-modal').addEventListener('click', e => {
    if (e.target.id === 'user-modal') closeUserModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const productOverlay = document.getElementById('product-modal');
      if (productOverlay.classList.contains('open')) closeProductModal();
      const overlay = document.getElementById('user-modal');
      if (overlay.classList.contains('open')) closeUserModal();
    }
  });

  // Import tab
  document.getElementById('import-preview-btn').addEventListener('click', handleCsvPreview);
  document.getElementById('import-apply-btn').addEventListener('click', handleImportApply);
  document.getElementById('import-csv-file').addEventListener('change', resetImportUI);
  // Set template download href once DOM is ready
  document.getElementById('import-csv-template').href = buildCsvTemplateHref();


  // Check existing session
  const token = getToken();
  if (token) {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (res.ok) {
        showShell();
        const d = await res.json();
        const cards = document.querySelectorAll('#stats-grid .stat-card .stat-card-n');
        const values = [
          d.total_products ?? 0, d.active_products ?? 0,
          d.total_users ?? 0, d.active_users ?? 0,
          d.total_downloads ?? 0, d.total_likes ?? 0, d.total_link_clicks ?? 0
        ];
        cards.forEach((el, i) => { el.textContent = values[i]; });
        loadProducts();
        loadUsers();
      } else {
        showLogin();
      }
    } catch {
      showLogin();
    }
  }
});

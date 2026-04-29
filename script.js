
const prodDB=[
  {n:"Loom Lounge Chair",b:"Muuto",k:"Kedes"},
  {n:"Arco Floor Lamp",b:"Flos",k:"Apšvietimas"},
  {n:"Pavilion Corner Sofa",b:"Carl Hansen",k:"Sofos"},
  {n:"About A Chair AAC22",b:"HAY",k:"Kedes"},
  {n:"Audo Pendant Light",b:"Menu",k:"Apšvietimas"},
  {n:"Kelim Arch Rug",b:"Ferm Living",k:"Tekstile"},
  {n:"Tambour Dining Table",b:"Ligne Roset",k:"Stalai"},
  {n:"PH 5 Pendant",b:"Louis Poulsen",k:"Apšvietimas"},
  {n:"String System Shelf",b:"String",k:"Stalai"},
  {n:"Riff Wool Throw",b:"Skagerak",k:"Tekstile"},
];

let currentSessionUser=null;

function updateTopNavLinks(){
  const kat=document.getElementById('nl-kat');
  const dash=document.getElementById('nl-dash');
  const sar=document.getElementById('nl-sar');
  if(kat) kat.style.display='';
  if(dash) dash.style.display=isLoggedIn ? '' : 'none';
  if(sar) sar.style.display='none';
}

function go(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  document.querySelectorAll('.n-links a').forEach(a=>a.classList.remove('active'));
  const map={katalogas:'nl-kat',dashboard:'nl-dash',sarasas:'nl-sar',projektas:'nl-dash',"kliento-sarasas":'nl-sar'};
  if(map[id]) document.getElementById(map[id]).classList.add('active');
  
  // Reset and re-render catalog when navigating to it
  if(id === 'katalogas') {
    catalogRendered = false;
    setTimeout(renderCatalog, 50);
  }
  // Re-init photo grid when navigating to add-product
  if(id === 'add-product') {
    if(!_skipFormReset) {
      editingProductId = null;
      setTimeout(() => {
        const title = document.querySelector('#add-product .dash-title');
        if(title) title.textContent = t('add_title');
        const submitBtn = document.querySelector('#product-form button[type=submit]');
        if(submitBtn) submitBtn.textContent = t('add_submit');
        document.getElementById('product-form')?.reset();
        renderPhotoGrid();
        updatePhotoCount();
      }, 50);
    }
    _skipFormReset = false;
  }
  if(id === 'tiekejo-paskyra') {
    setTimeout(renderSupplierDashboard, 50);
  }
  if(id === 'dashboard') {
    setTimeout(()=>{ updateDashboardProjects(); renderDownloadedModelsCard(); updateDownloadedModelsCount(); }, 50);
  }
}

function loginAs(role){
  isLoggedIn=true;
  if(role==='tiekejas' || role==='tiekėjas'){
    currentSessionUser={ id:'supplier-muuto', name:'Muuto', role:'tiekejas' };
  } else if(role==='dizaineris2'){
    currentSessionUser={ id:'designer-mb', name:'Ilona', role:'dizaineris' };
  } else {
    currentSessionUser={ id:'designer-ak', name:'Aušra K.', role:'dizaineris' };
  }

  projects=getStoredProjects();
  if(normalizeLoadedProjectIcons(projects)) saveProjects();
  loadLikedForCurrentUser();
  refreshAllHeartButtons();
  updateHeartNav();
  updateMegstamiDot();
  updateMegstami();
  document.getElementById('fi-megstami').style.display='flex';
  const nr=document.getElementById('nav-right');
  const langSwitchHtml = `<div class="lang-switch"><button class="lang-btn ${lang==='lt'?'active':''}" onclick="setLang('lt')">LT</button><span style="color:var(--light);font-size:11px">|</span><button class="lang-btn ${lang==='en'?'active':''}" onclick="setLang('en')">EN</button></div>`;
  if(currentSessionUser.role==='dizaineris'){
    const avatar=currentSessionUser.id==='designer-mb'?'MB':'AK';
    nr.innerHTML=`${langSwitchHtml}<div class="account-menu"><button class="account-trigger" onclick="toggleAccountMenu(event)"><div class="n-avatar">${avatar}</div><span style="font-size:13px;color:var(--mid)">${currentSessionUser.name}</span><span class="account-caret">?</span></button><div class="account-dropdown" id="account-dropdown"><button class="account-item" onclick="go('dashboard');closeAccountMenu()" data-i18n="acc_open_dashboard">Atidaryti paskyra</button><button class="account-item" onclick="logout()" data-i18n="acc_logout">Atsijungti</button></div></div><span id="nav-heart" onclick="heartNavClick()" style="width:18px;height:18px;border-radius:50%;background:#fff;border:1.5px solid #1d1d1f;display:inline-block;cursor:pointer;transition:all .15s;margin-left:2px;vertical-align:middle" title="Mano megstami"></span>`;
    go('dashboard');
  } else {
    nr.innerHTML=`${langSwitchHtml}<div class="account-menu"><button class="account-trigger" onclick="toggleAccountMenu(event)"><div class="n-avatar">MT</div><span style="font-size:13px;color:var(--mid)">Muuto</span><span class="account-caret">?</span></button><div class="account-dropdown" id="account-dropdown"><button class="account-item" onclick="go('tiekejo-paskyra');closeAccountMenu()" data-i18n="acc_open_supplier">Atidaryti paskyra</button><button class="account-item" onclick="logout()" data-i18n="acc_logout">Atsijungti</button></div></div>`;
    go('tiekejo-paskyra');
  }
  updateTopNavLinks();
  applyLang();
}

function toggleAccountMenu(event){
  if(event) event.stopPropagation();
  const dd=document.getElementById('account-dropdown');
  if(!dd) return;
  const menu=dd.closest('.account-menu');
  if(menu) menu.classList.toggle('open');
  dd.classList.toggle('open');
}

function closeAccountMenu(){
  const dd=document.getElementById('account-dropdown');
  if(dd) dd.classList.remove('open');
  const menu=dd?.closest('.account-menu');
  if(menu) menu.classList.remove('open');
}

document.addEventListener('click', function(e){
  if(!e.target.closest('.account-menu')) closeAccountMenu();
});

function logout(){
  closeAccountMenu();
  isLoggedIn=false;
  currentSessionUser = null;
  projects=[];
  liked.clear();
  refreshAllHeartButtons();
  updateHeartNav();
  updateMegstamiDot();
  updateMegstami();
  const favFilter=document.getElementById('fi-megstami');
  if(favFilter) favFilter.style.display='none';
  const nr=document.getElementById('nav-right');
  nr.innerHTML=`
    <div class="lang-switch">
      <button class="lang-btn ${lang==='lt'?'active':''}" onclick="setLang('lt')">LT</button>
      <span style="color:var(--light);font-size:11px">|</span>
      <button class="lang-btn ${lang==='en'?'active':''}" onclick="setLang('en')">EN</button>
    </div>
    <span class="n-login" onclick="go('login')" data-i18n="nav_login">Prisijungti</span>
    <span id="nav-heart" onclick="heartNavClick()" style="width:18px;height:18px;border-radius:50%;background:#fff;border:1.5px solid #1d1d1f;display:none;cursor:pointer;transition:all .15s;flex-shrink:0;vertical-align:middle" title="Mano megstami"></span>
    <button class="n-btn" onclick="go('register')" data-i18n="nav_register">Registruotis</button>
  `;
  updateTopNavLinks();
  go('katalogas');
  applyLang();
}

async function performLogin() {
  const email = document.getElementById('login-email')?.value || '';
  const password = document.getElementById('login-password')?.value || '';
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!email || !password) {
    if (errorEl) {
      errorEl.textContent = 'El. paštas ir slaptažodis reikalingi';
      errorEl.style.display = 'block';
    }
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Prisijungiama...';
  if (errorEl) errorEl.style.display = 'none';

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      if (errorEl) {
        errorEl.textContent = data.error || 'Prisijungimas nepavyko';
        errorEl.style.display = 'block';
      }
      btn.disabled = false;
      btn.textContent = 'Prisijungti';
      return;
    }

    // Set session user
    isLoggedIn = true;
    currentSessionUser = { id: data.id, email: data.email, name: data.name, role: data.role };

    // Load user data
    projects = getStoredProjects();
    if (normalizeLoadedProjectIcons(projects)) saveProjects();
    loadLikedForCurrentUser();
    refreshAllHeartButtons();
    updateHeartNav();
    updateMegstamiDot();
    updateMegstami();
    document.getElementById('fi-megstami').style.display = 'flex';

    // Update nav
    const nr = document.getElementById('nav-right');
    const langSwitchHtml = `<div class="lang-switch"><button class="lang-btn ${lang === 'lt' ? 'active' : ''}" onclick="setLang('lt')">LT</button><span style="color:var(--light);font-size:11px">|</span><button class="lang-btn ${lang === 'en' ? 'active' : ''}" onclick="setLang('en')">EN</button></div>`;

    if (data.role === 'dizaineris') {
      const avatar = (data.name || 'U').substring(0, 1).toUpperCase();
      nr.innerHTML = `${langSwitchHtml}<div class="account-menu"><button class="account-trigger" onclick="toggleAccountMenu(event)"><div class="n-avatar">${avatar}</div><span style="font-size:13px;color:var(--mid)">${data.name}</span><span class="account-caret">?</span></button><div class="account-dropdown" id="account-dropdown"><button class="account-item" onclick="go('dashboard');closeAccountMenu()" data-i18n="acc_open_dashboard">Atidaryti paskyra</button><button class="account-item" onclick="logout()" data-i18n="acc_logout">Atsijungti</button></div></div><span id="nav-heart" onclick="heartNavClick()" style="width:18px;height:18px;border-radius:50%;background:#fff;border:1.5px solid #1d1d1f;display:inline-block;cursor:pointer;transition:all .15s;margin-left:2px;vertical-align:middle" title="Mano megstami"></span>`;
      go('dashboard');
    } else {
      nr.innerHTML = `${langSwitchHtml}<div class="account-menu"><button class="account-trigger" onclick="toggleAccountMenu(event)"><div class="n-avatar">${(data.name || 'S').substring(0, 2).toUpperCase()}</div><span style="font-size:13px;color:var(--mid)">${data.name}</span><span class="account-caret">?</span></button><div class="account-dropdown" id="account-dropdown"><button class="account-item" onclick="go('tiekejo-paskyra');closeAccountMenu()" data-i18n="acc_open_supplier">Atidaryti paskyra</button><button class="account-item" onclick="logout()" data-i18n="acc_logout">Atsijungti</button></div></div>`;
      go('tiekejo-paskyra');
    }

    updateTopNavLinks();
    applyLang();

    // Clear form
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';

  } catch (err) {
    if (errorEl) {
      errorEl.textContent = 'Tinklo klaida. Bandykite vėliau.';
      errorEl.style.display = 'block';
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Prisijungti';
  }
}

async function performRegister() {
  const name = document.getElementById('register-name')?.value || '';
  const email = document.getElementById('register-email')?.value || '';
  const phone = document.getElementById('register-phone')?.value || '';
  const password = document.getElementById('register-password')?.value || '';
  const role = window.selectedRole || 'dizaineris';
  const errorEl = document.getElementById('register-error');
  const btn = document.getElementById('register-btn');

  if (!name || !email || !password) {
    if (errorEl) {
      errorEl.textContent = 'Vardas, el. paštas ir slaptažodis reikalingi';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (password.length < 8) {
    if (errorEl) {
      errorEl.textContent = 'Slaptažodis turi būti bent 8 simboliai';
      errorEl.style.display = 'block';
    }
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Registruojama...';
  if (errorEl) errorEl.style.display = 'none';

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, phone, role })
    });

    const data = await response.json();

    if (!response.ok) {
      if (errorEl) {
        errorEl.textContent = data.error || 'Registracija nepavyko';
        errorEl.style.display = 'block';
      }
      btn.disabled = false;
      btn.textContent = 'Registruotis nemokamai';
      return;
    }

    // Set session user
    isLoggedIn = true;
    currentSessionUser = { id: data.id, email: data.email, name: data.name, role: data.role };

    // Load user data
    projects = getStoredProjects();
    if (normalizeLoadedProjectIcons(projects)) saveProjects();
    loadLikedForCurrentUser();
    refreshAllHeartButtons();
    updateHeartNav();
    updateMegstamiDot();
    updateMegstami();
    document.getElementById('fi-megstami').style.display = 'flex';

    // Update nav
    const nr = document.getElementById('nav-right');
    const langSwitchHtml = `<div class="lang-switch"><button class="lang-btn ${lang === 'lt' ? 'active' : ''}" onclick="setLang('lt')">LT</button><span style="color:var(--light);font-size:11px">|</span><button class="lang-btn ${lang === 'en' ? 'active' : ''}" onclick="setLang('en')">EN</button></div>`;

    if (data.role === 'dizaineris') {
      const avatar = (data.name || 'U').substring(0, 1).toUpperCase();
      nr.innerHTML = `${langSwitchHtml}<div class="account-menu"><button class="account-trigger" onclick="toggleAccountMenu(event)"><div class="n-avatar">${avatar}</div><span style="font-size:13px;color:var(--mid)">${data.name}</span><span class="account-caret">?</span></button><div class="account-dropdown" id="account-dropdown"><button class="account-item" onclick="go('dashboard');closeAccountMenu()" data-i18n="acc_open_dashboard">Atidaryti paskyra</button><button class="account-item" onclick="logout()" data-i18n="acc_logout">Atsijungti</button></div></div><span id="nav-heart" onclick="heartNavClick()" style="width:18px;height:18px;border-radius:50%;background:#fff;border:1.5px solid #1d1d1f;display:inline-block;cursor:pointer;transition:all .15s;margin-left:2px;vertical-align:middle" title="Mano megstami"></span>`;
      go('dashboard');
    } else {
      nr.innerHTML = `${langSwitchHtml}<div class="account-menu"><button class="account-trigger" onclick="toggleAccountMenu(event)"><div class="n-avatar">${(data.name || 'S').substring(0, 2).toUpperCase()}</div><span style="font-size:13px;color:var(--mid)">${data.name}</span><span class="account-caret">?</span></button><div class="account-dropdown" id="account-dropdown"><button class="account-item" onclick="go('tiekejo-paskyra');closeAccountMenu()" data-i18n="acc_open_supplier">Atidaryti paskyra</button><button class="account-item" onclick="logout()" data-i18n="acc_logout">Atsijungti</button></div></div>`;
      go('tiekejo-paskyra');
    }

    updateTopNavLinks();
    applyLang();

    // Clear form
    document.getElementById('register-name').value = '';
    document.getElementById('register-email').value = '';
    document.getElementById('register-phone').value = '';
    document.getElementById('register-password').value = '';

  } catch (err) {
    if (errorEl) {
      errorEl.textContent = 'Tinklo klaida. Bandykite vėliau.';
      errorEl.style.display = 'block';
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Registruotis nemokamai';
  }
}

function getScopedStorageKey(base){
  return currentSessionUser?.id ? `${base}-${currentSessionUser.id}` : '';
}

function clearCurrentUserData(){
  if(!currentSessionUser){
    alert('Pirmiausia prisijunkite kaip demo naudotojas.');
    return;
  }
  if(!confirm('Ar tikrai norite išvalyti visus io demo naudotojo duomenis?')) return;

  const keys=[
    getScopedStorageKey('pickindes-liked-products'),
    getScopedStorageKey('pickindes-projects'),
    getScopedStorageKey('pickindes-user-download-counts'),
    getScopedStorageKey('pickindes-download-order')
  ].filter(Boolean);

  keys.forEach(key=>localStorage.removeItem(key));

  liked.clear();
  projects=[];
  refreshAllHeartButtons();
  updateHeartNav();
  updateMegstamiDot();
  updateMegstami();
  updateDashboardProjects();
  renderDownloadedModelsCard();
  updateDownloadedModelsCount();

  alert('Demo duomenys išvalyti.');
}

function doSearch(v){
  const acl=document.getElementById('acl');
  filterGrid(v);
  if(!v.trim()){acl.style.display='none';return;}
  const source = (window.apiProducts && window.apiProducts.length)
    ? window.apiProducts.map(p => ({ n: p.name || '', b: p.brand || '', k: p.category || '' }))
    : prodDB;
  const q = v.toLowerCase();
  const res=source.filter(p=>p.n.toLowerCase().includes(q)||p.b.toLowerCase().includes(q)||p.k.toLowerCase().includes(q));
  if(!res.length){acl.style.display='none';return;}
  acl.innerHTML=res.map(p=>`<div class="ac-item" onclick="pickProduct('${p.n}')"><span class="ac-name">${p.n}</span><span class="ac-meta">${p.b} • ${p.k}</span></div>`).join('');
  acl.style.display='block';
}

function pickProduct(name){
  document.getElementById('si').value=name;
  document.getElementById('acl').style.display='none';
  go('produktas');
}

function filterGrid(v){
  const cards=document.querySelectorAll('.prod-grid .pc');
  const q=v.toLowerCase().trim();
  let visible=0;
  cards.forEach((card,i)=>{
    const br=card.querySelector('.pbr')?card.querySelector('.pbr').textContent.toLowerCase():'';
    const nm=card.querySelector('.pnm')?card.querySelector('.pnm').textContent.toLowerCase():'';
    const match=!q||nm.includes(q)||br.includes(q)||(prodDB[i]&&prodDB[i].k.toLowerCase().includes(q));
    card.style.display=match?'':'none';
    if(match) visible++;
  });
  updateCatalogCount(visible, Boolean(q));
}

document.addEventListener('click',e=>{
  if(!e.target.closest('.search-wrap')) document.getElementById('acl').style.display='none';
});

function setKat(el){
  showingMegstami=false;
  document.querySelectorAll('.filter-section .fi.on').forEach(i=>i.classList.remove('on'));
  el.classList.add('on');
  applyCatalogFilters();
  updateTags();
}

function togCheck(el){
  el.classList.toggle('checked');
  const c=el.querySelector('.fcheck');
  c.textContent=el.classList.contains('checked')?'✓':'';
  applyCatalogFilters();
  updateTags();
}

function updateTags(){
  const af=document.getElementById('active-tags');
  const tags=[];
  const kat=document.querySelector('#category-filter-section .fi.on');
  if(kat && kat.dataset.filterKind === 'category') tags.push(translateCategoryLabel(kat.dataset.categoryValue || ''));
  document.querySelectorAll('.fi.checked').forEach(el=>{
    const t=el.textContent.replace('✓','').trim();
    if(t) tags.push(t);
  });
  af.innerHTML=tags.map(t=>`<div class="atag">${t} <span class="atag-x">×</span></div>`).join('');
}

function clearFilters(){
  document.querySelectorAll('.fi.on').forEach(el=>el.classList.remove('on'));
  const first=document.querySelector('.sidebar .filter-section .fi');
  if(first) first.classList.add('on');
  document.querySelectorAll('.fi.checked').forEach(el=>{
    el.classList.remove('checked');
    const c=el.querySelector('.fcheck');
    if(c) c.textContent='';
  });
  document.getElementById('active-tags').innerHTML='';
  document.getElementById('si').value='';
  document.getElementById('acl').style.display='none';
  applyCatalogFilters();
}

function updateCatalogCount(count, isResults = false) {
  const cc = document.getElementById('cat-count');
  if (!cc) return;
  cc.textContent = `${count} ${t(isResults ? 'cat_results' : 'cat_title')}`;
}

function applyCatalogFilters(){
  const cards = document.querySelectorAll('.prod-grid .pc');
  const q = (document.getElementById('si')?.value || '').trim().toLowerCase();

  const activeCategoryEl = document.querySelector('#category-filter-section .fi.on');
  const activeCategoryKind = activeCategoryEl?.dataset.filterKind || 'all';
  const activeCategoryValue = (activeCategoryEl?.dataset.categoryValue || '').toLowerCase();

  const checkedBrands = Array.from(document.querySelectorAll('#brand-filter-section .fi.checked')).map(el =>
    el.textContent.replace('?', '').trim()
  );

  const checkedFormats = Array.from(document.querySelectorAll('#model-format-filter-section .fi.checked'))
    .map(el => String(el.dataset.modelFormat || '').toUpperCase().trim())
    .filter(Boolean);

  let visible = 0;
  cards.forEach(card => {
    const brand = (card.dataset.brand || '').toLowerCase();
    const category = (card.dataset.category || '').toLowerCase();
    const name = (card.dataset.name || '').toLowerCase();
    const modelFormats = String(card.dataset.modelFormats || '')
      .split(',')
      .map(value => value.trim().toUpperCase())
      .filter(Boolean);

    const matchesSearch = !q || name.includes(q) || brand.includes(q) || category.includes(q);
    const matchesCategory =
      activeCategoryKind === 'all' ||
      activeCategoryKind === 'favorites' ||
      category === activeCategoryValue;
    const matchesBrand = checkedBrands.length === 0 || checkedBrands.some(b => b.toLowerCase() === brand);
    const matchesFormat = checkedFormats.length === 0 || checkedFormats.some(fmt => modelFormats.includes(fmt));

    const show = matchesSearch && matchesCategory && matchesBrand && matchesFormat;
    card.style.display = show ? '' : 'none';
    if (show) visible++;
  });

  updateCatalogCount(visible, Boolean(q));
}

function selRole(el){
  document.querySelectorAll('.role-card').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  window.selectedRole = el.getAttribute('data-role') || 'dizaineris';
}

function togSar(el){
  el.classList.toggle('on');
  el.textContent=el.classList.contains('on')?'?':'';
  calcSar();
}

function calcSar(){
  const items=document.querySelectorAll('.sar-item');
  let total=0;
  items.forEach((item,i)=>{
    const on=item.querySelector('.sar-check').classList.contains('on');
    const qty=parseInt(item.querySelector('input').value)||1;
    const price=parseInt(item.querySelector('input').dataset.price)||0;
    const pEl=document.getElementById('sp'+i);
    if(on){
      const sum=price*qty;
      total+=sum;
      pEl.textContent=' '+sum.toLocaleString('lt-LT');
      pEl.className='sar-price';
    } else {
      pEl.textContent='';
      pEl.className='sar-price off';
    }
  });
  const disc=Math.round(total*0.92);
  const kom=Math.round(total*0.1);
  const nuolaida=total-disc;
  document.getElementById('sar-total').textContent=' '+disc.toLocaleString('lt-LT');
  document.getElementById('sar-kom').textContent='Komisiniai: • '+kom.toLocaleString('lt-LT');
  document.getElementById('s-nuolaida').textContent=' '+nuolaida.toLocaleString('lt-LT');
  document.getElementById('s-viso').textContent=' '+disc.toLocaleString('lt-LT');
}

const liked=new Set();
let isLoggedIn=false;

function getLikedStorageKey(){
  return getScopedStorageKey('pickindes-liked-products');
}

function refreshAllHeartButtons(){
  document.querySelectorAll('.heart-btn').forEach(btn=>{
    const idRaw=(btn.id||'').replace('hb-api-','').replace('hb-','');
    const idNum=Number(idRaw);
    if(Number.isInteger(idNum) && liked.has(idNum)) btn.classList.add('liked');
    else btn.classList.remove('liked');
  });
}

function loadLikedForCurrentUser(){
  liked.clear();
  const storageKey=getLikedStorageKey();
  if(!storageKey) return;
  try {
    const storedLiked = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(storedLiked)) {
      storedLiked
        .map(value => Number(value))
        .filter(value => Number.isInteger(value))
        .forEach(value => liked.add(value));
    }
  } catch (error) {
    console.warn('Could not restore liked products:', error);
  }
}

function persistLikedProducts() {
  const storageKey=getLikedStorageKey();
  if(!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(liked)));
  } catch (error) {
    console.warn('Could not persist liked products:', error);
  }
}

async function syncProductLike(productId, isLiked) {
  try {
    const response = await fetch(`/api/products/${productId}/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liked: isLiked })
    });
    if (!response.ok) throw new Error('Failed to sync like');
  } catch (error) {
    console.error('Failed to sync like:', error);
  }
}

function trackPartnerLinkClick(productId) {
  if (!Number.isInteger(Number(productId))) return;
  fetch(`/api/products/${productId}/link-click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true
  }).catch(error => {
    console.error('Failed to track partner link click:', error);
  });
}

function toggleHeart(e,idx){
  e.stopPropagation();
  if(!isLoggedIn){ showLoginToast(); return; }
  const btn=document.getElementById('hb-api-'+idx) || document.getElementById('hb-'+idx);
  let isLiked = false;
  if(liked.has(idx)){
    liked.delete(idx);
    if(btn) btn.classList.remove('liked');
  } else {
    liked.add(idx);
    if(btn) btn.classList.add('liked');
    isLiked = true;
  }
  persistLikedProducts();
  syncProductLike(idx, isLiked);
  updateHeartNav();
  updateMegstamiDot();
  updateMegstami();
  updateProdHeart(idx);
}

function updateProdHeart(idx){
  const btn=document.getElementById('prod-heart');
  if(!btn) return;
  if(liked.has(idx)) btn.classList.add('liked');
  else btn.classList.remove('liked');
}

function showLoginToast(){
  const t=document.createElement('div');
  t.innerHTML='Prisijunkite noredami išsaugoti &nbsp;<span onclick="go(\'login\')" style="text-decoration:underline;cursor:pointer">Prisijungti ?</span>';
  t.style.cssText='position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1d1d1f;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-family:Inter,sans-serif;z-index:999;animation:fadeIn .2s ease;white-space:nowrap';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

function updateHeartNav(){
  const nh=document.getElementById('nav-heart');
  if(!nh) return;
  nh.style.background=liked.size>0?'#1d1d1f':'#fff';
}

function updateMegstamiDot(){
  const dot=document.getElementById('fi-megstami-dot');
  if(dot) dot.style.background=liked.size>0?'#1d1d1f':'#fff';
}

function heartNavClick(){
  if(!isLoggedIn){ showLoginToast(); return; }
  setMegstami(document.getElementById('fi-megstami'));
  go('katalogas');
}

let showingMegstami=false;

function setMegstami(el){
  document.querySelectorAll('.filter-section .fi.on').forEach(i=>i.classList.remove('on'));
  el.classList.add('on');
  showingMegstami=true;
  filterMegstami();
}

function filterMegstami(){
  const cards=document.querySelectorAll('.prod-grid .pc');
  let visible=0;
  cards.forEach((card)=>{
    const productId = Number(card.dataset.productId || card.id.replace('pc-api-', ''));
    const show=liked.has(productId);
    card.style.display=show?'':'none';
    if(show) visible++;
  });
  const cc=document.getElementById('cat-count');
  if(cc) cc.textContent=visible+' megstamiausi produktai';
}

function updateMegstami(){
  const lbl=document.getElementById('fc-megstami');
  if(lbl) lbl.textContent=liked.size;
  if(showingMegstami) filterMegstami();
}

function openFlag(){
  document.querySelectorAll('.flag-opt').forEach(o=>o.classList.remove('sel'));
  document.getElementById('flag-ta').style.display='none';
  document.getElementById('flag-ta').value='';
  document.getElementById('flag-submit').style.opacity='.35';
  document.getElementById('flag-submit').style.pointerEvents='none';
  document.getElementById('flag-overlay').style.display='flex';
}

function closeFlag(){
  document.getElementById('flag-overlay').style.display='none';
}

function selFlag(el){
  document.querySelectorAll('.flag-opt').forEach(o=>o.classList.remove('sel'));
  el.classList.add('sel');
  const ta=document.getElementById('flag-ta');
  ta.style.display=el===document.getElementById('flag-other')?'block':'none';
  const sb=document.getElementById('flag-submit');
  sb.style.opacity='1';sb.style.pointerEvents='auto';
}

function submitFlag(){
  closeFlag();
  const t=document.createElement('div');
  t.textContent='Praneimas išsiustas • aciu!';
  t.style.cssText='position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1d1d1f;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-family:Inter,sans-serif;z-index:999;animation:fadeIn .2s ease';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2400);
}



function getStoredProjects(){
  const key=getScopedStorageKey('pickindes-projects');
  if(!key) return [];
  try{
    const raw=localStorage.getItem(key);
    if(!raw) return [];
    const parsed=JSON.parse(raw);
    if(!Array.isArray(parsed)) return [];
    return parsed;
  }catch(e){ return []; }
}
const PROJECT_ICONS=['??','??','??','??','??','??'];

function normalizeProjectIcon(icon){
  return PROJECT_ICONS.includes(icon) ? icon : PROJECT_ICONS[0];
}

function getDefaultProjectIcon(index){
  return PROJECT_ICONS[index % PROJECT_ICONS.length];
}

function normalizeLoadedProjectIcons(projectList){
  let changed=false;
  projectList.forEach(p=>{
    const normalized=normalizeProjectIcon(p.icon);
    if(p.icon!==normalized){
      p.icon=normalized;
      changed=true;
    }
    if(!p.ownerId){
      p.ownerId='designer-ak';
      changed=true;
    }
    if(!p.ownerName){
      p.ownerName='Aušra K.';
      changed=true;
    }
  });
  return changed;
}

function saveProjects(){
  const key=getScopedStorageKey('pickindes-projects');
  if(!key) return;
  try{ localStorage.setItem(key, JSON.stringify(projects)); }catch(e){}
}
let projects=getStoredProjects();
if(normalizeLoadedProjectIcons(projects)) saveProjects();

let currentProdName='';
let selectedProj=null;

function getUserDownloadCounts(){
  const key=getScopedStorageKey('pickindes-user-download-counts');
  if(!key) return {};
  try{
    const raw=localStorage.getItem(key);
    if(!raw) return {};
    const parsed=JSON.parse(raw);
    if(!parsed || typeof parsed!=='object' || Array.isArray(parsed)) return {};
    return parsed;
  }catch(error){
    console.warn('Could not read user download counts:', error);
    return {};
  }
}

function saveUserDownloadCounts(counts){
  const key=getScopedStorageKey('pickindes-user-download-counts');
  if(!key) return;
  try{
    localStorage.setItem(key, JSON.stringify(counts));
  }catch(error){
    console.warn('Could not persist user download counts:', error);
  }
}

function getDownloadOrder(){
  const key=getScopedStorageKey('pickindes-download-order');
  if(!key) return [];
  try{
    const raw=localStorage.getItem(key);
    if(!raw) return [];
    const parsed=JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }catch(e){ return []; }
}
function saveDownloadOrder(order){
  const key=getScopedStorageKey('pickindes-download-order');
  if(!key) return;
  try{ localStorage.setItem(key, JSON.stringify(order)); }catch(e){}
}

function updateDownloadedModelsCount(){
  const order=getDownloadOrder();
  const statEl=document.getElementById('stat-downloaded-models');
  if(statEl) statEl.textContent=order.length;
}

function trackUserModelDownload(productId){
  const idNum=Number(productId);
  if(!Number.isInteger(idNum)) return;
  const counts=getUserDownloadCounts();
  const key=String(idNum);
  counts[key]=(Number(counts[key])||0)+1;
  saveUserDownloadCounts(counts);
  // Always move to top (remove old position, push to end = newest)
  const order=getDownloadOrder().filter(id=>id!==idNum);
  order.push(idNum);
  saveDownloadOrder(order);
  if(document.getElementById('dashboard')?.classList.contains('active')){
    updateDownloadedModelsCount();
    renderDownloadedModelsCard();
  }
}

let currentProjectName='';
// Delegated listener • handles clicks on dynamically rendered project page buttons
document.addEventListener('click', function(e){
  if(e.target && e.target.id==='proj-edit-btn') openProjDetailsPopup();
});

function openProjectPage(projName){
  currentProjectName=projName;
  renderProjectPage(projName);
  go('projektas');
}

function canCurrentUserEditProject(project){
  if(!project || !currentSessionUser) return false;
  if(currentSessionUser.role!=='dizaineris') return false;
  if(!project.ownerId) return true; // Backward compatibility for old localStorage projects
  return project.ownerId===currentSessionUser.id;
}

const AFFILIATE_CODE='AUSRA2026';
const CLIENT_DISCOUNT_PCT=8;
let currentClientPayload=null;
let currentClientProjectName='';

function escapeHtml(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function encodeClientPayload(payload){
  const bytes=new TextEncoder().encode(JSON.stringify(payload));
  let bin='';
  bytes.forEach(b=>{ bin+=String.fromCharCode(b); });
  return btoa(bin);
}

function decodeClientPayload(token){
  const bin=atob(token);
  const bytes=Uint8Array.from(bin, c => c.charCodeAt(0));
  const json=new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

function renderClientListPage(payload, options={}){
  const showShareActions=Boolean(options.showShareActions);
  const canEditNote=Boolean(options.canEditNote);
  const projectName=options.projectName || '';
  const wrap=document.getElementById('client-list-wrap');
  if(!wrap) return;
  const items=Array.isArray(payload?.items) ? payload.items : [];
  const clientNote=String(payload?.clientNote || '').trim();
  const total=items.reduce((sum,item)=>sum+(Number(item.price)||0),0);
  const discounted=Math.round(total*(1-CLIENT_DISCOUNT_PCT/100));
  const categories=new Set(items.map(i=>i.category||'Kita')).size;

  const rows=items.map((item,idx)=>{
    const link=item.link ? `<a class="client-item-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">I parduotuve ?</a>` : '<span class="client-item-link client-item-link-off">Nuorodos nera</span>';
    const price=Number(item.price)||0;
    return `<div class="sar-item"><div class="sar-check on">?</div><div class="sar-item-info"><div class="sar-item-brand">${escapeHtml(item.brand||'')}</div><div class="sar-item-name">${escapeHtml(item.name||'')}</div></div><div class="client-item-link-wrap">${link}</div><div class="sar-price" id="cli-price-${idx}">${price?(' '+price.toLocaleString('lt-LT')):''}</div></div>`;
  }).join('');

  const actionBar=showShareActions?`
    <div class="client-share-card" style="margin-top:0;margin-bottom:12px">
      <div class="client-share-title">Periura prie siuntima</div>
      <div class="client-share-sub">Patikrinkite saraža ir tik tada siuskite klientui.</div>
      <div class="client-share-actions">
        <button class="btn-full btn-out" onclick="copyClientListLink()">Kopijuoti nuoroda</button>
        <button class="btn-full btn-out" onclick="generateClientListPdf()">PDF su nuorodomis</button>
      </div>
    </div>`:'';

  const noteViewHtml=clientNote
    ? `<div class="client-note-view"><div class="client-note-title">Pastabos klientui</div><div class="client-note-text">${escapeHtml(clientNote)}</div></div>`
    : '';

  const noteEditorHtml=canEditNote?`
    <div class="client-note-editor">
      <div class="client-note-title">Pastabos klientui</div>
      <textarea id="client-note-input" class="client-note-input" rows="3" placeholder="Iražykite svarbias pastabas klientui...">${escapeHtml(clientNote)}</textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:8px">
        <button class="btn-full btn-dark" style="max-width:180px" onclick='saveClientNoteFromEditor(${JSON.stringify(projectName)})'>Išsaugoti pastabas</button>
      </div>
    </div>`:'';

  const backProjectName=projectName || payload?.projectName || '';
  const backHtml=(canEditNote && backProjectName)
    ? `<div style="margin-bottom:16px"><span onclick='goBackFromClientList(${JSON.stringify(backProjectName)})' style="font-size:13px;color:var(--mid);cursor:pointer;transition:color .1s" onmouseover="this.style.color='var(--dark)'" onmouseout="this.style.color='var(--mid)'">? Grišti i projekta</span></div>`
    : '';

  wrap.innerHTML=`
    ${actionBar}
    ${backHtml}
    <div class="sar-header-box">
      <div class="sar-proj-label">Saražas klientui</div>
      <div class="sar-proj-name">${escapeHtml(payload.projectIcon||'??')} ${escapeHtml(payload.projectName||'Projektas')}</div>
      <div class="sar-proj-sub">${escapeHtml(payload.projectType||'Projektas')} • ${items.length} produkt${items.length===1?'as':'u'}</div>
      <div class="sar-designer-row">
        <div class="sar-avatar">AK</div>
        <div>
          <div class="sar-d-name">Aušra Kazlauskiene</div>
          <div class="sar-d-title">Interjero dizainere</div>
        </div>
        <div class="sar-code-badge">
          <div class="sar-code-label">Nuolaidos kodas</div>
          <div class="sar-code-val">${escapeHtml(payload.affiliateCode||AFFILIATE_CODE)}</div>
        </div>
      </div>
    </div>
    <div class="sar-discount">
      <div class="sar-disc-text">Pirkdami su kodu <strong>${escapeHtml(payload.affiliateCode||AFFILIATE_CODE)}</strong> gausite <strong>${CLIENT_DISCOUNT_PCT}% nuolaida</strong> visam užsakymui</div>
      <div class="sar-disc-pct">-${CLIENT_DISCOUNT_PCT}%</div>
    </div>
    <div class="sar-summary">
      <div class="sar-sum-box"><div class="sar-sum-n">${items.length}</div><div class="sar-sum-l">Produktu</div></div>
      <div class="sar-sum-box"><div class="sar-sum-n">${categories}</div><div class="sar-sum-l">Kategorijos</div></div>
      <div class="sar-sum-box"><div class="sar-sum-n"> ${(total-discounted).toLocaleString('lt-LT')}</div><div class="sar-sum-l">Jusu nuolaida</div></div>
      <div class="sar-sum-box"><div class="sar-sum-n"> ${discounted.toLocaleString('lt-LT')}</div><div class="sar-sum-l">Viso su nuolaida</div></div>
    </div>
    ${noteViewHtml}
    ${rows || '<div style="font-size:13px;color:var(--light);padding:12px 0">Projektas dar neturi produktu.</div>'}
    ${noteEditorHtml}`;
}

function goBackFromClientList(projectName){
  if(projectName && projects.some(p=>p.name===projectName)){
    openProjectPage(projectName);
    return;
  }
  go('katalogas');
}

async function buildClientPayload(projectName){
  const proj=projects.find(p=>p.name===projectName);
  if(!proj) return null;

  let apiProds=[];
  try{ apiProds=await loadProducts(true); }catch(e){ apiProds=[]; }
  const byName=new Map(apiProds.map(p=>[String(p.name).trim(),p]));

  const items=proj.products.map(name=>{
    const ap=byName.get(String(name).trim());
    let imageUrl='';
    if(ap?.images && typeof ap.images==='object'){
      const preferred=ap.images.MAIN || ap.images.JPG;
      const selected=preferred || Object.values(ap.images)[0];
      if(selected) imageUrl=`/uploads/${encodeURI(selected)}`;
    }
    return {
      name: name,
      brand: ap?.brand || '',
      category: ap?.category || 'Kita',
      price: Number(ap?.price) || 0,
      link: ap?.link || '',
      imageUrl
    };
  });

  return {
    projectName: proj.name,
    projectIcon: proj.icon || '??',
    projectType: proj.details?.type || 'Projektas',
    affiliateCode: AFFILIATE_CODE,
    clientNote: proj.details?.clientNote || '',
    generatedAt: Date.now(),
    items
  };
}

async function openClientListCard(projectName){
  const payload=await buildClientPayload(projectName);
  if(!payload){
    alert('Nepavyko sugeneruoti kliento saražo.');
    return;
  }
  const proj=projects.find(p=>p.name===projectName);
  const canEditNote=canCurrentUserEditProject(proj);
  const showShareActions=canEditNote;
  currentClientPayload=payload;
  currentClientProjectName=projectName;
  renderClientListPage(payload,{showShareActions,canEditNote,projectName});
  const token=encodeClientPayload(payload);
  window.history.replaceState(null,'',`#kliento=${encodeURIComponent(token)}`);
  go('kliento-sarasas');
}

async function copyClientListLink(projectName=''){
  const sourceName=projectName || currentClientProjectName;
  const payload=sourceName ? await buildClientPayload(sourceName) : currentClientPayload;
  if(!payload){
    alert('Nepavyko sugeneruoti nuorodos.');
    return;
  }
  currentClientPayload=payload;
  const token=encodeClientPayload(payload);
  const link=`${window.location.origin}${window.location.pathname}#kliento=${encodeURIComponent(token)}`;
  try{
    await navigator.clipboard.writeText(link);
    alert('Nuoroda nukopijuota!');
  }catch(e){
    window.prompt('Nukopijuokite nuoroda ranka:', link);
  }
}

async function generateClientListPdf(projectName=''){
  const sourceName=projectName || currentClientProjectName;
  const payload=sourceName ? await buildClientPayload(sourceName) : currentClientPayload;
  if(!payload){
    alert('Nepavyko sugeneruoti PDF.');
    return;
  }
  let jsPDFCtor=null;
  if(window.jspdf?.jsPDF){
    jsPDFCtor=window.jspdf.jsPDF;
  } else {
    try{
      const mod=await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm');
      jsPDFCtor=mod.jsPDF;
    }catch(e){
      alert('Nepavyko ikelti PDF bibliotekos.');
      return;
    }
  }

  const total=payload.items.reduce((sum,item)=>sum+(Number(item.price)||0),0);
  const discounted=Math.round(total*(1-CLIENT_DISCOUNT_PCT/100));

  async function loadImageData(url){
    if(!url) return null;
    try{
      const img=await new Promise((resolve,reject)=>{
        const el=new Image();
        el.crossOrigin='anonymous';
        el.onload=()=>resolve(el);
        el.onerror=reject;
        el.src=url;
      });
      const canvas=document.createElement('canvas');
      canvas.width=80;
      canvas.height=80;
      const ctx=canvas.getContext('2d');
      if(!ctx) return null;
      ctx.drawImage(img,0,0,80,80);
      return canvas.toDataURL('image/jpeg',0.85);
    }catch(e){
      return null;
    }
  }

  const doc=new jsPDFCtor({orientation:'p',unit:'mm',format:'a4'});
  const pageW=doc.internal.pageSize.getWidth();
  const pageH=doc.internal.pageSize.getHeight();
  const margin=12;
  let y=margin;

  doc.setFont('helvetica','bold');
  doc.setFontSize(16);
  doc.text(`${payload.projectIcon || '??'} ${payload.projectName || 'Projektas'}`, margin, y);
  y+=7;
  doc.setFont('helvetica','normal');
  doc.setFontSize(11);
  doc.text(`Nuolaidos kodas: ${payload.affiliateCode || AFFILIATE_CODE} (-${CLIENT_DISCOUNT_PCT}%)`, margin, y);
  y+=6;
  doc.text(`Viso su nuolaida: EUR ${discounted.toLocaleString('lt-LT')}`, margin, y);
  y+=8;

  doc.setDrawColor(220,220,220);
  doc.line(margin,y,pageW-margin,y);
  y+=5;

  for(const item of payload.items){
    const rowH=20;
    if(y+rowH>pageH-margin){
      doc.addPage();
      y=margin;
    }

    doc.setDrawColor(238,238,238);
    doc.line(margin,y+rowH,pageW-margin,y+rowH);

    const thumbSize=14;
    const thumbX=margin;
    const thumbY=y+3;
    const imageData=await loadImageData(item.imageUrl);
    if(imageData){
      doc.addImage(imageData,'JPEG',thumbX,thumbY,thumbSize,thumbSize);
    } else {
      doc.setDrawColor(210,210,210);
      doc.rect(thumbX,thumbY,thumbSize,thumbSize);
    }

    const textX=thumbX+thumbSize+4;
    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.text(String(item.name || '-').slice(0,56),textX,y+7);
    doc.setFont('helvetica','normal');
    doc.setFontSize(8.5);
    doc.setTextColor(110,110,115);
    doc.text(String(item.brand || ''),textX,y+12);
    doc.setTextColor(29,29,31);

    doc.setFontSize(10);
    const priceText=item.price ? `EUR ${Number(item.price).toLocaleString('lt-LT')}` : '-';
    doc.text(priceText,pageW-52,y+8,{align:'right'});

    const btnW=22;
    const btnH=7;
    const btnX=pageW-49;
    const btnY=y+10;
    if(item.link){
      doc.setFillColor(29,29,31);
      doc.roundedRect(btnX,btnY,btnW,btnH,1.8,1.8,'F');
      doc.setTextColor(255,255,255);
      doc.setFontSize(8.5);
      doc.text('Nuoroda',btnX+btnW/2,btnY+4.7,{align:'center'});
      doc.link(btnX,btnY,btnW,btnH,{url:item.link});
      doc.setTextColor(29,29,31);
    } else {
      doc.setDrawColor(180,180,180);
      doc.roundedRect(btnX,btnY,btnW,btnH,1.8,1.8,'S');
      doc.setTextColor(140,140,140);
      doc.setFontSize(8.5);
      doc.text('Nera',btnX+btnW/2,btnY+4.7,{align:'center'});
      doc.setTextColor(29,29,31);
    }

    y+=rowH;
  }

  const safeName=String(payload.projectName || 'kliento-sarasas').replace(/[\\/:*?"<>|]/g,'-');
  doc.save(`${safeName}-kliento-sarasas.pdf`);
}

function handleClientHashOpen(){
  const hash=window.location.hash || '';
  if(!hash.startsWith('#kliento=')) return;
  const raw=hash.slice('#kliento='.length);
  if(!raw) return;
  try{
    const payload=decodeClientPayload(decodeURIComponent(raw));
    currentClientPayload=payload;
    currentClientProjectName='';
    renderClientListPage(payload,{showShareActions:false,canEditNote:false});
    go('kliento-sarasas');
  }catch(e){
    console.error('Failed to decode shared client list link:', e);
  }
}

function saveClientNoteFromEditor(projectName){
  const noteInput=document.getElementById('client-note-input');
  if(!noteInput) return;
  const note=noteInput.value.trim();
  const proj=projects.find(p=>p.name===projectName);
  if(!proj) return;
  if(!canCurrentUserEditProject(proj)){
    alert('Pastabas gali redaguoti tik io projekto autorius.');
    return;
  }
  if(!proj.details) proj.details={};
  proj.details.clientNote=note;
  saveProjects();
  const nextPayload={...(currentClientPayload||{}), clientNote: note};
  currentClientPayload=nextPayload;
  renderClientListPage(nextPayload,{showShareActions:true,canEditNote:true,projectName});
}

async function renderProjectPage(projName){
  const wrap=document.getElementById('proj-detail-wrap');
  if(!wrap) return;
  const proj=projects.find(p=>p.name===projName);
  if(!proj){
    wrap.innerHTML='<div style="color:var(--light);font-size:13px;padding:40px 0;text-align:center">Projektas nerastas.</div>';
    return;
  }
  wrap.innerHTML='<div style="color:var(--light);font-size:13px;padding:40px 0;text-align:center">Kraunama...</div>';

  let apiProds=[];
  try{ apiProds=await loadProducts(true); }catch(e){}
  const byName=new Map(apiProds.map(p=>[String(p.name).trim(),p]));

  const items=proj.products.map(name=>{
    const ap=byName.get(String(name).trim());
    let imageUrl='';
    if(ap?.images && typeof ap.images==='object'){
      const preferred=ap.images.MAIN || ap.images.JPG;
      const selected=preferred || Object.values(ap.images)[0];
      if(selected) imageUrl=`/uploads/${encodeURI(selected)}`;
    }
    return {
      name,
      id:Number(ap?.id) || null,
      brand:ap?.brand||'',
      category:ap?.category||'Kita',
      price:Number(ap?.price)||0,
      imageUrl
    };
  });

  const catMap={};
  items.forEach(item=>{
    if(!catMap[item.category]) catMap[item.category]=[];
    catMap[item.category].push(item);
  });
  const catEntries=Object.entries(catMap);

  let itemIdx=0;
  let itemsHtml='';
  catEntries.forEach(([cat,catItems])=>{
    const label=catItems.length===1?'produktas':'produktai';
    itemsHtml+=`<div class="sar-cat-header"><div class="sar-cat-title">${cat}</div><div class="sar-cat-line"></div><div class="sar-cat-count">${catItems.length} ${label}</div></div>`;
    catItems.forEach(item=>{
      const priceStr=item.price?' '+item.price.toLocaleString('lt-LT'):'';
      const thumb=item.imageUrl
        ? `<img src="${item.imageUrl}" alt="" class="proj-item-thumb-img">`
        : `<div class="proj-item-thumb-fallback">?</div>`;
      const productNameHtml=item.id
        ? `<button type="button" class="proj-item-link" onclick="showProductDetail(${item.id})">${item.name}</button>`
        : `<span class="sar-item-name">${item.name}</span>`;
      itemsHtml+=`<div class="sar-item"><div class="sar-check on" onclick="toggleProjItem(this)">?</div><div class="proj-item-thumb">${thumb}</div><div class="sar-item-info"><div class="sar-item-brand">${item.brand}</div>${productNameHtml}</div><div class="sar-qty-wrap"><span class="sar-qty-label"></span><input class="sar-qty-input" type="number" value="1" min="1" data-price="${item.price}" oninput="calcProjTotal()"></div><div class="sar-price" id="ppi${itemIdx}">${priceStr}</div></div>`;
      itemIdx++;
    });
  });

  const emptyMsg=items.length===0?`<div style="font-size:13px;color:var(--light);padding:20px 0">Dar nera produktu. Raskite produkta kataloge ir spauskite Prideti i projekta".</div>`:'';

  const totalHtml=items.length?`
    <div class="sar-total-box">
      <div><div class="sar-total-label">Viso su nuolaida (-8%)</div><div class="sar-total-sub">Jusu komisiniai • 10%</div></div>
      <div><div class="sar-total-val" id="proj-sar-total"> 0</div><div class="sar-total-com" id="proj-sar-kom">Komisiniai: • 0</div></div>
    </div>`:'';

  const projectNameArg=JSON.stringify(proj.name);
  const clientCardHtml=items.length?`
    <div class="client-share-card">
      <div class="client-share-title">Saražas klientui</div>
      <div class="client-share-sub">Pirmiausia periurekite kliento saraža. Ten rasite mygtukus nuorodai kopijuoti ir PDF generuoti. Nuolaidos kodas: <strong>${AFFILIATE_CODE}</strong></div>
      <div class="client-share-actions">
        <button class="btn-full btn-dark" onclick='openClientListCard(${projectNameArg})'>Saražas klientui</button>
      </div>
    </div>`:'';

  wrap.innerHTML=`
    <div style="margin-bottom:16px"><span onclick="go('dashboard')" style="font-size:13px;color:var(--mid);cursor:pointer;transition:color .1s" onmouseover="this.style.color='var(--dark)'" onmouseout="this.style.color='var(--mid)'">? Grišti i paskyra</span></div>
    <div class="sar-header-box">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:0">
        <div style="flex:1;min-width:0">
          <div class="sar-proj-label">Projektas</div>
          <div class="sar-proj-name">${proj.icon} ${proj.name}</div>
          <div class="sar-proj-sub">${[
            proj.details?.type,
            proj.details?.area ? proj.details.area+' m' : '',
            proj.details?.style,
            proj.details?.location
          ].filter(Boolean).join(' • ') || (proj.status+' • '+items.length+' produkt'+(items.length===1?'as':items.length%10>=2&&items.length%10<=9?'ai':'u'))}</div>
        </div>
        <button id="proj-edit-btn" style="flex-shrink:0;margin-left:16px;margin-top:2px;padding:6px 14px;border-radius:20px;border:0.5px solid rgba(255,255,255,.25);background:rgba(255,255,255,.1);color:rgba(255,255,255,.8);font-size:12px;cursor:pointer;font-family:'Inter',sans-serif;white-space:nowrap;transition:background .15s">&#9999;&#65039; Redaguoti</button>
      </div>
      <div class="sar-designer-row" style="margin-top:18px">
        <div class="sar-avatar">AK</div>
        <div>
          <div class="sar-d-name">Aušra Kazlauskiene</div>
          <div class="sar-d-title">Interjero dizainere</div>
        </div>
        ${proj.details?.client?`<div class="sar-code-badge"><div class="sar-code-label">Klientas</div><div class="sar-code-val" style="font-size:13px;font-family:'Inter',sans-serif">${proj.details.client}</div></div>`:''}
      </div>
      ${proj.details?.notes?`<div style="margin-top:14px;padding-top:14px;border-top:0.5px solid rgba(255,255,255,.12);font-size:12px;color:rgba(255,255,255,.45);line-height:1.5">${proj.details.notes}</div>`:''}
    </div>
    <div class="sar-summary">
      <div class="sar-sum-box"><div class="sar-sum-n">${items.length}</div><div class="sar-sum-l">Produktu</div></div>
      <div class="sar-sum-box"><div class="sar-sum-n">${catEntries.length}</div><div class="sar-sum-l">Kategorijos</div></div>
      <div class="sar-sum-box"><div class="sar-sum-n" id="proj-s-nuolaida"> 0</div><div class="sar-sum-l">Jusu nuolaida</div></div>
      <div class="sar-sum-box"><div class="sar-sum-n" id="proj-s-viso"> 0</div><div class="sar-sum-l">Viso su nuolaida</div></div>
    </div>
    ${itemsHtml}${emptyMsg}${totalHtml}${clientCardHtml}`;

  const editBtn=document.getElementById('proj-edit-btn');
  calcProjTotal();
}

function toggleProjItem(el){
  el.classList.toggle('on');
  el.textContent=el.classList.contains('on')?'?':'';
  calcProjTotal();
}

function calcProjTotal(){
  const wrap=document.getElementById('proj-detail-wrap');
  if(!wrap) return;
  const items=wrap.querySelectorAll('.sar-item');
  let total=0;
  items.forEach((item,i)=>{
    const on=item.querySelector('.sar-check').classList.contains('on');
    const qty=parseInt(item.querySelector('input').value)||1;
    const price=parseInt(item.querySelector('input').dataset.price)||0;
    const pEl=document.getElementById('ppi'+i);
    if(on){
      const sum=price*qty;
      total+=sum;
      if(pEl){pEl.textContent=' '+sum.toLocaleString('lt-LT');pEl.className='sar-price';}
    } else {
      if(pEl){pEl.textContent='';pEl.className='sar-price off';}
    }
  });
  const disc=Math.round(total*0.92);
  const kom=Math.round(total*0.1);
  const nuolaida=total-disc;
  const t1=document.getElementById('proj-sar-total');
  const t2=document.getElementById('proj-sar-kom');
  const t3=document.getElementById('proj-s-nuolaida');
  const t4=document.getElementById('proj-s-viso');
  if(t1) t1.textContent=' '+disc.toLocaleString('lt-LT');
  if(t2) t2.textContent='Komisiniai: • '+kom.toLocaleString('lt-LT');
  if(t3) t3.textContent=' '+nuolaida.toLocaleString('lt-LT');
  if(t4) t4.textContent=' '+disc.toLocaleString('lt-LT');
}

function openProjDetailsPopup(){
  const proj=projects.find(p=>p.name===currentProjectName);
  if(!proj) return;
  const d=proj.details||{};
  document.getElementById('pd-name').value=proj.name||'';
  document.getElementById('pd-icon').value=normalizeProjectIcon(proj.icon);
  document.getElementById('pd-client').value=d.client||'';
  document.getElementById('pd-location').value=d.location||'';
  document.getElementById('pd-area').value=d.area||'';
  document.getElementById('pd-type').value=d.type||'';
  document.getElementById('pd-style').value=d.style||'';
  document.getElementById('pd-notes').value=d.notes||'';
  const ov=document.getElementById('proj-details-overlay');
  ov.style.display='flex';
  setTimeout(()=>document.getElementById('pd-name').focus(),50);
}

function closeProjDetailsPopup(){
  document.getElementById('proj-details-overlay').style.display='none';
}

function saveProjDetails(){
  const proj=projects.find(p=>p.name===currentProjectName);
  if(!proj) return;
  const newName=document.getElementById('pd-name').value.trim();
  if(!newName){
    alert('Iveskite projekto pavadinima.');
    return;
  }
  const duplicate=projects.find(p=>p!==proj && String(p.name).toLowerCase()===newName.toLowerCase());
  if(duplicate){
    alert('Projektas su tokiu pavadinimu jau egzistuoja.');
    return;
  }
  proj.name=newName;
  proj.icon=normalizeProjectIcon(document.getElementById('pd-icon').value);
  currentProjectName=newName;
  proj.details={
    client:document.getElementById('pd-client').value.trim(),
    location:document.getElementById('pd-location').value.trim(),
    area:document.getElementById('pd-area').value.trim(),
    type:document.getElementById('pd-type').value,
    style:document.getElementById('pd-style').value.trim(),
    notes:document.getElementById('pd-notes').value.trim(),
  };
  saveProjects();
  closeProjDetailsPopup();
  renderProjectPage(currentProjectName);
}

function openProjPopup(idx,name){
  if(!isLoggedIn){
    showLoginToast();
    return;
  }
  const fallbackName=selectedProductData?.name || document.querySelector('.prod-h1')?.textContent || '';
  currentProdName=(name||fallbackName||'').trim();
  selectedProj=null;
  document.querySelectorAll('.proj-pick-item').forEach(el=>el.classList.remove('sel'));
  const btn=document.getElementById('proj-confirm-btn');
  btn.style.opacity='.4';btn.style.pointerEvents='none';
  const nameEl=document.getElementById('popup-prod-name');
  if(nameEl) nameEl.textContent=currentProdName;
  hideNewProjInput();
  rebuildProjList();
  const ov=document.getElementById('proj-overlay');
  ov.style.display='flex';
}

function rebuildProjList(){
  const list=document.getElementById('proj-list');
  list.innerHTML='';
  projects.filter(p=>p.status!=='Baigtas').forEach((p,i)=>{
    const item=document.createElement('div');
    item.className='proj-pick-item';
    item.innerHTML='<div style="display:flex;align-items:center;gap:10px"><div style="width:32px;height:32px;border-radius:7px;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">'+p.icon+'</div><div><div style="font-size:13px;font-weight:500">'+p.name+'</div><div style="font-size:11px;color:var(--light)">'+p.count+' produktu • '+p.status+'</div></div></div><div class="proj-pick-check">?</div>';
    item.onclick=()=>selectProj(item,p.name);
    list.appendChild(item);
  });
}

function showNewProjInput(){
  document.getElementById('new-proj-row').style.display='none';
  const row=document.getElementById('new-proj-input-row');
  row.style.display='flex';
  document.getElementById('new-proj-input').value='';
  setTimeout(()=>document.getElementById('new-proj-input').focus(),50);
}

function hideNewProjInput(){
  const row=document.getElementById('new-proj-input-row');
  if(row) row.style.display='none';
  const r=document.getElementById('new-proj-row');
  if(r) r.style.display='flex';
}

function createNewProj(){
  const input=document.getElementById('new-proj-input');
  const name=input.value.trim();
  if(!name) return;
  const newP={
    name:name,
    icon:getDefaultProjectIcon(projects.length),
    count:0,
    status:'Aktyvus',
    products:[],
    createdAt:Date.now(),
    finishedAt:null,
    ownerId:currentSessionUser?.id || 'designer-ak',
    ownerName:currentSessionUser?.name || 'Aušra K.'
  };
  projects.unshift(newP);
  saveProjects();
  hideNewProjInput();
  rebuildProjList();
  updateDashboardProjects();
  const firstItem=document.getElementById('proj-list').firstElementChild;
  if(firstItem) selectProj(firstItem,name);
}

function newProject(){ showNewProjInput(); }

function closeProjPopup(){
  document.getElementById('proj-overlay').style.display='none';
}

function selectProj(el,name){
  document.querySelectorAll('.proj-pick-item').forEach(i=>i.classList.remove('sel'));
  el.classList.add('sel');
  selectedProj=name;
  const btn=document.getElementById('proj-confirm-btn');
  btn.style.opacity='1';btn.style.pointerEvents='auto';
}

function confirmProj(){
  if(!selectedProj) return;
  const proj=projects.find(p=>p.name===selectedProj);
  if(proj&&currentProdName){
    if(!proj.products.includes(currentProdName)){
      proj.products.push(currentProdName);
      proj.count++;
    }
  }
  saveProjects();
  updateDashboardProjects();
  closeProjPopup();
  const t=document.createElement('div');
  t.textContent='? "'+currentProdName+'" prideta i "'+selectedProj+'"';
  t.style.cssText='position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1d1d1f;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-family:Inter,sans-serif;z-index:999;animation:fadeIn .2s ease;white-space:nowrap';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2600);
}

function toggleProjectStatus(name){
  const proj=projects.find(p=>p.name===name);
  if(!proj) return;
  if(proj.status==='Baigtas'){
    proj.status='Aktyvus';
    proj.finishedAt=null;
  } else {
    proj.status='Baigtas';
    proj.finishedAt=Date.now();
  }
  saveProjects();
  updateDashboardProjects();
}

function deleteProject(name){
  const proj=projects.find(p=>p.name===name);
  if(!proj) return;
  if(!confirm(`Ar tikrai norite ištrinti projekta "${name}"?`)) return;
  projects=projects.filter(p=>p.name!==name);
  saveProjects();
  updateDashboardProjects();
}

function updateDashboardProjects(){
  const container=document.getElementById('dash-proj-list');
  if(!container) return;
  container.innerHTML='';
  if(projects.length===0){
    const empty=document.createElement('div');
    empty.style.cssText='font-size:13px;color:var(--light);padding:10px 0';
    empty.textContent=t('proj_empty');
    container.appendChild(empty);
  } else {
    const active=projects.filter(p=>p.status!=='Baigtas').sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const finished=projects.filter(p=>p.status==='Baigtas').sort((a,b)=>(b.finishedAt||0)-(a.finishedAt||0));
    [...active,...finished].forEach(p=>{
      const isDone=p.status==='Baigtas';
      const div=document.createElement('div');
      div.className='proj-row';
      div.style.cssText='display:flex;align-items:center;gap:0;opacity:'+( isDone?'.55':'1');
      const mainPart=document.createElement('div');
      mainPart.style.cssText='display:flex;align-items:center;gap:0;flex:1;cursor:pointer;min-width:0';
      mainPart.onclick=()=>openProjectPage(p.name);
      mainPart.innerHTML='<div class="proj-ico">'+p.icon+'</div><div class="proj-info"><div class="proj-name" style="'+(isDone?'text-decoration:line-through;color:var(--light)':'')+'">'+p.name+'</div><div class="proj-meta">'+p.count+' produktu</div></div>';
      const btn=document.createElement('button');
      btn.textContent=isDone?t('proj_btn_activate'):t('proj_btn_finish');
      btn.style.cssText='flex-shrink:0;padding:4px 10px;border-radius:20px;border:0.5px solid var(--border2);background:'+(isDone?'none':'var(--bg2)')+';color:var(--mid);font-size:11px;cursor:pointer;font-family:Inter,sans-serif;white-space:nowrap;margin-left:8px';
      btn.onclick=(e)=>{e.stopPropagation();toggleProjectStatus(p.name);};
      const delBtn=document.createElement('button');
      delBtn.textContent='Ištrinti';
      delBtn.style.cssText='flex-shrink:0;padding:4px 10px;border-radius:20px;border:0.5px solid rgba(180,40,40,.35);background:none;color:#9a2f2f;font-size:11px;cursor:pointer;font-family:Inter,sans-serif;white-space:nowrap;margin-left:6px';
      delBtn.onclick=(e)=>{e.stopPropagation();deleteProject(p.name);};
      div.appendChild(mainPart);
      div.appendChild(btn);
      div.appendChild(delBtn);
      container.appendChild(div);
    });
  }
  const statEl=document.getElementById('stat-active-projects');
  if(statEl) statEl.textContent=projects.filter(p=>p.status!=='Baigtas').length;
}

function createDownloadedModelRow(modelName){
  const row=document.createElement('div');
  row.className='dl-row';

  const dot=document.createElement('div');
  dot.className='dl-dot';

  const nameEl=document.createElement('div');
  nameEl.className='dl-name';
  nameEl.textContent=`${modelName}.skp`;

  const useBtn=document.createElement('button');
  useBtn.className='dl-use';
  useBtn.textContent=t('dash_use');
  useBtn.onclick=()=>openProjPopup(-1, modelName);

  row.appendChild(dot);
  row.appendChild(nameEl);
  row.appendChild(useBtn);
  return row;
}

async function renderDownloadedModelsCard(){
  const list=document.getElementById('dash-downloaded-models-list');
  if(!list) return;

  list.innerHTML='';
  const loadingRow=document.createElement('div');
  loadingRow.className='dl-row';
  loadingRow.innerHTML=`<div class="dl-dot" style="opacity:.35"></div><div class="dl-name" style="color:var(--light)">${t('dash_dl_loading')}</div>`;
  list.appendChild(loadingRow);

  try{
    const counts=getUserDownloadCounts();
    const order=getDownloadOrder();
    // Show in reverse order (newest first), only products with at least 1 download
    const downloadedEntries=[...order]
      .reverse()
      .filter(id => counts[String(id)] > 0)
      .map(id => ({ productId: Number(id) }))
      .slice(0,6);

    list.innerHTML='';
    if(downloadedEntries.length===0){
      const emptyRow=document.createElement('div');
      emptyRow.className='dl-row';
      emptyRow.innerHTML=`<div class="dl-dot" style="opacity:.35"></div><div class="dl-name" style="color:var(--light)">${t('dash_dl_empty')}</div>`;
      list.appendChild(emptyRow);
      return;
    }

    const products=await loadProducts(true);
    const productById=new Map(products.map(product => [Number(product.id), product]));

    downloadedEntries.forEach(entry => {
      const product=productById.get(entry.productId);
      const modelName=String(product?.name || product?.sku || `Model ${entry.productId}`).trim();
      list.appendChild(createDownloadedModelRow(modelName));
    });
  }catch(error){
    console.error('Failed to render downloaded models card:', error);
    list.innerHTML='';
    const failRow=document.createElement('div');
    failRow.className='dl-row';
    failRow.innerHTML=`<div class="dl-dot" style="opacity:.35"></div><div class="dl-name" style="color:var(--light)">${t('dash_dl_empty')}</div>`;
    list.appendChild(failRow);
  }
}

document.getElementById('proj-overlay').addEventListener('click',function(e){
  if(e.target===this) closeProjPopup();
});

const PRICE_MIN=0,PRICE_MAX=5000;
let priceMin=0,priceMax=5000,dragging=null,dragStartX=0,dragStartVal=0;

function pct(v){return(v-PRICE_MIN)/(PRICE_MAX-PRICE_MIN)*100}

function updateSlider(){
  const fill=document.getElementById('price-fill');
  const tMin=document.getElementById('thumb-min');
  const tMax=document.getElementById('thumb-max');
  if(!fill||!tMin||!tMax) return;
  const lo=pct(priceMin),hi=pct(priceMax);
  fill.style.left=lo+'%';
  fill.style.width=(hi-lo)+'%';
  tMin.style.left=lo+'%';
  tMax.style.left=hi+'%';
  document.getElementById('price-label-min').textContent=priceMin.toLocaleString('lt-LT');
  document.getElementById('price-label-max').textContent=priceMax.toLocaleString('lt-LT');
  document.getElementById('price-in-min').value=priceMin;
  document.getElementById('price-in-max').value=priceMax;
}

function startDrag(e,which){
  e.preventDefault();
  dragging=which;
  dragStartX=e.clientX;
  dragStartVal=which==='min'?priceMin:priceMax;
  document.addEventListener('mousemove',onDrag);
  document.addEventListener('mouseup',stopDrag);
}

function onDrag(e){
  if(!dragging) return;
  const wrap=document.getElementById('price-track-wrap');
  if(!wrap) return;
  const w=wrap.getBoundingClientRect().width;
  const dx=e.clientX-dragStartX;
  const dv=Math.round((dx/w)*(PRICE_MAX-PRICE_MIN)/100)*100;
  if(dragging==='min'){
    priceMin=Math.max(PRICE_MIN,Math.min(priceMax-100,dragStartVal+dv));
  } else {
    priceMax=Math.min(PRICE_MAX,Math.max(priceMin+100,dragStartVal+dv));
  }
  updateSlider();
}

function stopDrag(){
  dragging=null;
  document.removeEventListener('mousemove',onDrag);
  document.removeEventListener('mouseup',stopDrag);
}

function syncFromInput(which){
  const vMin=parseInt(document.getElementById('price-in-min').value)||0;
  const vMax=parseInt(document.getElementById('price-in-max').value)||PRICE_MAX;
  if(which==='min') priceMin=Math.max(PRICE_MIN,Math.min(priceMax-100,vMin));
  else priceMax=Math.min(PRICE_MAX,Math.max(priceMin+100,vMax));
  updateSlider();
}

function showDashNewProj(){
  document.getElementById('dash-new-proj-input').style.display='flex';
  document.getElementById('dash-proj-name').value='';
  setTimeout(()=>document.getElementById('dash-proj-name').focus(),50);
}

function hideDashNewProj(){
  document.getElementById('dash-new-proj-input').style.display='none';
}

function createDashProj(){
  const name=document.getElementById('dash-proj-name').value.trim();
  if(!name) return;
  projects.unshift({
    name:name,
    icon:getDefaultProjectIcon(projects.length),
    count:0,
    status:'Aktyvus',
    products:[],
    createdAt:Date.now(),
    finishedAt:null,
    ownerId:currentSessionUser?.id || 'designer-ak',
    ownerName:currentSessionUser?.name || 'Aušra K.'
  });
  saveProjects();
  hideDashNewProj();
  updateDashboardProjects();
}


const i18n={
  lt:{
    nav_catalog:'Katalogas', nav_account:'Mano paskyra', nav_list:'Saražas klientui',
    nav_login:'Prisijungti', nav_register:'Registruotis', nav_logout:'Atsijungti',
    acc_open_dashboard:'Atidaryti dizainerio paskyra', acc_open_supplier:'Atidaryti tiekejo paskyra', acc_logout:'Atsijungti',
    cat_title:'produktai su 3D modeliais', cat_results:'rezultatai su 3D modeliais',
    cat_all:'Visi produktai', cat_sofas:'Sofos ir foteliai', cat_chairs:'Kedes',
    cat_lights:'Apšvietimas', cat_tables:'Stalai ir lentynos', cat_textile:'Tekstile',
    cat_outdoor:'Lauko baldai', cat_megstami:'Mano megstami',
    filter_category:'Kategorija', filter_manufacturer:'Gamintojas', filter_price:'Kaina (€)',
    filter_price_from:'Nuo', filter_price_to:'Iki', filter_3d:'3D formatas',
    filter_clear:'Išvalyti filtrus', filter_sort_popular:'Populiariausi',
    filter_sort_cheap:'Kaina: mažiausia', filter_sort_expensive:'Kaina: didžiausia',
    filter_sort_new:'Naujausi', search_placeholder:'Ieškoti produktų...',
    back_catalog:'← Grįžti į katalogą',
    back_account:'← Grįžti į paskyrą',
    prod_add_project:'+ Pridėti į projektą', prod_store:'Į parduotuvę',
    prod_report:'Pranešti apie netinkamą modelį', prod_download:'Parsisiųsti',
    prod_specs:'Specifikacijos', prod_size:'Matmenys', prod_material:'Medžiaga',
    prod_delivery:'Pristatymas', prod_stock:'Sandėlyje', prod_in_stock:'Yra',
    prod_check_partner:'Žiūrėti tiekėjo nuorodą',
    unit_pcs:'vnt.',
    prod_price_partner:'Tikslią kainą rasite tiekėjo nuorodoje',
    price_updated_at:'Kaina atnaujinta',
    add_title:'Pridėti naują produktą', add_submit:'+ Pridėti produktą',
    edit_title:'Redaguoti produktą', edit_submit:'Išsaugoti pakeitimus',
    add_specs_optional:'Specifikacijos (nebūtina)',
    add_name:'Produkto pavadinimas *', add_brand:'Gamintojas', add_category:'Kategorija *',
    add_category_ph:'Pasirinkite kategorija...', add_price:'Kaina (€) *', add_sku:'SKU *',
    add_stock:'Sandėlyje (vnt.)', add_desc:'Aprašymas', add_link:'Nuoroda',
    add_photos_title:'Produkto nuotraukos', add_photos_hint:'Pirma nuotrauka bus pagrindine. Vilkite ir keiskite eile.',
    add_photos_btn:'+ Prideti nuotraukas', add_photos_limits:'JPG, PNG, WEBP • maks. 10 MB vienai nuotraukai • iki 10 nuotrauku',
    existing_photos_count:'Esamos nuotraukos',
    existing_skp:'Esamas SKP', skp_will_replace:'SKP bus pakeistas i',
    add_models_title:'3D Modeliai (atsisiuntimui) *', add_models_hint:'Bent vienas 3D modelis reikalingas. Designeriai gales atsisiusti iuos failus iš katalogo.',
    sup_col_sku:'SKU', sup_col_name:'Pavadinimas', sup_col_downloads:'Atsisiuntimai', sup_col_likes:'Patinka', sup_col_link_clicks:'Nuorodos paspaudimai',
    dash_dl_loading:'Kraunama...', dash_dl_empty:'Kol kas nera atsisiustu modeliu', dash_dl_times:'atsisiuntimai',
    dash_hello:'Sveika', dash_code:'Jusu affiliate kodas', dash_clear_data:'Išvalyti mano demo duomenis',
    dash_settings:'Paskyros nustatymai', dash_projects:'Projektai',
    dash_open:'Atidaryti saraža', dash_to_catalog:'I kataloga',
    dash_downloads:'Parsisiusti modeliai', dash_use:'Prideti',
    dash_new_project:'Naujas projektas', dash_create:'Sukurti',
    stat_projects:'Aktyvus projektai', stat_models:'Parsisiusti modeliai',
    stat_commissions:'Komisiniai i men.', stat_purchases:'Kliento pirkimai',
    sar_title:'Saražas klientui', sar_sub:'Pažymekite produktus ir sugeneruokite nuoroda',
    sar_discount_text:'Pirkdami su kodu gausite nuolaida visam užsakymui',
    sar_products:'Produktu', sar_categories:'Kategorijos', sar_your_discount:'Jusu nuolaida',
    sar_total_discount:'Viso su nuolaida', sar_total:'Viso su nuolaida (-8%)',
    sar_commissions_label:'Jusu komisiniai • 10%', sar_generate:'Generuoti nuoroda klientui',
    sar_pdf:'Atsisiusti PDF',
    proj_popup_title:'Prideti i projekta', proj_add:'Prideti', proj_new:'Naujas projektas...', proj_empty:'Dar nera projektu. Sukurkite pirma!', proj_btn_finish:'Baigti', proj_btn_activate:'Aktyvinti',
    proj_cancel:'Ataukti', proj_create:'Sukurti',proj_name_ph:'Projekto pavadinimas...',
    flag_title:'Praneti apie netinkama modeli', flag_reason1:'Modelis neatitinka realaus produkto',
    flag_reason2:'Neteisingos proporcijos / matmenys', flag_reason3:'Blogos kokybes geometrija',
    flag_reason4:'Failas neatsidaro / sugadintas', flag_reason5:'Kita',
    flag_cancel:'Ataukti', flag_send:'Siusti praneima',
    flag_placeholder:'Trumpai apražykite problema...',
    login_title:'Prisijungti', login_sub:'Sveiki sugriše i PickInDes',
    login_email:'El. pažtas', login_pass:'Slaptažodis', login_btn:'Prisijungti',
    login_demo_designer:'Prisijungti kaip dizaineris (demo)', login_demo_designer_2:'Prisijungti kaip dizaineris 2 (demo)', login_demo:'Prisijungti kaip tiekejas (demo)', login_no_acc:'Neturite paskyros?',
    login_register:'Registruotis', login_forgot:'Pamirote slaptažodi?',
    reg_title:'Sukurti paskyra', reg_sub:'Pasirinkite paskyros tipa',
    reg_designer:'Dizaineris', reg_designer_desc:'Kuriu interjerus, gaunu komisinius',
    reg_supplier:'Tiekejas', reg_supplier_desc:'Parduodu produktus, talpinu 3D',
    reg_name:'Vardas, pavarde', reg_email:'El. pažtas', reg_phone:'Telefonas',
    reg_pass:'Slaptažodis', reg_pass_hint:'Min. 8 simboliai',
    reg_btn:'Registruotis nemokamai', reg_have_acc:'Jau turite paskyra?', reg_login:'Prisijungti',
    sup_title:'Tiekejo paskyra', sup_products:'Produktai kataloge',
    sup_sales:'Pardavimai i men.', sup_downloads:'3D modeliu atsisiuntimai',
    sup_add_new:'+ Prideti nauja', sup_name:'Produktas', sup_price:'Kaina',
    sup_stock:'Sandelis', sup_3d:'3D', sup_sales_col:'Pardavimai',
    sup_edit:'Redaguoti', sup_deactivate:'Deaktyvuoti', sup_activate:'Aktyvuoti', sup_delete:'Ištrinti',
    sup_inactive:'Neaktyvus',
    sup_integration:'Duomenu integracija', sup_xml:'Produktu XML feed',
    sup_xml_sub:'Automatinis atnaujinimas kas 6h', sup_xml_status:'Aktyvus',
    sup_stock_sync:'Sandelio likuciai', sup_stock_sub:'Realaus laiko sinchronizacija',
    sup_stock_status:'Nustatyti', sup_lib:'3D modeliu biblioteka',
    sup_lib_sub:'modeliai • .SKP formatas', sup_lib_status:'Aktyvus',
    msg_deactivate_confirm:'Ar tikrai norite deaktyvuoti i produkta? Jis nebebus rodomas kataloge.',
    msg_activate_confirm:'Ar tikrai norite vel aktyvuoti i produkta kataloge?',
    msg_delete_confirm:'Ar tikrai norite visiškai ištrinti i produkta? Bus ištrintas ir iražas duomenu bazeje, ir visi io SKU failai.',
    msg_product_deactivated:'Produktas deaktyvuotas.',
    msg_product_activated:'Produktas aktyvuotas.',
    msg_product_deleted:'Produktas ištrintas.',
    msg_product_action_failed:'Nepavyko atnaujinti produkto.',
    footer_tagline:'Platforma dizaineriams ir partneriams su 3D produktu katalogu.',
    footer_col_platform:'Platforma', footer_col_partners:'Partneriams', footer_col_legal:'Teisine informacija',
    footer_link_catalog:'Katalogas', footer_link_signup:'Registracija', footer_link_supplier:'Tiekejo paskyra',
    footer_link_pricing:'Kainodara', footer_link_demo:'Demo pristatymas', footer_link_support:'Pagalba',
    footer_link_terms:'Naudojimo salygos', footer_link_privacy:'Privatumo politika', footer_link_cookies:'Slapuku politika',
    footer_copyright:' 2026 PickInDes. Visos teises saugomos.',
    footer_made:'Sukurta Milan Design Show demonstracijai.',
    discount_banner:'Pirkdami su kodu gausite nuolaida visam užsakymui. Nuolaida taikoma automatiškai.',
    your_code:'Jusu nuolaidos kodas', generated:'Sugeneruota', project_label:'Projektas',
    login_to_save:'Prisijunkite noredami išsaugoti',login_arrow:'Prisijungti',
  },
  en:{
    nav_catalog:'Catalog', nav_account:'My Account', nav_list:'Client List',
    nav_login:'Log in', nav_register:'Sign up', nav_logout:'Log out',
    acc_open_dashboard:'Open designer account', acc_open_supplier:'Open supplier account', acc_logout:'Log out',
    cat_title:'products with 3D models', cat_results:'results with 3D models',
    cat_all:'All products', cat_sofas:'Sofas & armchairs', cat_chairs:'Chairs',
    cat_lights:'Lighting', cat_tables:'Tables & shelves', cat_textile:'Textiles',
    cat_outdoor:'Outdoor furniture', cat_megstami:'My favourites',
    filter_category:'Category', filter_manufacturer:'Manufacturer', filter_price:'Price (€)',
    filter_price_from:'From', filter_price_to:'To', filter_3d:'3D format',
    filter_clear:'Clear filters', filter_sort_popular:'Most popular',
    filter_sort_cheap:'Price: lowest', filter_sort_expensive:'Price: highest',
    filter_sort_new:'Newest', search_placeholder:'Search products...',
    back_catalog:'← Back to catalog',
    back_account:'← Back to account',
    prod_add_project:'+ Add to project', prod_store:'Go to store',
    prod_report:'Report incorrect model', prod_download:'Download',
    prod_specs:'Specifications', prod_size:'Dimensions', prod_material:'Material',
    prod_delivery:'Delivery', prod_stock:'In stock', prod_in_stock:'Available',
    prod_check_partner:'Check partner link',
    unit_pcs:'pcs',
    prod_price_partner:'See exact price in partner link',
    price_updated_at:'Price updated',
    add_title:'Add new product', add_submit:'+ Add product',
    edit_title:'Edit product', edit_submit:'Save changes',
    add_specs_optional:'Specifications (optional)',
    add_name:'Product name *', add_brand:'Brand', add_category:'Category *',
    add_category_ph:'Select category...', add_price:'Price (€) *', add_sku:'SKU *',
    add_stock:'In stock (pcs)', add_desc:'Description', add_link:'Link',
    add_photos_title:'Product photos', add_photos_hint:'First photo becomes primary. Drag to reorder.',
    add_photos_btn:'+ Add photos', add_photos_limits:'JPG, PNG, WEBP • max 10 MB per photo • up to 10 photos',
    existing_photos_count:'Existing photos',
    existing_skp:'Existing SKP', skp_will_replace:'SKP will be replaced with',
    add_models_title:'3D Models (for download) *', add_models_hint:'At least one 3D model is required. Designers will be able to download these files from the catalog.',
    sup_col_sku:'SKU', sup_col_name:'Name', sup_col_downloads:'Downloads', sup_col_likes:'Likes', sup_col_link_clicks:'Link clicks',
    dash_dl_loading:'Loading...', dash_dl_empty:'No downloaded models yet', dash_dl_times:'downloads',
    dash_hello:'Hello', dash_code:'Your affiliate code', dash_clear_data:'Clear my demo data',
    dash_settings:'Account settings', dash_projects:'Projects',
    dash_open:'Open list', dash_to_catalog:'To catalog',
    dash_downloads:'Downloaded models', dash_use:'Add to project',
    dash_new_project:'New project', dash_create:'Create',
    stat_projects:'Active projects', stat_models:'Downloaded models',
    stat_commissions:'Commissions this month', stat_purchases:'Client purchases',
    sar_title:'Client list', sar_sub:'Select products and generate a link',
    sar_discount_text:'Buying with this code gives a discount on the entire order',
    sar_products:'Products', sar_categories:'Categories', sar_your_discount:'Your discount',
    sar_total_discount:'Total with discount', sar_total:'Total with discount (-8%)',
    sar_commissions_label:'Your commissions • 10%', sar_generate:'Generate client link',
    sar_pdf:'Download PDF',
    proj_popup_title:'Add to project', proj_add:'Add', proj_new:'New project...', proj_empty:'No projects yet. Create your first one!', proj_btn_finish:'Finish', proj_btn_activate:'Activate',
    proj_cancel:'Cancel', proj_create:'Create', proj_name_ph:'Project name...',
    flag_title:'Report incorrect model', flag_reason1:'Model does not match the real product',
    flag_reason2:'Wrong proportions / dimensions', flag_reason3:'Poor geometry quality',
    flag_reason4:'File won\'t open / corrupted', flag_reason5:'Other',
    flag_cancel:'Cancel', flag_send:'Send report',
    flag_placeholder:'Briefly describe the issue...',
    login_title:'Log in', login_sub:'Welcome back to PickInDes',
    login_email:'Email', login_pass:'Password', login_btn:'Log in',
    login_demo_designer:'Log in as designer (demo)', login_demo_designer_2:'Log in as designer 2 (demo)', login_demo:'Log in as supplier (demo)', login_no_acc:'Don\'t have an account?',
    login_register:'Sign up', login_forgot:'Forgot your password?',
    reg_title:'Create account', reg_sub:'Choose account type',
    reg_designer:'Designer', reg_designer_desc:'I create interiors, earn commissions',
    reg_supplier:'Supplier', reg_supplier_desc:'I sell products, upload 3D models',
    reg_name:'Full name', reg_email:'Email', reg_phone:'Phone',
    reg_pass:'Password', reg_pass_hint:'Min. 8 characters',
    reg_btn:'Sign up for free', reg_have_acc:'Already have an account?', reg_login:'Log in',
    sup_title:'Supplier account', sup_products:'Products in catalog',
    sup_sales:'Sales this month', sup_downloads:'3D model downloads',
    sup_add_new:'+ Add new', sup_name:'Product', sup_price:'Price',
    sup_stock:'Stock', sup_3d:'3D', sup_sales_col:'Sales',
    sup_edit:'Edit', sup_deactivate:'Deactivate', sup_activate:'Activate', sup_delete:'Delete',
    sup_inactive:'Inactive',
    sup_integration:'Data integration', sup_xml:'Product XML feed',
    sup_xml_sub:'Auto-update every 6h', sup_xml_status:'Active',
    sup_stock_sync:'Stock levels', sup_stock_sub:'Real-time sync',
    sup_stock_status:'Set up', sup_lib:'3D model library',
    sup_lib_sub:'models • .SKP format', sup_lib_status:'Active',
    msg_deactivate_confirm:'Deactivate this product? It will no longer appear in the catalog.',
    msg_activate_confirm:'Activate this product in the catalog again?',
    msg_delete_confirm:'Delete this product permanently? This removes the database record and all files for this SKU.',
    msg_product_deactivated:'Product deactivated.',
    msg_product_activated:'Product activated.',
    msg_product_deleted:'Product deleted.',
    msg_product_action_failed:'Failed to update product.',
    footer_tagline:'A platform for designers and partners with a downloadable 3D product catalog.',
    footer_col_platform:'Platform', footer_col_partners:'For partners', footer_col_legal:'Legal',
    footer_link_catalog:'Catalog', footer_link_signup:'Sign up', footer_link_supplier:'Supplier account',
    footer_link_pricing:'Pricing', footer_link_demo:'Demo session', footer_link_support:'Support',
    footer_link_terms:'Terms of use', footer_link_privacy:'Privacy policy', footer_link_cookies:'Cookie policy',
    footer_copyright:' 2026 PickInDes. All rights reserved.',
    footer_made:'Built for the Milan Design Show demo.',
    discount_banner:'Buying with this code gives you a discount on the entire order. Applied automatically at checkout.',
    your_code:'Your discount code', generated:'Generated', project_label:'Project',
    login_to_save:'Log in to save',login_arrow:'Log in ?',
  }
};

let lang='lt';

const categoryKeyByValue = {
  'Sofos ir foteliai': 'cat_sofas',
  'Kedes': 'cat_chairs',
  'Apšvietimas': 'cat_lights',
  'Stalai ir lentynos': 'cat_tables',
  'Tekstile': 'cat_textile',
  'Lauko baldai': 'cat_outdoor'
};

function translateCategoryLabel(category) {
  const normalized = String(category || '').trim();
  const key = categoryKeyByValue[normalized];
  return key ? t(key) : normalized;
}

function setLang(l){
  lang=l;
  document.querySelectorAll('.lang-btn').forEach(b=>{
    b.classList.toggle('active', b.textContent===l.toUpperCase());
  });
  applyLang();
}

function t(key){ return i18n[lang][key]||i18n['lt'][key]||key; }

function getSpecLabel(specKey) {
  const labelKeyBySpec = {
    dimensions: 'prod_size',
    material: 'prod_material',
    delivery: 'prod_delivery',
    stock: 'prod_stock'
  };
  const labelKey = labelKeyBySpec[specKey];
  return labelKey ? t(labelKey) : 'SKU';
}

function renderProductSpecs(product) {
  const specTitleEl = document.getElementById('spec-title');
  const specsWrap = document.getElementById('product-specs');
  if (!specsWrap) return;

  const rows = [];
  if (product.dimensions && String(product.dimensions).trim()) {
    rows.push(`<div class="spec-row"><span class="spec-label" data-spec-key="dimensions">${getSpecLabel('dimensions')}</span><span class="spec-val">${product.dimensions}</span></div>`);
  }
  if (product.material && String(product.material).trim()) {
    rows.push(`<div class="spec-row"><span class="spec-label" data-spec-key="material">${getSpecLabel('material')}</span><span class="spec-val">${product.material}</span></div>`);
  }
  if (product.delivery && String(product.delivery).trim()) {
    rows.push(`<div class="spec-row"><span class="spec-label" data-spec-key="delivery">${getSpecLabel('delivery')}</span><span class="spec-val">${product.delivery}</span></div>`);
  }

  const stockNum = Number(product.stock);
  if (Number.isFinite(stockNum) && stockNum > 0) {
    rows.push(`<div class="spec-row"><span class="spec-label" data-spec-key="stock">${getSpecLabel('stock')}</span><span class="spec-val" style="color:var(--green)">${t('prod_in_stock')} (${stockNum} ${t('unit_pcs')})</span></div>`);
  } else {
    rows.push(`<div class="spec-row"><span class="spec-label" data-spec-key="stock">${getSpecLabel('stock')}</span><span class="spec-val" style="color:var(--mid)">${t('prod_check_partner')}</span></div>`);
  }

  if (product.sku && String(product.sku).trim()) {
    rows.push(`<div class="spec-row"><span class="spec-label" data-spec-key="sku">${getSpecLabel('sku')}</span><span class="spec-val" style="font-size:12px;color:var(--light)">${product.sku}</span></div>`);
  }

  specsWrap.innerHTML = rows.join('');
  if (specTitleEl) specTitleEl.style.display = rows.length ? '' : 'none';
}

function applyLang(){
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const k=el.getAttribute('data-i18n');
    if(el.tagName==='INPUT') el.placeholder=t(k);
    else el.textContent=t(k);
  });

  const visibleCards = Array.from(document.querySelectorAll('.prod-grid .pc')).filter(card => card.style.display !== 'none').length;
  const searchQuery = (document.getElementById('si')?.value || '').trim();
  if (visibleCards > 0 || document.querySelector('.prod-grid .pc')) {
    updateCatalogCount(visibleCards, Boolean(searchQuery));
  }

  const catItems=document.querySelectorAll('#category-filter-section .fi');
  catItems.forEach(el=>{
    const count=el.querySelector('.fc');
    const countText=count?count.outerHTML:'';
    const kind = el.dataset.filterKind || '';
    if(kind==='all'){
      el.innerHTML=t('cat_all')+' '+countText;
    } else if(kind==='favorites'){
      const dot=el.querySelector('span[id="fi-megstami-dot"]');
      const dotHTML=dot?dot.outerHTML:'';
      el.innerHTML=dotHTML+t('cat_megstami')+' '+countText;
    } else if(kind==='category'){
      el.innerHTML=translateCategoryLabel(el.dataset.categoryValue || '')+' '+countText;
    }
  });

  const si=document.getElementById('si');
  if(si) si.placeholder=t('search_placeholder');

  const sortSel=document.querySelector('.sort-sel');
  if(sortSel){
    const opts=[t('filter_sort_popular'),t('filter_sort_cheap'),t('filter_sort_expensive'),t('filter_sort_new')];
    Array.from(sortSel.options).forEach((o,i)=>{ if(opts[i]) o.text=opts[i]; });
  }

  const priceTitle=document.querySelector('.filter-section .filter-title:last-of-type');
  document.querySelectorAll('.filter-title').forEach(el=>{
    const txt=el.textContent.trim();
    if(txt==='Kategorija'||txt==='Category') el.textContent=t('filter_category');
    if(txt==='Gamintojas'||txt==='Manufacturer') el.textContent=t('filter_manufacturer');
    if(txt==='Kaina (€)'||txt==='Price (€)') el.textContent=t('filter_price');
    if(txt==='3D formatas'||txt==='3D format') el.textContent=t('filter_3d');
  });

  const pFrom=document.getElementById('price-in-min');
  const pTo=document.getElementById('price-in-max');
  if(pFrom) pFrom.placeholder=t('filter_price_from');
  if(pTo) pTo.placeholder=t('filter_price_to');

  const clearBtn=document.querySelector('.clear-all');
  if(clearBtn) clearBtn.textContent=t('filter_clear');

  const prodBackBtn = document.querySelector('#produktas .back-btn');
  if (prodBackBtn) prodBackBtn.textContent = t('back_catalog');
  const addBackBtn = document.getElementById('add-back-btn');
  if (addBackBtn) addBackBtn.textContent = t('back_account');

  const addProjBtn=document.querySelector('.btn-full.btn-dark');
  if(addProjBtn) addProjBtn.textContent=t('prod_add_project');

  const storeBtns=document.querySelectorAll('.btn-full.btn-out');
  storeBtns.forEach(b=>{ if(b.textContent.includes('parduotuve')||b.textContent.includes('store')) b.textContent=t('prod_store'); });

  const reportBtn=document.querySelector('[onclick="openFlag()"]');
  if(reportBtn) reportBtn.textContent=t('prod_report');

  const dlBtn=document.querySelector('.skp-dl-btn');
  if(dlBtn) dlBtn.textContent=t('prod_download');

  const specTitle=document.querySelector('.spec-title');
  if(specTitle) specTitle.textContent=t('prod_specs');

  document.querySelectorAll('.prod-grid .pc').forEach(card => {
    const brand = card.dataset.brand || 'Nezinomas';
    const category = translateCategoryLabel(card.dataset.category || '') || 'Kategorija';
    const label = card.querySelector('.pbr');
    if (label) label.textContent = `${brand} • ${category}`;
  });

  const productCatTag = document.querySelector('.prod-cat-tag');
  if (productCatTag) {
    const brand = productCatTag.dataset.brand || 'Nezinomas';
    const category = translateCategoryLabel(productCatTag.dataset.category || '') || 'Kategorija';
    productCatTag.textContent = `${brand} • ${category}`;
  }

  const addFormTitle = document.getElementById('add-form-title');
  if (addFormTitle) addFormTitle.textContent = editingProductId ? t('edit_title') : t('add_title');
  const addFormSubmit = document.getElementById('add-form-submit');
  if (addFormSubmit) addFormSubmit.textContent = editingProductId ? t('edit_submit') : t('add_submit');
  const setTxt = (id, key) => { const el = document.getElementById(id); if (el) el.textContent = t(key); };
  setTxt('lbl-prod-name', 'add_name');
  setTxt('lbl-prod-brand', 'add_brand');
  setTxt('lbl-prod-category', 'add_category');
  setTxt('lbl-prod-price', 'add_price');
  setTxt('lbl-prod-sku', 'add_sku');
  setTxt('lbl-prod-stock', 'add_stock');
  setTxt('lbl-prod-desc', 'add_desc');
  setTxt('lbl-prod-link', 'add_link');
  setTxt('add-specs-title', 'add_specs_optional');
  setTxt('lbl-prod-dimensions', 'prod_size');
  setTxt('lbl-prod-material', 'prod_material');
  setTxt('lbl-prod-delivery', 'prod_delivery');
  setTxt('photos-section-title', 'add_photos_title');
  setTxt('photos-section-hint', 'add_photos_hint');
  setTxt('photo-add-btn', 'add_photos_btn');
  setTxt('photos-section-limits', 'add_photos_limits');
  setTxt('models-section-title', 'add_models_title');
  setTxt('models-section-hint', 'add_models_hint');
  setTxt('sup-th-sku', 'sup_col_sku');
  setTxt('sup-th-name', 'sup_col_name');
  setTxt('sup-th-downloads', 'sup_col_downloads');
  setTxt('sup-th-likes', 'sup_col_likes');
  setTxt('sup-th-link-clicks', 'sup_col_link_clicks');
  if (document.getElementById('supplier-products-tbody')) renderSupplierDashboard();

  const catPlaceholder = document.getElementById('prod-category-placeholder');
  if (catPlaceholder) catPlaceholder.textContent = t('add_category_ph');
  const catSelect = document.getElementById('prod-category');
  if (catSelect) {
    const catTextsLt = ['Sofos ir foteliai', 'Kedes', 'Apšvietimas', 'Stalai ir lentynos', 'Tekstile', 'Lauko baldai'];
    const catTextsEn = ['Sofas & armchairs', 'Chairs', 'Lighting', 'Tables & shelves', 'Textiles', 'Outdoor furniture'];
    const options = Array.from(catSelect.options).slice(1);
    options.forEach((opt, idx) => {
      opt.textContent = lang === 'en' ? catTextsEn[idx] : catTextsLt[idx];
    });
  }

  if (selectedProductData) renderProductSpecs(selectedProductData);

  const dashTitle=document.querySelector('.dash-title');
  if(dashTitle){
    const firstName=(currentSessionUser?.name || 'Aušra').split(' ')[0];
    dashTitle.textContent=t('dash_hello')+', '+firstName;
  }

  const dashCode=document.querySelector('.dash-code');
  if(dashCode) dashCode.innerHTML=t('dash_code')+': <span>AUSRA2026</span>';

  document.querySelectorAll('.stat-l').forEach((el,i)=>{
    const keys=['stat_projects','stat_models','stat_commissions','stat_purchases'];
    if(keys[i]) el.textContent=t(keys[i]);
  });

  document.querySelectorAll('.dash-card-title').forEach(el=>{
    const link=el.querySelector('span');
    if(el.textContent.includes('Projektai')||el.textContent.includes('Projects')){
      el.innerHTML=t('dash_projects')+' '+(link?`<span class="dash-card-link" onclick="go('sarasas')">${t('dash_open')}</span>`:'');
    }
    if(el.textContent.includes('Parsisiusti')||el.textContent.includes('Downloaded')){
      el.innerHTML=t('dash_downloads')+' '+(link?`<span class="dash-card-link" onclick="go('katalogas')">${t('dash_to_catalog')}</span>`:'');
    }
  });

  document.querySelectorAll('.dl-use').forEach(b=>b.textContent=t('dash_use'));
  if (document.getElementById('dash-downloaded-models-list')) renderDownloadedModelsCard();

  const sarTitle=document.querySelector('.sar-wrap .page-title');
  if(sarTitle) sarTitle.textContent=t('sar_title');
  const sarSub=document.querySelector('.sar-wrap .page-sub');
  if(sarSub) sarSub.textContent=t('sar_sub');

  const genBtn=document.querySelector('[onclick*="Generate"]')||document.querySelector('[onclick*="generuoti"]')||document.querySelectorAll('.sar-actions .btn-full')[0];
  if(genBtn) genBtn.textContent=t('sar_generate');
  const pdfBtn=document.querySelectorAll('.sar-actions .btn-full')[1];
  if(pdfBtn) pdfBtn.textContent=t('sar_pdf');

  document.querySelectorAll('.sar-sum-l').forEach((el,i)=>{
    const keys=['sar_products','sar_categories','sar_your_discount','sar_total_discount'];
    if(keys[i]) el.textContent=t(keys[i]);
  });

  const totLabel=document.querySelector('.sar-total-label');
  if(totLabel) totLabel.textContent=t('sar_total');
  const totSub=document.querySelector('.sar-total-sub');
  if(totSub) totSub.textContent=t('sar_commissions_label');

  const projPopTitle=document.querySelector('#proj-overlay [style*="font-size:16px"]');
  if(projPopTitle) projPopTitle.textContent=t('proj_popup_title');
  const projAddBtn=document.getElementById('proj-confirm-btn');
  if(projAddBtn) projAddBtn.textContent=t('proj_add');
  const projNewInput=document.getElementById('new-proj-input');
  if(projNewInput) projNewInput.placeholder=t('proj_name_ph');

  document.querySelectorAll('.flag-opt').forEach((el,i)=>{
    const keys=['flag_reason1','flag_reason2','flag_reason3','flag_reason4','flag_reason5'];
    const radio=el.querySelector('.flag-rad');
    if(radio&&keys[i]) el.innerHTML=radio.outerHTML+'<div style="font-size:13px">'+t(keys[i])+'</div>';
  });
  const flagTa=document.getElementById('flag-ta');
  if(flagTa) flagTa.placeholder=t('flag_placeholder');
  const flagSub=document.getElementById('flag-submit');
  if(flagSub) flagSub.textContent=t('flag_send');

  const loginTitle=document.querySelector('#login .form-title');
  if(loginTitle) loginTitle.textContent=t('login_title');
  const loginSub=document.querySelector('#login .form-sub');
  if(loginSub) loginSub.textContent=t('login_sub');

  const regTitle=document.querySelector('#register .form-title');
  if(regTitle) regTitle.textContent=t('reg_title');
  const regSub=document.querySelector('#register .form-sub');
  if(regSub) regSub.textContent=t('reg_sub');

  document.querySelectorAll('.role-title').forEach((el,i)=>{
    el.textContent=i===0?t('reg_designer'):t('reg_supplier');
  });
  document.querySelectorAll('.role-desc').forEach((el,i)=>{
    el.textContent=i===0?t('reg_designer_desc'):t('reg_supplier_desc');
  });

  const supTitle=document.querySelector('#tiekejo-paskyra .dash-title');
  if(supTitle) supTitle.textContent=t('sup_title');

  document.querySelectorAll('#tiekejo-paskyra .tiek-stats .stat-l').forEach((el,i)=>{
    const keys=['sup_products','sup_sales','sup_downloads'];
    if(keys[i]) el.textContent=t(keys[i]);
  });

  const intTitle=document.querySelector('#tiekejo-paskyra .dash-card:last-child .dash-card-title');
  if(intTitle) intTitle.textContent=t('sup_integration');

  document.querySelectorAll('.int-name').forEach((el,i)=>{
    const keys=['sup_xml','sup_stock_sync','sup_lib'];
    if(keys[i]) el.textContent=t(keys[i]);
  });
  document.querySelectorAll('.int-sub').forEach((el,i)=>{
    const keys=['sup_xml_sub','sup_stock_sub','sup_lib_sub'];
    if(keys[i]){
      if(i===2) el.textContent='24 '+t(keys[i]);
      else el.textContent=t(keys[i]);
    }
  });

  // Add/Edit product form i18n

  document.querySelectorAll('.price-upd[data-date]').forEach(el => {
    const d = el.dataset.date;
    if (d) el.textContent = `(${t('price_updated_at')}: ${d})`;
  });
}

setTimeout(updateDashboardProjects,50);
setTimeout(renderDownloadedModelsCard,60);
setTimeout(updateSlider,80);

// Initialize catalog on page load
setTimeout(() => {
  if (document.getElementById('katalogas').classList.contains('active')) {
    renderCatalog();
  }
}, 200);

window.addEventListener('hashchange', handleClientHashOpen);
setTimeout(handleClientHashOpen, 0);

// Deep-link: /#product=<id> opens product detail directly (used by admin panel)
function handleProductHashOpen() {
  const hash = window.location.hash || '';
  if (!hash.startsWith('#product=')) return;
  const id = parseInt(hash.slice('#product='.length), 10);
  if (!Number.isInteger(id) || id <= 0) return;
  // Wait for catalog data to be loaded before opening detail
  function tryOpen(attempts) {
    if (attempts <= 0) return;
    showProductDetail(id).catch(() => {});
  }
  // Give renderCatalog() time to finish, then open
  setTimeout(() => tryOpen(3), 400);
}
window.addEventListener('hashchange', handleProductHashOpen);
setTimeout(handleProductHashOpen, 0);

const publicApi = {
  go, goToCatalog, showProductDetail, setLang, heartNavClick, loginAs, logout, toggleAccountMenu, closeAccountMenu, doSearch, pickProduct, setKat, setMegstami,
  togCheck, clearFilters, startDrag, syncFromInput, openProjPopup, openFlag, openLightbox, closeLightbox,
  selFlag, submitFlag, showNewProjInput, hideNewProjInput, createNewProj,
  closeProjPopup, selectProj, confirmProj, showDashNewProj, hideDashNewProj, toggleProjectStatus,
  createDashProj, selRole, togSar, toggleHeart, addNewProduct, editProduct,
  toggleProductActive, deleteProduct, openProjectPage, toggleProjItem, calcProjTotal,
  openProjDetailsPopup, closeProjDetailsPopup, saveProjDetails,
  openClientListCard, copyClientListLink, generateClientListPdf, saveClientNoteFromEditor,
  goBackFromClientList, clearCurrentUserData
};
Object.assign(window, publicApi);

var catalogRendered = false;
let selectedProductId = null; // Track which product is being viewed
let selectedProductData = null;
let editingProductId = null;  // null = add mode, number = edit mode
let _skipFormReset = false;   // prevents go('add-product') from clearing editProduct pre-fill
let objPreviewCleanup = null;
let threeViewerLoadPromise = null;
let occtImportLoadPromise = null;
let _lbPaths = [];
let _lbIdx = 0;
let _lbEl = null;
let _lbKeyHandler = null;

function openLightbox(paths, startIdx = 0) {
  if (!paths || !paths.length) return;
  _lbPaths = paths;
  _lbIdx = startIdx;

  const existing = document.getElementById('lb-overlay');
  if (existing) existing.remove();

  const ol = document.createElement('div');
  ol.id = 'lb-overlay';
  ol.className = 'lb-overlay';

  const img = document.createElement('img');
  img.className = 'lb-img';
  img.id = 'lb-img';
  img.draggable = false;

  const stage = document.createElement('div');
  stage.className = 'lb-stage';
  stage.onclick = (e) => e.stopPropagation();
  stage.appendChild(img);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'lb-close';
  closeBtn.innerHTML = '&#215;';
  closeBtn.title = 'Uždaryti';
  closeBtn.onclick = (e) => { e.stopPropagation(); closeLightbox(); };

  const counter = document.createElement('div');
  counter.className = 'lb-counter';
  counter.id = 'lb-counter';

  ol.appendChild(stage);
  ol.appendChild(closeBtn);
  ol.appendChild(counter);

  if (paths.length > 1) {
    const prev = document.createElement('button');
    prev.className = 'lb-nav lb-prev';
    prev.innerHTML = '&#8249;';
    prev.onclick = (e) => { e.stopPropagation(); lbGo(-1); };

    const next = document.createElement('button');
    next.className = 'lb-nav lb-next';
    next.innerHTML = '&#8250;';
    next.onclick = (e) => { e.stopPropagation(); lbGo(1); };

    stage.appendChild(prev);
    stage.appendChild(next);
  }

  ol.onclick = () => closeLightbox();

  document.body.appendChild(ol);
  _lbEl = ol;

  _lbKeyHandler = (e) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowRight') lbGo(1);
    if (e.key === 'ArrowLeft') lbGo(-1);
  };
  document.addEventListener('keydown', _lbKeyHandler);

  lbSetImg(_lbIdx);
  requestAnimationFrame(() => ol.classList.add('lb-visible'));
}

function lbSetImg(idx) {
  const img = document.getElementById('lb-img');
  const counter = document.getElementById('lb-counter');
  if (!img) return;
  const path = _lbPaths[idx];
  img.src = `/uploads/${encodeURI(path)}`;
  img.alt = '';
  if (counter) counter.textContent = _lbPaths.length > 1 ? `${idx + 1} / ${_lbPaths.length}` : '';
}

function lbGo(dir) {
  _lbIdx = (_lbIdx + dir + _lbPaths.length) % _lbPaths.length;
  lbSetImg(_lbIdx);
}

function closeLightbox() {
  if (_lbEl) {
    _lbEl.classList.remove('lb-visible');
    setTimeout(() => { if (_lbEl) { _lbEl.remove(); _lbEl = null; } }, 200);
  }
  if (_lbKeyHandler) { document.removeEventListener('keydown', _lbKeyHandler); _lbKeyHandler = null; }
}

updateTopNavLinks();

// Product database functions
async function loadProducts(includeInactive = false) {
  try {
    const url = includeInactive
      ? '/api/products?includeInactive=1'
      : '/api/products';
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to load products');
    const products = await response.json();
    return products;
  } catch (error) {
    console.error('Error loading products:', error);
    return [];
  }
}

async function renderCatalog() {
  if (catalogRendered) return; // Prevent duplicate rendering
  catalogRendered = true;
  
  const products = await loadProducts();
  
  // Update product count
  updateCatalogCount(products.length, false);
  
  // Clear all cards so catalog reflects only backend data
  const prodGrid = document.querySelector('.prod-grid');
  if (!prodGrid) return;
  prodGrid.innerHTML = '';
  
  // Add API products
  products.forEach((product, index) => {
    const card = document.createElement('div');
    card.className = 'pc';
    card.id = `pc-api-${product.id}`;
    card.dataset.productId = String(product.id);
    card.dataset.name = product.name || '';
    card.dataset.brand = product.brand || '';
    card.dataset.category = product.category || '';
    card.dataset.modelFormats = Object.keys(product?.models && typeof product.models === 'object' ? product.models : {})
      .map(fmt => String(fmt).toUpperCase())
      .join(',');
    card.onclick = () => showProductDetail(product.id);
    
    // Get image URL (prefer MAIN, then JPG, then first available image)
    let imageUrl = 'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=400&h=400&fit=crop&q=80';
    if (product.images && typeof product.images === 'object') {
      const preferred = product.images.MAIN || product.images.JPG;
      if (preferred) {
        imageUrl = `/uploads/${encodeURI(preferred)}`;
      } else {
        const firstAvailable = Object.values(product.images)[0];
        if (firstAvailable) {
          imageUrl = `/uploads/${encodeURI(firstAvailable)}`;
        }
      }
    }
    const badgeMarkup = getModelBadgeMarkup(product);
    
    card.innerHTML = `
      <button class="heart-btn" id="hb-api-${product.id}" onclick="toggleHeart(event,${product.id})" title="Ideti i megstamiausius"></button>
      <div class="pi" style="background:#f5f5f5;overflow:hidden;position:relative">
        <img src="${imageUrl}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;display:block;background:#f5f5f5">
        ${badgeMarkup}
      </div>
      <div class="pb">
        <div class="pbr">${product.brand || 'Nezinomas'} • ${translateCategoryLabel(product.category || '') || 'Kategorija'}</div>
        <div class="pnm">${product.name}</div>
        <div class="pb-bottom">
          <div class="ppr">${product.price
            ? `${product.price_from ? '<span class="price-from-prefix">nuo</span>' : ''}€ ` + product.price.toLocaleString('lt-LT')
            : (product.link
              ? `<a href="${product.link}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:var(--light);text-decoration:none;border-bottom:0.5px solid var(--border2)" onclick="event.stopPropagation();trackPartnerLinkClick(${product.id})">${t('prod_check_partner')}</a>`
              : '<span style="font-size:11px;color:var(--light)">' + t('prod_check_partner') + '</span>')}
          </div>
        </div>
        ${product.price && product.price_updated_at ? `<div class="price-upd" data-date="${product.price_updated_at.slice(0,10)}">(${t('price_updated_at')}: ${product.price_updated_at.slice(0,10)})</div>` : ''}
      </div>
    `;
    
    prodGrid.appendChild(card);

    const heartBtn = card.querySelector('.heart-btn');
    if (heartBtn && liked.has(product.id)) {
      heartBtn.classList.add('liked');
    }
  });
  
  // Update global product database for filtering
  window.apiProducts = products;

  // Rebuild filters from API dataset
  rebuildCategoryFilter(products);
  updateBrandFilter(products);
  applyCatalogFilters();
}

function rebuildCategoryFilter(products) {
  const categorySection = document.getElementById('category-filter-section');
  if (!categorySection) return;

  const categoryCounts = new Map();
  products.forEach(p => {
    const cat = (p.category || 'Be kategorijos').trim();
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  });

  const activeItem = categorySection.querySelector('.fi.on');
  const activeKind = activeItem?.dataset.filterKind || 'all';
  const activeCategoryValue = activeItem?.dataset.categoryValue || '';

  const allItem = `<div class="fi on" data-filter-kind="all" onclick="setKat(this)">${t('cat_all')} <span class="fc">${products.length}</span></div>`;
  const favItem = `<div class="fi" id="fi-megstami" data-filter-kind="favorites" onclick="setMegstami(this)" style="color:var(--dark);gap:8px;display:${isLoggedIn ? 'flex' : 'none'}"><span id="fi-megstami-dot" style="width:14px;height:14px;border-radius:50%;background:#fff;border:1.5px solid #1d1d1f;display:inline-block;flex-shrink:0"></span>${t('cat_megstami')} <span class="fc" id="fc-megstami">${liked.size}</span></div>`;
  const catItems = Array.from(categoryCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cat, count]) => `<div class="fi" data-filter-kind="category" data-category-value="${cat}" onclick="setKat(this)">${translateCategoryLabel(cat)} <span class="fc">${count}</span></div>`)
    .join('');

  const titleHtml = `<div class="filter-title">${t('filter_category')}</div>`;
  categorySection.innerHTML = `${titleHtml}${allItem}${favItem}${catItems}`;

  const categoryItems = categorySection.querySelectorAll('.fi');
  categoryItems.forEach(item => {
    const itemKind = item.dataset.filterKind || '';
    const itemCategoryValue = item.dataset.categoryValue || '';
    if (itemKind === activeKind && itemCategoryValue === activeCategoryValue) {
      categorySection.querySelectorAll('.fi').forEach(i => i.classList.remove('on'));
      item.classList.add('on');
    }
  });

  updateMegstamiDot();
}

async function loadThreeObjViewer() {
  if (!threeViewerLoadPromise) {
    threeViewerLoadPromise = Promise.all([
      import('https://esm.sh/three@0.160.0'),
      import('https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js'),
      import('https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js'),
      import('https://esm.sh/three@0.160.0/examples/jsm/loaders/MTLLoader.js')
    ]).then(([threeMod, controlsMod, objMod, mtlMod]) => ({
      THREE: threeMod,
      OrbitControls: controlsMod.OrbitControls,
      OBJLoader: objMod.OBJLoader,
      MTLLoader: mtlMod.MTLLoader
    }));
  }
  return threeViewerLoadPromise;
}

async function loadOcctImportJs() {
  if (!occtImportLoadPromise) {
    occtImportLoadPromise = new Promise((resolve, reject) => {
      if (typeof window.occtimportjs === 'function') {
        window.occtimportjs().then(resolve).catch(reject);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/occt-import-js.js';
      script.async = true;
      script.onload = () => {
        if (typeof window.occtimportjs !== 'function') {
          reject(new Error('occt-import-js did not initialize'));
          return;
        }
        window.occtimportjs().then(resolve).catch(reject);
      };
      script.onerror = () => reject(new Error('Failed to load occt-import-js runtime'));
      document.head.appendChild(script);
    });
  }
  return occtImportLoadPromise;
}

function disposeObjPreview() {
  if (typeof objPreviewCleanup === 'function') {
    objPreviewCleanup();
  }
  objPreviewCleanup = null;
}

function mtlHasTextureMaps(mtlText) {
  const text = String(mtlText || '');
  return /(^|\s)map_[a-z0-9_]+\s+/im.test(text);
}

function applyNeutralMaterialSet(THREE, rootObject) {
  if (!rootObject) return;
  rootObject.traverse(node => {
    if (!node || !node.isMesh) return;
    node.material = new THREE.MeshStandardMaterial({
      color: 0xf2f2f0,
      roughness: 0.74,
      metalness: 0.02
    });
    if (node.geometry && !node.geometry.attributes?.normal) {
      node.geometry.computeVertexNormals();
    }
  });
}

function createStepObjectFromResult(THREE, stepResult) {
  if (!stepResult) return null;
  if (stepResult.isObject3D) return stepResult;
  if (stepResult.object?.isObject3D) return stepResult.object;
  if (stepResult.scene?.isObject3D) return stepResult.scene;

  if (stepResult.geometry) {
    return new THREE.Mesh(
      stepResult.geometry,
      new THREE.MeshStandardMaterial({ color: 0xd2d6dc, roughness: 0.72, metalness: 0.04 })
    );
  }

  if (Array.isArray(stepResult)) {
    const group = new THREE.Group();
    stepResult.forEach(part => {
      if (part?.isObject3D) {
        group.add(part);
        return;
      }
      if (!part?.geometry) return;
      const mesh = new THREE.Mesh(
        part.geometry,
        new THREE.MeshStandardMaterial({ color: 0xd2d6dc, roughness: 0.72, metalness: 0.04 })
      );
      group.add(mesh);
    });
    return group.children.length ? group : null;
  }

  return null;
}

function createThreeObjectFromOcctStepResult(THREE, result) {
  if (!result || result.success !== true || !Array.isArray(result.meshes)) return null;

  const group = new THREE.Group();

  result.meshes.forEach(meshData => {
    const positionArray = meshData?.attributes?.position?.array;
    if (!Array.isArray(positionArray) || positionArray.length < 3) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positionArray, 3));

    const normalArray = meshData?.attributes?.normal?.array;
    if (Array.isArray(normalArray) && normalArray.length >= 3) {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normalArray, 3));
    } else {
      geometry.computeVertexNormals();
    }

    const indexArray = meshData?.index?.array;
    if (Array.isArray(indexArray) && indexArray.length >= 3) {
      geometry.setIndex(indexArray);
    }

    let color = 0xd2d6dc;
    if (Array.isArray(meshData?.color) && meshData.color.length >= 3) {
      const [r, g, b] = meshData.color;
      if ([r, g, b].every(v => typeof v === 'number')) {
        const rr = r > 1 ? r / 255 : r;
        const gg = g > 1 ? g / 255 : g;
        const bb = b > 1 ? b / 255 : b;
        color = new THREE.Color(rr, gg, bb);
      }
    }

    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.04 });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
  });

  return group.children.length ? group : null;
}

function getAvailableModelFormats(product) {
  const models = product?.models && typeof product.models === 'object' ? product.models : {};
  const order = ['SKP', 'OBJ', 'MTL', 'STEP', '3DS', 'DWG'];
  return order.filter(fmt => Boolean(models[fmt]));
}

function getModelBadgeText(product) {
  const formats = getAvailableModelFormats(product);
  if (!formats.length) return '3D';
  return formats.map(fmt => `.${fmt}`).join(' • ');
}

function getModelBadgeMarkup(product) {
  const formats = getAvailableModelFormats(product);
  if (!formats.length) {
    return '<div class="model-badge-stack"><span class="skp-b">3D</span></div>';
  }
  return `<div class="model-badge-stack">${formats.map(fmt => `<span class="skp-b">.${fmt}</span>`).join('')}</div>`;
}

function updateModelDownloadSection(product) {
  const skpBox = document.querySelector('.skp-dl-box');
  if (!skpBox) return;

  const models = product?.models && typeof product.models === 'object' ? product.models : {};
  const formatOrder = ['SKP', 'OBJ', 'MTL', 'STEP', '3DS', 'DWG'];
  const availableFormats = formatOrder.filter(fmt => Boolean(models[fmt]));

  if (!availableFormats.length) {
    skpBox.innerHTML = `
      <div class="skp-icon-box">3D</div>
      <div class="skp-dl-info">
        <div class="skp-dl-name">3D modelio nėra</div>
        <div class="skp-dl-sub">Pridėkite bent vieną failą tiekėjo paskyroje</div>
      </div>
    `;
    return;
  }

  skpBox.innerHTML = `<div class="model-dl-list"></div>`;
  const list = skpBox.querySelector('.model-dl-list');
  if (!list) return;

  availableFormats.forEach(format => {
    const filePath = models[format];
    const fileName = getDisplayModelFileName(product, filePath, format.toLowerCase());
    const row = document.createElement('div');
    row.className = 'model-dl-row';
    row.innerHTML = `
      <div class="skp-icon-box">.${format}</div>
      <div class="skp-dl-info">
        <div class="skp-dl-name">${fileName}</div>
        <div class="skp-dl-sub">${format} • ${product.name}</div>
      </div>
      <a href="/api/products/${product.id}/download/${format.toLowerCase()}" class="skp-dl-btn" style="text-decoration:none;display:flex;align-items:center;justify-content:center">${t('prod_download')}</a>
    `;

    const downloadBtn = row.querySelector('.skp-dl-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', (e) => {
        if (!isLoggedIn) {
          e.preventDefault();
          showLoginToast();
          return;
        }
        trackUserModelDownload(product.id);
      });
    }

    list.appendChild(row);
  });
}

function initLazy3DPreview(product) {
  const previewWrap = document.getElementById('obj-preview-wrap');
  if (!previewWrap) return;
  
  const formats = getAvailableModelFormats(product);
  if (!formats.length) {
    previewWrap.style.display = 'none';
    return;
  }
  
  previewWrap.style.display = 'block';
  previewWrap.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:260px;gap:12px">
      <div style="font-size:32px">3D</div>
      <button id="load-preview-btn" class="btn-full btn-dark" style="margin-top:0;max-width:200px">Užkrauti peržiūrą</button>
    </div>
  `;
  
  const btn = document.getElementById('load-preview-btn');
  if (btn) {
    btn.onclick = (e) => {
      e.preventDefault();
      renderObjPreview(product);
    };
  }
}

async function renderObjPreview(product) {
  const previewWrap = document.getElementById('obj-preview-wrap');
  if (!previewWrap) return;

  disposeObjPreview();
  previewWrap.style.display = 'block';
  previewWrap.innerHTML = `
    <div class="obj-preview-head">3D peržiūra</div>
    <div id="obj-preview-canvas" class="obj-preview-canvas"></div>
  `;

  const canvasHost = document.getElementById('obj-preview-canvas');
  if (!canvasHost) return;

  const objPath = product?.models?.OBJ;
  const stepPath = product?.models?.STEP;
  if (!objPath && !stepPath) return;

  previewWrap.style.display = 'block';

  try {
    const { THREE, OrbitControls, OBJLoader, MTLLoader } = await loadThreeObjViewer();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf2f2f5);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
    camera.position.set(3.2, 2.2, 3.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    canvasHost.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xc7ccd3, 0.85);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(6, 9, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.45);
    fill.position.set(-5, 4, -5);
    scene.add(fill);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.5, 0);

    let loadedObject = null;
    let shouldUseNeutralFallback = false;

    if (objPath) {
      try {
        const mtlPath = product?.models?.MTL;
        if (mtlPath) {
          try {
            const mtlUrl = `/uploads/${encodeURI(mtlPath)}`;
            const slashIdx = mtlUrl.lastIndexOf('/');
            const resourcePath = slashIdx >= 0 ? `${mtlUrl.slice(0, slashIdx + 1)}` : '/uploads/';

            try {
              const mtlRaw = await fetch(mtlUrl).then(r => r.ok ? r.text() : '');
              if (!mtlHasTextureMaps(mtlRaw)) {
                // Many manufacturer MTL files contain only placeholder wire colors.
                // When there are no texture maps, use neutral fallback for photo-like preview.
                shouldUseNeutralFallback = true;
              }
            } catch {}

            const mtlLoader = new MTLLoader();
            mtlLoader.setResourcePath(resourcePath);
            const materials = await mtlLoader.loadAsync(mtlUrl);
            materials.preload();

            const loader = new OBJLoader();
            loader.setMaterials(materials);
            loadedObject = await loader.loadAsync(`/uploads/${encodeURI(objPath)}`);
          } catch (mtlError) {
            console.warn('MTL load failed, falling back to OBJ-only preview:', mtlError);
          }
        }

        if (!loadedObject) {
          const loader = new OBJLoader();
          loadedObject = await loader.loadAsync(`/uploads/${encodeURI(objPath)}`);

          // Keep generic fallback material only when MTL/materials are not available.
          loadedObject.traverse(node => {
            if (!node || !node.isMesh) return;
            if (!node.material) {
              node.material = new THREE.MeshStandardMaterial({ color: 0xd2d6dc, roughness: 0.72, metalness: 0.04 });
            }
            if (node.geometry && !node.geometry.attributes?.normal) {
              node.geometry.computeVertexNormals();
            }
          });
        }
      } catch (objError) {
        console.warn('OBJ preview failed, trying STEP fallback if available:', objError);
        loadedObject = null;
      }
    }

    if (!loadedObject && stepPath) {
      const response = await fetch(`/uploads/${encodeURI(stepPath)}`);
      if (!response.ok) {
        throw new Error(`STEP file request failed (${response.status})`);
      }

      const fileBuffer = new Uint8Array(await response.arrayBuffer());
      const occt = await loadOcctImportJs();
      const stepResult = occt.ReadStepFile(fileBuffer, null);

      loadedObject = createThreeObjectFromOcctStepResult(THREE, stepResult)
        || createStepObjectFromResult(THREE, stepResult);

      if (!loadedObject) {
        throw new Error('Could not parse STEP model');
      }
    }

    if (!loadedObject) {
      throw new Error('No previewable 3D model could be loaded');
    }

    if (shouldUseNeutralFallback) {
      applyNeutralMaterialSet(THREE, loadedObject);
    }

    scene.add(loadedObject);

    const box = new THREE.Box3().setFromObject(loadedObject);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    loadedObject.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.2 / maxDim;
    loadedObject.scale.setScalar(scale);

    const resizedBox = new THREE.Box3().setFromObject(loadedObject);
    const resizedCenter = new THREE.Vector3();
    resizedBox.getCenter(resizedCenter);
    loadedObject.position.sub(resizedCenter);

    const fitCamera = () => {
      const w = Math.max(10, canvasHost.clientWidth || 320);
      const h = Math.max(10, canvasHost.clientHeight || 260);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    fitCamera();
    const resizeObserver = new ResizeObserver(fitCamera);
    resizeObserver.observe(canvasHost);

    let rafId = 0;
    const animate = () => {
      rafId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    objPreviewCleanup = () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.dispose();
      scene.traverse(obj => {
        if (!obj.isMesh) return;
        if (obj.geometry) obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m?.dispose?.());
        else obj.material?.dispose?.();
      });
      renderer.dispose();
      canvasHost.innerHTML = '';
    };
  } catch (error) {
    console.error('3D preview failed:', error);
    previewWrap.style.display = 'block';
    const reason = (error && error.message) ? String(error.message) : 'Neinoma klaida';
    canvasHost.innerHTML = `<div style="height:100%;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--mid);text-align:center;padding:14px">Nepavyko užkrauti 3D periuros.<br>${reason.slice(0, 120)}</div>`;
  }
}

async function showProductDetail(productId) {
  disposeObjPreview();
  selectedProductId = productId;
  const products = await loadProducts(true);
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    console.error('Product not found:', productId);
    return;
  }
  selectedProductData = product;
  
  // Update product detail page with real data
  const catTag = document.querySelector('.prod-cat-tag');
  const h1 = document.querySelector('.prod-h1');
  const brandTag = document.querySelector('.prod-brand-tag');
  const priceEl = document.querySelector('.prod-price');
  
  if (catTag) {
    catTag.dataset.brand = product.brand || '';
    catTag.dataset.category = product.category || '';
    catTag.textContent = `${product.brand || 'Nežinomas'} • ${translateCategoryLabel(product.category || '') || 'Kategorija'}`;
  }
  if (h1) h1.textContent = product.name;
  if (brandTag) brandTag.textContent = product.description || 'Produkto aprašymas';
  if (priceEl) {
    // Clear and rebuild price content with date span inside
    priceEl.innerHTML = '';
    if (product.price) {
      if (product.price_from) {
        const fromEl = document.createElement('span');
        fromEl.className = 'price-from-prefix';
        fromEl.textContent = 'nuo';
        priceEl.appendChild(fromEl);
      }
      priceEl.appendChild(document.createTextNode(`€ ${product.price.toLocaleString('lt-LT')}`))
      priceEl.style.removeProperty('font-size');
      priceEl.style.removeProperty('color');
    } else {
      priceEl.appendChild(document.createTextNode(t('prod_price_partner')));
      priceEl.style.fontSize = '13px';
      priceEl.style.color = 'var(--mid)';
    }
    if (product.price && product.price_updated_at) {
      const dateStr = product.price_updated_at.slice(0, 10);
      const priceUpdEl = document.createElement('span');
      priceUpdEl.className = 'price-upd';
      priceUpdEl.dataset.date = dateStr;
      priceUpdEl.textContent = `(${t('price_updated_at')}: ${dateStr})`;
      priceEl.appendChild(priceUpdEl);
    }
  }

  // Update store link button
  const storeBtn = document.querySelector('.btn-full.btn-out');
  if (storeBtn) {
    if (product.link) {
      storeBtn.onclick = () => {
        trackPartnerLinkClick(product.id);
        window.open(product.link, '_blank', 'noopener,noreferrer');
      };
      storeBtn.style.opacity = '1';
      storeBtn.style.pointerEvents = 'auto';
    } else {
      storeBtn.onclick = null;
      storeBtn.style.opacity = '0.55';
      storeBtn.style.pointerEvents = 'none';
    }
  }
  
  renderProductSpecs(product);

  // Update product gallery images
  const galleryMain = document.querySelector('.prod-gallery-main');
  const thumbsWrap = document.querySelector('.prod-thumbs');
  const badgeMarkup = getModelBadgeMarkup(product);
  const renderEmptyProductGallery = () => {
    if (galleryMain) {
      galleryMain.innerHTML = `<span style="font-size:72px">?</span>${badgeMarkup}`;
    }
    if (thumbsWrap) {
      thumbsWrap.innerHTML = '';
    }
  };

  if (galleryMain && product.images && typeof product.images === 'object') {
    const orderedKeys = Object.keys(product.images).sort((a, b) => {
      if (a === 'MAIN') return -1;
      if (b === 'MAIN') return 1;
      if (a === 'JPG') return -1;
      if (b === 'JPG') return 1;
      return a.localeCompare(b);
    });
    const imagePaths = orderedKeys.map(k => product.images[k]).filter(Boolean);

    if (imagePaths.length > 0) {
      const renderDetailMainImage = (imgPath, currentIdx) => {
        const src = `/uploads/${encodeURI(imgPath)}`;
        galleryMain.innerHTML = `
          <img src="${src}" alt="${product.name}" style="width:100%;height:100%;object-fit:contain;display:block;cursor:zoom-in;background:#f5f5f5" draggable="false" oncontextmenu="return false" onclick="openLightbox(_lbDetailPaths,${currentIdx})">
          ${badgeMarkup}
        `;
      };

      window._lbDetailPaths = imagePaths;
      renderDetailMainImage(imagePaths[0], 0);

      if (thumbsWrap) {
        thumbsWrap.innerHTML = '';
        imagePaths.slice(0, 6).forEach((imgPath, idx) => {
          const thumb = document.createElement('div');
          thumb.className = `prod-thumb${idx === 0 ? ' active' : ''}`;
          thumb.style.backgroundImage = `url("/uploads/${encodeURI(imgPath)}")`;
          thumb.style.backgroundSize = 'cover';
          thumb.style.backgroundPosition = 'center';
          thumb.onclick = () => {
            renderDetailMainImage(imgPath, idx);
            document.querySelectorAll('.prod-thumb').forEach(t => t.classList.remove('active'));
            thumb.classList.add('active');
          };
          thumbsWrap.appendChild(thumb);
        });
      }
    } else {
      renderEmptyProductGallery();
    }
  } else {
    renderEmptyProductGallery();
  }
  
  updateModelDownloadSection(product);
  
  // Initialize lazy-loaded 3D preview with button
  initLazy3DPreview(product);
  
  go('produktas');
}

function updateBrandFilter(products) {
  // Get the manufacturer filter section
  const manufacturerSection = document.getElementById('brand-filter-section');
  if (!manufacturerSection) return;

  const brands = Array.from(new Set(products.map(p => (p.brand || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const checkedBrands = new Set(
    Array.from(manufacturerSection.querySelectorAll('.fi.checked')).map(el =>
      el.textContent.replace('✓', '').trim()
    )
  );

  manufacturerSection.innerHTML = `<div class="filter-title">${t('filter_manufacturer')}</div>`;
  brands.forEach(brand => {
    const brandEl = document.createElement('div');
    brandEl.className = `fi${checkedBrands.has(brand) ? ' checked' : ''}`;
    brandEl.onclick = function() { togCheck(this); };
    brandEl.innerHTML = `<span class="fcheck">${checkedBrands.has(brand) ? '✓' : ''}</span>${brand}`;
    manufacturerSection.appendChild(brandEl);
  });
}

// Call renderCatalog when navigating to katalogas
function goToCatalog() {
  catalogRendered = false; // Reset flag to allow re-rendering
  go('katalogas');
  setTimeout(renderCatalog, 100); // Small delay to ensure page transition
}

// -- Photo gallery state --------------------------------------
const MAX_PHOTOS = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_MB = 10;
// ordered array of photo items: { kind:'new', file: File } or { kind:'existing', path: string }
let photoFiles = [];
let dragSrcIndex = null;

function getOrderedImagePaths(imagesObj) {
  if (!imagesObj || typeof imagesObj !== 'object') return [];
  const orderedKeys = Object.keys(imagesObj).sort((a, b) => {
    if (a === 'MAIN') return -1;
    if (b === 'MAIN') return 1;
    if (a === 'JPG') return -1;
    if (b === 'JPG') return 1;
    return a.localeCompare(b);
  });
  return orderedKeys.map(k => imagesObj[k]).filter(Boolean);
}

function getDisplayModelFileName(product, filePath, fallbackFormat = 'skp') {
  const sku = String(product?.sku || '').trim();
  const ext = pathExtFromFile(filePath) || `.${fallbackFormat}`;
  return `${sku || 'model'}${ext}`;
}

function pathExtFromFile(filePath) {
  const value = String(filePath || '').trim();
  const match = value.match(/(\.[a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '';
}

function applyContainBorderInwardFade(imgEl, containerEl) {
  if (!imgEl || !containerEl || !imgEl.naturalWidth || !imgEl.naturalHeight) return;

  const cw = containerEl.clientWidth;
  const ch = containerEl.clientHeight;
  if (!cw || !ch) return;

  const imageRatio = imgEl.naturalWidth / imgEl.naturalHeight;
  const boxRatio = cw / ch;

  let renderedW;
  let renderedH;
  if (imageRatio > boxRatio) {
    renderedW = cw;
    renderedH = cw / imageRatio;
  } else {
    renderedH = ch;
    renderedW = ch * imageRatio;
  }

  const barX = Math.max(0, (cw - renderedW) / 2);
  const barY = Math.max(0, (ch - renderedH) / 2);
  const pctX = (barX / cw) * 100;
  const pctY = (barY / ch) * 100;

  if (pctX < 0.6 && pctY < 0.6) {
    imgEl.style.webkitMaskImage = 'none';
    imgEl.style.maskImage = 'none';
    return;
  }

  if (pctY >= pctX) {
    const edge = pctY;
    const depth = Math.max(0.8, Math.min(2.4, edge * 0.4));
    const edge2 = 100 - edge;
    const midA = Math.min(100, edge + depth);
    const midB = Math.max(0, edge2 - depth);
    const mask = `linear-gradient(to bottom,
      rgba(0,0,0,0) 0%,
      rgba(0,0,0,0) ${edge}%,
      rgba(0,0,0,1) ${midA}%,
      rgba(0,0,0,1) ${midB}%,
      rgba(0,0,0,0) ${edge2}%,
      rgba(0,0,0,0) 100%)`;
    imgEl.style.webkitMaskImage = mask;
    imgEl.style.maskImage = mask;
  } else {
    const edge = pctX;
    const depth = Math.max(0.8, Math.min(2.4, edge * 0.4));
    const edge2 = 100 - edge;
    const midA = Math.min(100, edge + depth);
    const midB = Math.max(0, edge2 - depth);
    const mask = `linear-gradient(to right,
      rgba(0,0,0,0) 0%,
      rgba(0,0,0,0) ${edge}%,
      rgba(0,0,0,1) ${midA}%,
      rgba(0,0,0,1) ${midB}%,
      rgba(0,0,0,0) ${edge2}%,
      rgba(0,0,0,0) 100%)`;
    imgEl.style.webkitMaskImage = mask;
    imgEl.style.maskImage = mask;
  }

  imgEl.style.webkitMaskRepeat = 'no-repeat';
  imgEl.style.maskRepeat = 'no-repeat';
  imgEl.style.webkitMaskSize = '100% 100%';
  imgEl.style.maskSize = '100% 100%';
  imgEl.style.webkitMaskPosition = 'center';
  imgEl.style.maskPosition = 'center';
}

function renderPhotoGrid() {
  const grid = document.getElementById('photo-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const slotCount = Math.max(3, photoFiles.length + (photoFiles.length < MAX_PHOTOS ? 1 : 0));

  for (let i = 0; i < slotCount; i++) {
    const isAdd = i >= photoFiles.length;
    const cell = document.createElement('div');
    cell.style.cssText = `position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;cursor:${isAdd ? 'pointer' : 'grab'};user-select:none`;

    if (isAdd) {
      // "+" add slot
      cell.style.cssText += ';border:1.5px dashed var(--border2);background:var(--bg3,#f0f0f0);display:flex;align-items:center;justify-content:center';
      cell.innerHTML = '<span style="font-size:26px;color:var(--light);line-height:1">+</span>';
      cell.onclick = () => { const inp = document.getElementById('photo-file-input'); if (inp) inp.click(); };
      // drag-over highlight
      cell.addEventListener('dragover', e => { e.preventDefault(); cell.style.background = '#e2e2e2'; });
      cell.addEventListener('dragleave', () => { cell.style.background = 'var(--bg3,#f0f0f0)'; });
      cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.style.background = 'var(--bg3,#f0f0f0)';
        handlePhotoFiles(e.dataTransfer.files);
      });
    } else {
      // Photo slot
      const item = photoFiles[i];
      const url = item.kind === 'new'
        ? URL.createObjectURL(item.file)
        : `/uploads/${encodeURI(item.path)}`;
      cell.style.cssText += ';background:#f0f0f0';
      cell.draggable = true;
      cell.dataset.index = i;

      const img = document.createElement('img');
      img.src = url;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none';
      cell.appendChild(img);

      // Primary badge on first photo
      if (i === 0) {
        const badge = document.createElement('div');
        badge.textContent = 'Pagrindine';
        badge.style.cssText = 'position:absolute;bottom:6px;left:6px;background:rgba(0,0,0,0.6);color:#fff;font-size:10px;padding:2px 7px;border-radius:20px;font-family:Inter,sans-serif;pointer-events:none';
        cell.appendChild(badge);
      }

      // Remove button
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.innerHTML = '?';
      rm.style.cssText = 'position:absolute;top:5px;right:5px;width:22px;height:22px;border-radius:50%;border:none;background:rgba(0,0,0,0.55);color:#fff;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;z-index:2';
      rm.onclick = (e) => { e.stopPropagation(); removePhoto(i); };
      cell.appendChild(rm);

      // Drag reorder
      cell.addEventListener('dragstart', () => { dragSrcIndex = i; setTimeout(() => cell.style.opacity = '.4', 0); });
      cell.addEventListener('dragend', () => { cell.style.opacity = '1'; dragSrcIndex = null; });
      cell.addEventListener('dragover', e => { e.preventDefault(); cell.style.outline = '2px solid var(--dark)'; });
      cell.addEventListener('dragleave', () => { cell.style.outline = 'none'; });
      cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.style.outline = 'none';
        if (dragSrcIndex !== null && dragSrcIndex !== i) {
          const moved = photoFiles.splice(dragSrcIndex, 1)[0];
          photoFiles.splice(i, 0, moved);
          renderPhotoGrid();
          updatePhotoCount();
        }
      });
    }

    grid.appendChild(cell);
  }
}

function handlePhotoFiles(files) {
  const remaining = MAX_PHOTOS - photoFiles.length;
  const arr = Array.from(files).slice(0, remaining);
  const errors = [];
  arr.forEach(f => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      errors.push(`"${f.name}" • netinkamas formatas`);
      return;
    }
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      errors.push(`"${f.name}" • per didelis (maks. ${MAX_FILE_SIZE_MB} MB)`);
      return;
    }
    photoFiles.push({ kind: 'new', file: f });
  });
  if (errors.length) showErrorToast(errors[0]);
  renderPhotoGrid();
  updatePhotoCount();
  // reset file input so same file can be re-added after removal
  const inp = document.getElementById('photo-file-input');
  if (inp) inp.value = '';
}

function removePhoto(index) {
  photoFiles.splice(index, 1);
  renderPhotoGrid();
  updatePhotoCount();
}

function updatePhotoCount() {
  const lbl = document.getElementById('photo-count-label');
  if (lbl) lbl.textContent = `${photoFiles.length} / ${MAX_PHOTOS}`;
}

function resetPhotoGallery() {
  photoFiles = [];
  dragSrcIndex = null;
  renderPhotoGrid();
  updatePhotoCount();
  const existingPhotosLabel = document.getElementById('existing-photos-label');
  if (existingPhotosLabel) {
    existingPhotosLabel.style.display = 'none';
    existingPhotosLabel.textContent = '';
  }
  const existingModelLabel = document.getElementById('existing-model-label');
  if (existingModelLabel) {
    existingModelLabel.style.display = 'none';
    existingModelLabel.textContent = '';
  }
}

// Initialise grid when add-product page becomes visible
const _origGo = typeof go === 'function' ? go : null;
document.addEventListener('DOMContentLoaded', () => {
  renderPhotoGrid();
  updatePhotoCount();
  // Block right-click save on all images site-wide
  document.addEventListener('contextmenu', (e) => {
    if (e.target.tagName === 'IMG') e.preventDefault();
  });
});

// -- Product form submission ----------------------------------
async function addNewProduct(e) {
  e.preventDefault();

  const sku = document.getElementById('prod-sku').value.trim();
  if (!sku) { showErrorToast('SKU butinas! Pražom užpildyti.'); return; }

  const priceVal = parseFloat(document.getElementById('prod-price').value);
  if (!priceVal || priceVal <= 0) { showErrorToast('Kaina yra būtina! Prašom įrašyti kainą.'); return; }

  const category = document.getElementById('prod-category').value;
  if (!category) { showErrorToast('Pasirinkite kategorija!'); return; }

  const skpFile = document.getElementById('model-skp').files[0];
  const objFile = document.getElementById('model-obj').files[0];
  const mtlFile = document.getElementById('model-mtl').files[0];
  const threedsFile = document.getElementById('model-3ds').files[0];
  const stepFile = document.getElementById('model-step')?.files?.[0] || null;
  const dwgFile = document.getElementById('model-dwg')?.files?.[0] || null;
  const archiveFile = document.getElementById('model-archive')?.files?.[0] || null;
  const textureFiles = Array.from(document.getElementById('model-textures')?.files || []);
  if (!editingProductId && !skpFile && !objFile && !threedsFile && !stepFile && !dwgFile && !archiveFile) {
    showErrorToast('Bent vienas 3D modelis reikalingas!');
    return;
  }
  if (!editingProductId && mtlFile && !objFile && !archiveFile) {
    showErrorToast('MTL failui reikalingas ir OBJ failas.');
    return;
  }

  // -- EDIT MODE (PATCH) --------------------------------------
  if (editingProductId) {
    try {
      const editData = new FormData();
      editData.append('name', document.getElementById('prod-name').value);
      editData.append('brand', document.getElementById('prod-brand').value);
      editData.append('category', category);
      editData.append('price', document.getElementById('prod-price').value || '');
      editData.append('price_from', document.getElementById('prod-price-from')?.checked ? '1' : '0');
      editData.append('description', document.getElementById('prod-desc').value);
      editData.append('dimensions', document.getElementById('prod-dimensions').value || '');
      editData.append('material', document.getElementById('prod-material').value || '');
      editData.append('delivery', document.getElementById('prod-delivery').value || '');
      editData.append('link', document.getElementById('prod-link').value.trim());
      editData.append('sku', sku);
      editData.append('stock', document.getElementById('prod-stock').value || '0');

      // Preserve user ordering and mix of existing/new photos.
      const photoOrder = [];
      let newIdx = 0;
      photoFiles.forEach(item => {
        if (item.kind === 'existing') {
          photoOrder.push(`existing:${item.path}`);
        } else if (item.kind === 'new') {
          photoOrder.push(`new:${newIdx}`);
          editData.append('photos', item.file);
          newIdx++;
        }
      });
      editData.append('photo_order', JSON.stringify(photoOrder));

      if (skpFile) editData.append('model_skp', skpFile);
      if (objFile) editData.append('model_obj', objFile);
      if (mtlFile) editData.append('model_mtl', mtlFile);
      if (threedsFile) editData.append('model_3ds', threedsFile);
      if (stepFile) editData.append('model_step', stepFile);
      if (dwgFile) editData.append('model_dwg', dwgFile);
      if (archiveFile) editData.append('model_archive', archiveFile);
      textureFiles.forEach(file => editData.append('model_texture', file));

      const response = await fetch(`/api/products/${editingProductId}/edit`, {
        method: 'POST',
        body: editData
      });
      if (!response.ok) {
        let msg = 'Failed to update product';
        try {
          const text = await response.text();
          try {
            const j = JSON.parse(text);
            msg = j.error || j.details || msg;
          } catch {
            const cleaned = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (cleaned) msg = cleaned.slice(0, 180);
          }
        } catch {}
        throw new Error(msg);
      }
      showSuccessToast('Produktas sekmingai atnaujintas!');
      editingProductId = null;
      catalogRendered = false;
      setTimeout(() => go('tiekejo-paskyra'), 1200);
    } catch (error) {
      showErrorToast('Klaida atnaujinant produkta: ' + error.message);
    }
    return;
  }

  const formData = new FormData();
  formData.append('name', document.getElementById('prod-name').value);
  formData.append('brand', document.getElementById('prod-brand').value);
  formData.append('category', category);
  formData.append('price', document.getElementById('prod-price').value);
  formData.append('price_from', document.getElementById('prod-price-from')?.checked ? '1' : '0');
  formData.append('description', document.getElementById('prod-desc').value);
  formData.append('dimensions', document.getElementById('prod-dimensions').value || '');
  formData.append('material', document.getElementById('prod-material').value || '');
  formData.append('delivery', document.getElementById('prod-delivery').value || '');
  formData.append('link', document.getElementById('prod-link').value.trim());
  formData.append('sku', sku);
  formData.append('stock', document.getElementById('prod-stock').value);

  // Photos • only new files are sent under the 'photos' multi-file field
  photoFiles.forEach(item => {
    if (item.kind === 'new') formData.append('photos', item.file);
  });

  // 3D models
  if (skpFile) formData.append('model_skp', skpFile);
  if (objFile) formData.append('model_obj', objFile);
  if (mtlFile) formData.append('model_mtl', mtlFile);
  if (threedsFile) formData.append('model_3ds', threedsFile);
  if (stepFile) formData.append('model_step', stepFile);
  if (dwgFile) formData.append('model_dwg', dwgFile);
  if (archiveFile) formData.append('model_archive', archiveFile);
  textureFiles.forEach(file => formData.append('model_texture', file));

  try {
    const response = await fetch('/api/products', {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      let msg = 'Failed to add product';
      try {
        const j = await response.json();
        msg = j.error || j.details || msg;
      } catch {}
      throw new Error(msg);
    }

    showSuccessToast('Produktas sekmingai pridetas!');
    document.getElementById('product-form').reset();
    resetPhotoGallery();
    catalogRendered = false;
    setTimeout(() => go('tiekejo-paskyra'), 1200);
  } catch (error) {
    console.error('Error:', error);
    showErrorToast('Klaida pridedant produkta: ' + error.message);
  }
}

// -- Supplier dashboard ---------------------------------------
async function renderSupplierDashboard() {
  const products = await loadProducts(true);
  const activeProducts = products.filter(p => p.is_active !== false);

  const statProducts = document.getElementById('sup-stat-products');
  if (statProducts) statProducts.textContent = activeProducts.length;

  const totalDownloads = activeProducts.reduce((sum, product) => sum + (Number(product.download_count) || 0), 0);
  const statModels = document.getElementById('sup-stat-models');
  if (statModels) statModels.textContent = totalDownloads;

  const modelCount = activeProducts.filter(p => p.models && Object.keys(p.models).length > 0).length;

  // Update integration card 3D count
  const intSubs = document.querySelectorAll('#tiekejo-paskyra .int-sub');
  if (intSubs[2]) intSubs[2].textContent = `${modelCount} modeliai • .SKP formatas`;

  const tbody = document.getElementById('supplier-products-tbody');
  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--light);padding:24px;font-size:13px">Dar neprideta produktu. <span onclick="go('add-product')" style="color:var(--dark);text-decoration:underline;cursor:pointer">Prideti pirma ?</span></td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => `
    <tr style="cursor:pointer;${p.is_active === false ? 'opacity:0.6;background:rgba(29,29,31,0.03);' : ''}" onclick="showProductDetail(${p.id})">
      <td style="color:var(--light);font-size:12px;white-space:nowrap">${p.sku || ''}</td>
      <td><strong>${p.name}</strong>${p.is_active === false ? `<div style="font-size:11px;color:var(--mid);margin-top:4px">${t('sup_inactive')}</div>` : ''}</td>
      <td style="color:var(--light)">${Number(p.download_count) || 0}</td>
      <td style="color:var(--light)">${Number(p.like_count) || 0}</td>
      <td style="color:var(--light)">${Number(p.link_click_count) || 0}</td>
      <td onclick="event.stopPropagation()" style="white-space:nowrap;display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="editProduct(${p.id})" style="padding:4px 10px;border-radius:6px;border:0.5px solid var(--border2);background:none;font-size:12px;cursor:pointer;font-family:'Inter',sans-serif;color:var(--mid);transition:background .1s" onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='none'">${t('sup_edit')}</button>
        <button onclick="toggleProductActive(${p.id}, ${p.is_active === false ? 'true' : 'false'})" style="padding:4px 10px;border-radius:6px;border:0.5px solid var(--border2);background:none;font-size:12px;cursor:pointer;font-family:'Inter',sans-serif;color:var(--mid);transition:background .1s" onmouseover="this.style.background='var(--bg2)'" onmouseout="this.style.background='none'">${p.is_active === false ? t('sup_activate') : t('sup_deactivate')}</button>
        <button onclick="deleteProduct(${p.id})" style="padding:4px 10px;border-radius:6px;border:0.5px solid #d9b6b6;background:none;font-size:12px;cursor:pointer;font-family:'Inter',sans-serif;color:#9b3d3d;transition:background .1s" onmouseover="this.style.background='#fff2f2'" onmouseout="this.style.background='none'">${t('sup_delete')}</button>
      </td>
    </tr>
  `).join('');
}

// -- Edit product (pre-fills add-product form) ----------------
async function editProduct(id) {
  const products = await loadProducts(true);
  const product = products.find(p => p.id === id);
  if (!product) return;

  _skipFormReset = true;
  editingProductId = id;
  go('add-product');

  setTimeout(() => {
    document.getElementById('prod-name').value = product.name || '';
    document.getElementById('prod-brand').value = product.brand || '';
    document.getElementById('prod-category').value = product.category || '';
    document.getElementById('prod-price').value = product.price || '';
    const priceFromEl = document.getElementById('prod-price-from');
    if (priceFromEl) priceFromEl.checked = !!product.price_from;
    document.getElementById('prod-sku').value = product.sku || '';
    document.getElementById('prod-stock').value = product.stock || '';
    document.getElementById('prod-desc').value = product.description || '';
    document.getElementById('prod-dimensions').value = product.dimensions || '';
    document.getElementById('prod-material').value = product.material || '';
    document.getElementById('prod-delivery').value = product.delivery || '';
    document.getElementById('prod-link').value = product.link || '';
    const skpInput = document.getElementById('model-skp');
    const objInput = document.getElementById('model-obj');
    const mtlInput = document.getElementById('model-mtl');
    const threedsInput = document.getElementById('model-3ds');
    const stepInput = document.getElementById('model-step');
    const dwgInput = document.getElementById('model-dwg');
    const archiveInput = document.getElementById('model-archive');
    const textureInput = document.getElementById('model-textures');
    if (skpInput) skpInput.value = '';
    if (objInput) objInput.value = '';
    if (mtlInput) mtlInput.value = '';
    if (threedsInput) threedsInput.value = '';
    if (stepInput) stepInput.value = '';
    if (dwgInput) dwgInput.value = '';
    if (archiveInput) archiveInput.value = '';
    if (textureInput) textureInput.value = '';

    // Show existing photos in gallery for context in edit mode.
    const imagePaths = getOrderedImagePaths(product.images);
    photoFiles = imagePaths.map(path => ({ kind: 'existing', path }));
    renderPhotoGrid();
    updatePhotoCount();

    const existingPhotosLabel = document.getElementById('existing-photos-label');
    if (existingPhotosLabel) {
      existingPhotosLabel.style.display = imagePaths.length ? 'block' : 'none';
      existingPhotosLabel.textContent = imagePaths.length
        ? `${t('existing_photos_count')}: ${imagePaths.length}`
        : '';
    }

    const existingModelLabel = document.getElementById('existing-model-label');
    if (existingModelLabel) {
      const modelMap = (product.models && typeof product.models === 'object') ? product.models : {};
      const available = ['SKP', 'OBJ', 'MTL', 'STEP', '3DS', 'DWG']
        .filter(format => modelMap[format])
        .map(format => `${format}: ${getDisplayModelFileName(product, modelMap[format], format.toLowerCase())}`);
      existingModelLabel.style.display = available.length ? 'block' : 'none';
      existingModelLabel.textContent = available.length ? `Esami modeliai: ${available.join(' | ')}` : '';
    }

    const title = document.querySelector('#add-product .dash-title');
    if (title) title.textContent = t('edit_title');
    const submitBtn = document.querySelector('#product-form button[type=submit]');
    if (submitBtn) submitBtn.textContent = t('edit_submit');

    if (existingModelLabel) {
      const bindModelInputNotice = (inputEl, format) => {
        if (!inputEl) return;
        inputEl.onchange = () => {
          if (inputEl.files && inputEl.files[0]) {
            existingModelLabel.style.display = 'block';
            existingModelLabel.textContent = `${format} bus pakeistas i: ${inputEl.files[0].name}`;
          }
        };
      };
      bindModelInputNotice(skpInput, 'SKP');
      bindModelInputNotice(objInput, 'OBJ');
      bindModelInputNotice(mtlInput, 'MTL');
      bindModelInputNotice(stepInput, 'STEP');
      bindModelInputNotice(threedsInput, '3DS');
      bindModelInputNotice(dwgInput, 'DWG');
    }
  }, 80);
}

async function toggleProductActive(id, shouldActivate) {
  const confirmKey = shouldActivate ? 'msg_activate_confirm' : 'msg_deactivate_confirm';
  if (!window.confirm(t(confirmKey))) return;

  try {
    const response = await fetch(`/api/products/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: shouldActivate })
    });

    if (!response.ok) {
      let msg = t('msg_product_action_failed');
      try {
        const data = await response.json();
        msg = data.error || msg;
      } catch {}
      throw new Error(msg);
    }

    if (selectedProductId === id && selectedProductData) {
      selectedProductData = { ...selectedProductData, is_active: shouldActivate };
    }

    catalogRendered = false;
    await renderSupplierDashboard();
    showSuccessToast(t(shouldActivate ? 'msg_product_activated' : 'msg_product_deactivated'));
  } catch (error) {
    console.error('Failed to update product status:', error);
    showErrorToast(`${t('msg_product_action_failed')} ${error.message}`);
  }
}

async function deleteProduct(id) {
  if (!window.confirm(t('msg_delete_confirm'))) return;

  try {
    const response = await fetch(`/api/products/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      let msg = t('msg_product_action_failed');
      try {
        const data = await response.json();
        msg = data.error || msg;
      } catch {}
      throw new Error(msg);
    }

    if (selectedProductId === id) {
      selectedProductId = null;
      selectedProductData = null;
      go('tiekejo-paskyra');
    }

    catalogRendered = false;
    await renderSupplierDashboard();
    showSuccessToast(t('msg_product_deleted'));
  } catch (error) {
    console.error('Failed to delete product:', error);
    showErrorToast(`${t('msg_product_action_failed')} ${error.message}`);
  }
}

function showSuccessToast(message) {
  const t = document.createElement('div');
  t.textContent = message;
  t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#22863a;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-family:Inter,sans-serif;z-index:999;animation:fadeIn .2s ease';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

function showErrorToast(message) {
  const t = document.createElement('div');
  t.textContent = message;
  t.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#e91e1e;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;font-family:Inter,sans-serif;z-index:999;animation:fadeIn .2s ease';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

// Attach form submission handler and photo input wiring
setTimeout(() => {
  const form = document.getElementById('product-form');
  if (form) {
    form.addEventListener('submit', addNewProduct);
  }

  const photoInput = document.getElementById('photo-file-input');
  if (photoInput) {
    photoInput.addEventListener('change', () => handlePhotoFiles(photoInput.files));
  }

  const photoAddBtn = document.getElementById('photo-add-btn');
  if (photoAddBtn) {
    photoAddBtn.addEventListener('click', () => document.getElementById('photo-file-input').click());
  }

  renderPhotoGrid();
  updatePhotoCount();
}, 100);


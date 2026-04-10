// ════════════════════════════════════════════════════════════════════════════════
// NEXUS GAMING - Dashboard JavaScript
// Funciones organizadas por secciones del sidebar:
// - Dashboard: Gestión de PCs y turnos
// - Estaciones: Especificaciones de equipos
// - Inventario: Snacks y bebidas
// - Finanzas: (Pendiente de implementación)
// - Globales: Navegación, modales, toasts, relojes
// ════════════════════════════════════════════════════════════════════════════════

// ── AUTH ──
const CLAVE_SESION_AUTH = 'vho_auth_session';
const estadoAutenticacion = {
  token: null,
  user: null,
  mode: 'login'
};

const fetchNativo = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const reqInit = { ...init };
  const url = typeof input === 'string' ? input : (input?.url || '');
  const isApi = url.startsWith('/api/');
  const isAuthRoute = url.startsWith('/api/auth/');

  if (isApi && !isAuthRoute && estadoAutenticacion.token) {
    const headers = new Headers(reqInit.headers || {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${estadoAutenticacion.token}`);
    }
    reqInit.headers = headers;
  }

  const res = await fetchNativo(input, reqInit);
  if (isApi && !isAuthRoute && res.status === 401 && estadoAutenticacion.token) {
    logout(true);
    showToast('Tu sesión expiró. Inicia sesión nuevamente.', 'error');
  }
  return res;
};

function cambiarModoAuth(mode) {
  estadoAutenticacion.mode = mode;
  const isRegister = mode === 'register';

  const tabLogin = document.getElementById('auth-tab-login');
  const tabRegister = document.getElementById('auth-tab-register');
  const groupUsername = document.getElementById('auth-group-username');
  const usernameInput = document.getElementById('auth-username');
  const submitBtn = document.getElementById('auth-submit');
  const subtitle = document.getElementById('auth-subtitle');

  if (tabLogin) tabLogin.classList.toggle('active', !isRegister);
  if (tabRegister) tabRegister.classList.toggle('active', isRegister);
  if (groupUsername) groupUsername.style.display = isRegister ? 'block' : 'none';
  if (usernameInput) {
    if (isRegister) usernameInput.setAttribute('required', 'true');
    else usernameInput.removeAttribute('required');
  }
  if (submitBtn) submitBtn.textContent = isRegister ? 'Crear Cuenta' : 'Entrar';
  if (subtitle) subtitle.textContent = isRegister
    ? 'Regístrate para empezar a gestionar'
    : 'Inicia sesión para continuar';
}

function aplicarUsuarioSidebar(user) {
  const uname = document.getElementById('sidebar-uname');
  const uemail = document.getElementById('sidebar-uemail');
  const avatar = document.getElementById('sidebar-avatar');

  const safeName = user?.username || 'Usuario';
  const safeEmail = user?.email || 'correo@dominio.com';
  const initial = safeName.trim().charAt(0).toUpperCase() || 'U';

  if (uname) uname.textContent = safeName;
  if (uemail) uemail.textContent = safeEmail;
  if (avatar) avatar.textContent = initial;
}

function guardarSesion(token, user) {
  estadoAutenticacion.token = token;
  estadoAutenticacion.user = user;
  sessionStorage.setItem(CLAVE_SESION_AUTH, JSON.stringify({ token, user }));
  aplicarUsuarioSidebar(user);
  document.body.classList.remove('auth-required');
}

function limpiarSesion() {
  estadoAutenticacion.token = null;
  estadoAutenticacion.user = null;
  sessionStorage.removeItem(CLAVE_SESION_AUTH);
  aplicarUsuarioSidebar(null);
}

async function enviarAutenticacion(e) {
  e.preventDefault();

  const email = document.getElementById('auth-email')?.value.trim();
  const password = document.getElementById('auth-password')?.value;
  const username = document.getElementById('auth-username')?.value.trim();
  const isRegister = estadoAutenticacion.mode === 'register';

  if (!email || !password) return showToast('Completa correo y contraseña', 'error');
  if (isRegister && !username) return showToast('Completa el nombre de usuario', 'error');

  try {
    if (isRegister) {
      const regRes = await fetchNativo('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const regBody = await regRes.json();
      if (!regRes.ok) throw new Error(regBody.error || 'No se pudo registrar');
    }

    const loginRes = await fetchNativo('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const loginBody = await loginRes.json();
    if (!loginRes.ok) throw new Error(loginBody.error || 'Credenciales inválidas');

    guardarSesion(loginBody.token, loginBody.user);
    showToast(isRegister ? 'Registro exitoso. Sesión iniciada.' : 'Sesión iniciada', 'success');

    const form = document.getElementById('auth-form');
    if (form) form.reset();
    cambiarModoAuth('login');
  } catch (err) {
    showToast(err.message || 'Error de autenticación', 'error');
  }
}

function logout(silent = false) {
  limpiarSesion();
  document.body.classList.add('auth-required');
  cambiarModoAuth('login');
  if (!silent) showToast('Sesión cerrada', 'success');
}

function iniciarAutenticacion() {
  cambiarModoAuth('login');
  const raw = sessionStorage.getItem(CLAVE_SESION_AUTH);
  if (!raw) {
    document.body.classList.add('auth-required');
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user) {
      document.body.classList.add('auth-required');
      return;
    }
    guardarSesion(parsed.token, parsed.user);
  } catch (_e) {
    document.body.classList.add('auth-required');
  }
}

// ── CLOCK ──
// Función global: Actualiza relojes en tiempo real en todas las secciones del sidebar
function updateClocks() {
  const t = new Date().toLocaleTimeString('es-CO', {hour:'2-digit',minute:'2-digit'});
  document.querySelectorAll('[id^="clock"]').forEach(el => el.textContent = t);
}
updateClocks(); setInterval(updateClocks, 1000);
iniciarAutenticacion();
 
// ── NAV ──
// Función global: Navegación entre secciones del sidebar (Dashboard, Estaciones, Inventario, Finanzas)
function goTo(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelectorAll('.nav-item-custom').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');

  // Refrescar secciones dinámicas al navegar
  if (page === 'finanzas' && typeof renderFinanceHome === 'function') {
    renderFinanceHome();
  }
  if (page === 'dashboard' && typeof renderPCs === 'function') {
    renderPCs();
  }
}
 
// ── DATA GLOBAL ELIMINADA ──
// Los datos de "Estaciones" ahora se gestionan a través de StationDB en estacion.js
 
// ── RENDER PCs ──
// Dashboard: Renderiza los equipos por categoría con un diseño mejorado
function renderPCs(filter='all') {
  const contenedor = document.getElementById('dashboard-grids');
  if (!contenedor) return;
  contenedor.innerHTML = '';
  const todosLosEquipos = (typeof StationDB !== 'undefined') ? StationDB.getAll() : [];
  
  const categorias = {
    pc: { label: 'PCs Gaming', icon: 'bi-pc-display-horizontal' },
    ps: { label: 'PlayStation', icon: 'bi-controller' },
    laptop: { label: 'Portátiles', icon: 'bi-laptop' },
    mobile: { label: 'Móviles', icon: 'bi-phone' }
  };

  Object.keys(categorias).forEach(categoria => {
    const equiposCategoria = todosLosEquipos.filter(d => d.category === categoria);
    if (equiposCategoria.length === 0) return;

    const equiposFiltrados = equiposCategoria.filter(d => filter === 'all' || d.status === filter);
    if (equiposFiltrados.length === 0 && filter !== 'all') return;

    const disponibles = equiposCategoria.filter(d => d.status === 'available').length;
    const totalEquipos = equiposCategoria.length;

    const seccionCategoria = document.createElement('div');
    seccionCategoria.className = 'dashboard-category mb-4';
    
    let html = `
      <div class="category-header mb-3">
        <i class="bi ${categorias[categoria].icon}"></i>
        <span class="cat-title">${categorias[categoria].label}</span>
        <div class="d-flex align-items-center gap-2 ms-3">
          <span class="cat-count" title="Total de equipos">${totalEquipos}</span>
          <div class="cat-divider"></div>
          <span class="cat-avail-count" title="Equipos libres"><i class="bi bi-check2-circle"></i> ${disponibles} Libres</span>
        </div>
      </div>
      <div class="row g-3">
    `;

    equiposFiltrados.forEach(equipo => {
      const estaOcupado = equipo.status === 'busy';
      html += `
        <div class="col-6 col-md-4 col-xl-3">
          <div class="pc-card premium-card ${estaOcupado ? 'occupied' : ''}">
            <div class="pc-card-header">
               <div class="pc-name-modern">${equipo.id}</div>
               <div class="status-indicator ${estaOcupado ? 'pulse-red' : 'pulse-green'}"></div>
            </div>
            <div class="status-label ${estaOcupado ? 'status-busy' : 'status-avail'}">
              ${estaOcupado ? 'Ocupado' : 'Disponible'}
            </div>
            <button class="btn-detail-modern" onclick="showPCDetail('${equipo.id}')">Ver sesión</button>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    seccionCategoria.innerHTML = html;
    contenedor.appendChild(seccionCategoria);
  });

  if (contenedor.innerHTML === '') {
    contenedor.innerHTML = `<div style="text-align:center;color:var(--muted);padding:40px;">No hay equipos que coincidan con la vista.</div>`;
  }
  refreshCajaUI();
}
// La primera renderización se hará luego de cargar estacion.js
 
// Controla subtabs del Dashboard
function switchDashboardTab(tab, btn) {
  document.querySelectorAll('#dashboard-subtabs .subtab-btn').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');

  const tabHome = document.getElementById('dashboard-tab-home');
  const tabMapa = document.getElementById('dashboard-tab-mapa');
  const tabCaja = document.getElementById('dashboard-tab-caja');

  if (tab === 'mapa') {
    tabHome.style.display = 'none';
    tabMapa.style.display = 'block';
    if (tabCaja) tabCaja.style.display = 'none';
  } else if (tab === 'caja') {
    tabHome.style.display = 'none';
    tabMapa.style.display = 'none';
    if (tabCaja) tabCaja.style.display = 'block';
    refreshCajaUI();
    renderCajaResumen();
  } else {
    tabHome.style.display = 'block';
    tabMapa.style.display = 'none';
    if (tabCaja) tabCaja.style.display = 'none';
    renderPCs(tab);
  }
}
 
// ── GESTIÓN DE TURNOS ──

// Abre el modal de turno y carga los equipos disponibles
function openModalTurno(preselectId = null) {
  const select = document.getElementById('turno-equipo');
  select.innerHTML = '';
  document.getElementById('turno-cliente').value = '';
  
  const devices = (typeof StationDB !== 'undefined') ? StationDB.getAll().filter(d => d.status === 'available') : [];
  if (devices.length === 0) {
    select.innerHTML = '<option disabled selected>No hay equipos disponibles</option>';
  } else {
    devices.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      // Tratar de obtener el nombre bonito de la categoría si existe el diccionario
      const catName = typeof DEVICE_CATEGORIES !== 'undefined' ? DEVICE_CATEGORIES[d.category].label : d.category;
      opt.textContent = `${d.id} (${catName})`;
      if (preselectId && d.id === preselectId) opt.selected = true;
      select.appendChild(opt);
    });
  }
  openModal('modal-turno');
}

// Inicia un nuevo turno
function startTurn() {
  const cliente = document.getElementById('turno-cliente').value.trim();
  const equipoId = document.getElementById('turno-equipo').value;
  const modalidad = document.getElementById('turno-modalidad').value;
  
  if (!cliente) return showToast('Ingresa el nombre del usuario');
  if (!equipoId || equipoId === 'No hay equipos disponibles') return showToast('Selecciona un equipo válido');

  const device = StationDB.getById(equipoId);
  if (!device) return showToast('Equipo no encontrado en la BD');

  // Actualizar metadatos del turno en StationDB
  StationDB.update(device.id, {
    status: 'busy',
    user: cliente,
    startTime: Date.now(),
    modalidad: modalidad,
    cart: []
  });

  showToast(`Turno iniciado en ${equipoId} para ${cliente}`);
  closeModal('modal-turno');
  
  // Refrescar vistas para que se vea reflejado inmediatamente
  renderPCs();
  if (typeof renderAllStations === 'function') renderAllStations();
}

// Prepara el cierre de sesión enviando al POS / Checkout
function endTurn(id) {
  const device = StationDB.getById(id);
  if (!device || device.status !== 'busy') return;
  closeModal('modal-pc-detail');
  showCheckout(id);
}

// Dashboard: Muestra detalles en vivo del PC seleccionado
function showPCDetail(id) {
  const pc = StationDB.getById(id);
  if(!pc) return;

  document.getElementById('modal-pc-title').textContent = id + ' — ' + (pc.status === 'available' ? 'Disponible' : 'Ocupado');
  const body = document.getElementById('modal-pc-body');
  const actionDiv = document.getElementById('modal-pc-actions');
  
  actionDiv.innerHTML = `<button class="btn-action" onclick="closeModal('modal-pc-detail')">Cerrar</button>`;

  if (pc.status === 'busy') {
    const elapsedMs = Date.now() - (pc.startTime || Date.now());
    const min = Math.floor(elapsedMs / 60000); 
    const modMap = {'hora':'Por hora','1h':'Fijo - 1h','2h':'Fijo - 2h','noche':'Promo Noche'};
    
    body.innerHTML = `
      <p><strong>Usuario:</strong> ${pc.user || 'N/A'}</p>
      <p><strong>Modalidad:</strong> ${pc.modalidad ? modMap[pc.modalidad] : 'Por hora'}</p>
      <p><strong>Tiempo activo:</strong> ${min} minuto(s)</p>
    `;
    actionDiv.innerHTML += `<button class="btn-primary-ng" style="background:var(--red);border-color:var(--red);" onclick="endTurn('${id}')">Terminar Turno</button>`;
  } else {
    body.innerHTML = '<p>Este equipo está libre y listo para abrir una sesión de uso.</p>';
    actionDiv.innerHTML += `<button class="btn-primary-ng" onclick="closeModal('modal-pc-detail'); openModalTurno('${id}')">Iniciar Turno</button>`;
  }
  
  openModal('modal-pc-detail');
}
 
// ── STATIONS RENDER (ELIMINADO) ──
// La lógica de pintar cuadros de equipos (estaciones) pasó completamente al módulo estacion.js
 
// ── PUNTO DE VENTA (CHECKOUT) ──
let currentCheckoutDeviceId = null;
let cajaMode = 'device';
let cajaCurrentDeviceId = null;
let cajaExtraItems = [];

// Calcula cuánto cuesta el tiempo jugado aplicando las tarifas reales de TarifaDB
function calcularCostoTiempo(device) {
  const elapsedMs = Date.now() - (device.startTime || Date.now());
  const min = Math.floor(elapsedMs / 60000);
  let costo = 0;

  if (typeof TarifaDB !== 'undefined') {
    const tarifas = TarifaDB.get();
    const cat = device.category || 'pc';
    const t = tarifas[cat] || tarifas['pc'];
    const mod = device.modalidad || 'hora';

    if (mod === '1h')    costo = t.combo1h    || 0;
    else if (mod === '2h')    costo = t.combo2h    || 0;
    else if (mod === 'noche') costo = t.comboNoche || 0;
    else {
      // Por hora: fracción de 15 min aplicada
      const fracciones = Math.ceil(min / 15);
      costo = fracciones * (t.frac15 || 0);
    }
  } else {
    costo = min * 100; // Fallback: $100/min
  }
  return { min, costo };
}

function showCheckout(id) {
  currentCheckoutDeviceId = id;
  const device = StationDB.getById(id);
  if (!device) return;

  const { min, costo: timeCost } = calcularCostoTiempo(device);

  let htmlBody = `
    <div style="font-size:16px;"><strong>Equipo:</strong> ${device.id} | <strong>Cliente:</strong> ${device.user}</div>
    <div style="font-size:14px;color:var(--muted);margin-bottom:12px;">Modalidad: ${device.modalidad} | Minutos jugados: ${min} min</div>
    <table class="finance-table" style="margin-bottom:0;">
      <thead><tr><th>Concepto</th><th>Importe</th></tr></thead>
      <tbody id="checkout-items-table">
        <tr>
          <td>Tiempo de Juego (${min}m)</td>
          <td>$${timeCost.toLocaleString()}</td>
        </tr>
  `;

  let totalItemsCost = 0;
  if(device.cart && device.cart.length > 0) {
    device.cart.forEach((item, idx) => {
      htmlBody += `<tr>
        <td>${item.name} <span style="font-size:11px;color:red;cursor:pointer;margin-left:8px;" onclick="removeCartItem(${idx})">x Quitar</span></td>
        <td>$${item.price.toLocaleString()}</td>
      </tr>`;
      totalItemsCost += item.price;
    });
  }

  htmlBody += `</tbody></table>`;
  document.getElementById('checkout-body').innerHTML = htmlBody;
  
  const grandTotal = timeCost + totalItemsCost;
  document.getElementById('checkout-grand-total').textContent = '$ ' + grandTotal.toLocaleString();

  // Poblar el select de productos rápidos
  const sel = document.getElementById('checkout-product-select');
  sel.innerHTML = '<option value="">-- Seleccionar Producto --</option>';
  ProductDB.getAll().forEach(p => {
    // Si tiene stock o es infinito, mostrar
    if(p.stock !== null && p.stock <= 0) return; 
    sel.innerHTML += `<option value="${p.id}">${p.name} ($${p.price.toLocaleString()})</option>`;
  });

  openModal('modal-checkout');
}

function addExtaProductToCheckout() {
  const sel = document.getElementById('checkout-product-select');
  const prodId = sel.value;
  if(!prodId) return;

  const prod = ProductDB.getById(prodId);
  const device = StationDB.getById(currentCheckoutDeviceId);
  
  if(!device.cart) device.cart = [];
  device.cart.push({ id: prod.id, name: prod.name, price: prod.price });
  StationDB.update(device.id, { cart: device.cart });
  
  // Refrescar el modal
  showCheckout(currentCheckoutDeviceId);
}

function removeCartItem(idx) {
  const device = StationDB.getById(currentCheckoutDeviceId);
  if(device && device.cart) {
    device.cart.splice(idx, 1);
    StationDB.update(device.id, { cart: device.cart });
    showCheckout(currentCheckoutDeviceId);
  }
}

function processCheckout() {
  const device = StationDB.getById(currentCheckoutDeviceId);
  if(!device) return;

  const factura = ejecutarCobroSesion(device);

  showToast(`Cuenta Paga. Equipo ${device.id} Liberado.`);
  closeModal('modal-checkout');
  refreshCajaUI();
  if (factura) showFacturaPreview(factura);
}

function ejecutarCobroSesion(device) {
  if (!device) return null;

  const { min, costo: timeCost } = calcularCostoTiempo(device);
  let itemsCost = 0;
  const lineas = [{ concepto: `Tiempo de Juego (${min}m)`, cantidad: 1, precio: timeCost }];

  // Descontar inventario real si aplican stocks
  if(device.cart && device.cart.length > 0) {
    device.cart.forEach(item => {
      ProductDB.reduceStock(item.id, 1);
      itemsCost += item.price;
      lineas.push({ concepto: item.name, cantidad: 1, precio: item.price });
    });
  }

  const total = timeCost + itemsCost;

  // ── REGISTRAR TRANSACCIÓN EN FINANZAS ──
  if (typeof FinanceDB !== 'undefined') {
    FinanceDB.addTransaction({
      type: 'session',
      device: device.id,
      user: device.user || 'Anónimo',
      duration: min,
      timeCost,
      itemsCost,
      total,
      detail: `Cobro sesión ${device.id}`
    });
  }

  // Liberar el equipo
  StationDB.update(device.id, {
    status: 'available',
    user: null,
    startTime: null,
    modalidad: null,
    cart: []
  });

  showToast(`Cuenta Paga. Equipo ${device.id} Liberado.`);
  closeModal('modal-checkout');
  renderPCs();
  if (typeof renderAllStations === 'function') renderAllStations();
  if (typeof renderInventory === 'function') renderInventory();
  if (typeof renderFinanceHome === 'function') renderFinanceHome();

  return {
    tipo: 'session',
    cliente: device.user || 'Anónimo',
    referencia: device.id,
    lineas,
    total,
    fecha: new Date().toISOString()
  };
}

// ── RENDER INVENTORY ──
let currentInvFilter = 'all';

function switchInventoryTab(cat, btn) {
  document.querySelectorAll('#inventory-subtabs .subtab-btn').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  currentInvFilter = cat;
  renderInventory();
}

function searchInventory(q) {
  renderInventory(q);
}

function renderInventory(query = '') {
  const container = document.getElementById('inventory-grids');
  if(!container) return; // Si no existe el contenedor no dibuja

  let products = ProductDB.getAll();
  if(currentInvFilter !== 'all') {
    products = products.filter(p => p.category === currentInvFilter);
  }
  if(query.trim()) {
    const q = query.toLowerCase();
    products = products.filter(p => p.name.toLowerCase().includes(q));
  }

  if(products.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">No hay productos con este filtro.</div>`;
    return;
  }

  const grouped = {};
  products.forEach(p => {
    if(!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  let html = '';
  Object.keys(grouped).forEach(catId => {
    const cat = PRODUCT_CATEGORIES[catId] || { id: catId, label: catId };
    html += `<div class="section-label">${cat.label}</div><div class="row g-3 mb-4">`;
    grouped[catId].forEach(p => {
      const img = p.image_url
        ? `<img src="${p.image_url}" alt="${p.name}" class="product-img" style="width:72px;height:72px;border-radius:8px;object-fit:cover;border:1px solid var(--border);margin:0 auto 8px;display:block;">`
        : `<div style="width:72px;height:72px;border-radius:8px;background:#f0f0f0;border:1px dashed var(--border);margin:0 auto 8px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:11px;">SIN IMG</div>`;
      html += `<div class="col-6 col-md-3">
        <div class="product-card" style="position:relative; cursor:default;">
          ${img}
          <div class="product-name" style="font-size:14px;">${p.name}</div>
          <div class="product-price" style="font-size:16px;">$${p.price.toLocaleString()}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:12px;">Stock: ${p.stock === null ? '∞' : p.stock}</div>
          <div class="d-flex gap-2">
            <button class="btn-primary-ng flex-grow-1" style="padding:4px; font-size:12px;" onclick="openAddToCartModal('${p.id}')">Vender</button>
            <button class="btn-action w-auto" style="padding:4px 10px;" onclick="openProductModal('${p.id}')"><i class="bi bi-pencil-square"></i></button>
          </div>
        </div>
      </div>`;
    });
    html += `</div>`;
  });
  container.innerHTML = html;
  refreshCajaUI();
}

// Lógica Formulario Productos
function openProductModal(id = null) {
  const form = document.getElementById('product-form');
  form.reset();
  document.getElementById('product-edit-id').value = '';
  document.getElementById('product-image-data').value = '';
  document.getElementById('product-image-preview-wrap').style.display = 'none';
  document.getElementById('product-image-preview').src = '';
  document.getElementById('product-modal-title').textContent = 'Añadir Nuevo Producto';
  
  if(id) {
    const p = ProductDB.getById(id);
    if(p) {
      document.getElementById('product-modal-title').textContent = 'Editar Producto';
      document.getElementById('product-edit-id').value = p.id;
      document.getElementById('product-category').value = p.category;
      document.getElementById('product-name').value = p.name;
      document.getElementById('product-price').value = p.price;
      document.getElementById('product-stock').value = p.stock || 0;
      if (p.image_url) {
        document.getElementById('product-image-data').value = p.image_url;
        document.getElementById('product-image-preview').src = p.image_url;
        document.getElementById('product-image-preview-wrap').style.display = 'block';
      }
    }
  }
  toggleProductStockField();
  openModal('modal-product');
}

function toggleProductStockField() {
  const cat = document.getElementById('product-category').value;
  const isInfinite = PRODUCT_CATEGORIES[cat]?.isInfinite;
  const stockGroup = document.getElementById('group-product-stock');
  const stockInput = document.getElementById('product-stock');
  
  if(isInfinite) {
    stockGroup.style.display = 'none';
    stockInput.removeAttribute('required');
  } else {
    stockGroup.style.display = 'block';
    stockInput.setAttribute('required', 'true');
  }
}

function saveProduct() {
  const id = document.getElementById('product-edit-id').value;
  const data = {
    category: document.getElementById('product-category').value,
    name: document.getElementById('product-name').value.trim(),
    price: document.getElementById('product-price').value,
    stock: document.getElementById('product-stock').value,
    image_url: document.getElementById('product-image-data').value || ''
  };

  if(!data.name) return showToast("Nombre inválido");

  if(id) {
    ProductDB.update(id, data);
    showToast("Producto actualizado");
  } else {
    ProductDB.create(data);
    showToast("Producto añadido exitosamente");
  }

  closeModal('modal-product');
}

function handleProductImageUpload(input) {
  const file = input.files && input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    document.getElementById('product-image-data').value = dataUrl;
    document.getElementById('product-image-preview').src = dataUrl;
    document.getElementById('product-image-preview-wrap').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function saveStock() {
  const productId = document.getElementById('stock-product-id').value;
  const qty = parseInt(document.getElementById('stock-quantity').value, 10) || 0;

  if (!productId) return showToast('Producto inválido', 'error');
  if (qty < 1) return showToast('Cantidad inválida', 'error');

  ProductDB.addStock(productId, qty);
  showToast(`Stock actualizado (+${qty})`, 'success');
  closeModal('modal-stock');
}

// Inicialización de inventario al cargar si es necesario
if(typeof ProductDB !== 'undefined') {
  renderInventory();
}

// ── VENDER DIRECTO DESDE INVENTARIO ──
function openAddToCartModal(prodId) {
  const p = ProductDB.getById(prodId);
  if(!p) return;
  if(p.stock !== null && p.stock <= 0) return showToast("Sin stock disponible");

  document.getElementById('add-cart-product-id').value = p.id;
  document.getElementById('add-cart-product-desc').innerHTML = `<strong>${p.name}</strong> - $${p.price.toLocaleString()}`;
  document.getElementById('add-cart-qty').value = 1;
  document.getElementById('add-cart-qty').max = p.stock !== null ? p.stock : 99; // Límite lógico de UI

  const sel = document.getElementById('add-cart-target');
  sel.innerHTML = '<option value="mostrador">🛒 Venta Directa (Mostrador)</option>';
  
  // Buscar equipos ocupados para cargar a la cuenta
  const busyDevices = StationDB.getAll().filter(d => d.status === 'busy');
  busyDevices.forEach(d => {
    sel.innerHTML += `<option value="${d.id}">💻 ${d.id} (${d.user})</option>`;
  });

  openModal('modal-add-to-cart');
}

function processAddToCart() {
  const prodId = document.getElementById('add-cart-product-id').value;
  const qty = parseInt(document.getElementById('add-cart-qty').value) || 1;
  const targetId = document.getElementById('add-cart-target').value;

  const p = ProductDB.getById(prodId);
  if(!p) return;

  // Si no hay stock suficiente, detener
  if(p.stock !== null && qty > p.stock) return showToast(`Solo quedan ${p.stock} unidades`);

  if(targetId === 'mostrador') {
    // Venta directa — registrar en finanzas
    const totalVenta = p.price * qty;
    ProductDB.reduceStock(prodId, qty);
    if (typeof FinanceDB !== 'undefined') {
      FinanceDB.addTransaction({
        type: 'sale',
        device: 'Mostrador',
        user: 'Venta Directa',
        duration: 0,
        timeCost: 0,
        itemsCost: totalVenta,
        total: totalVenta,
        detail: `${qty}x ${p.name}`
      });
    }
    showToast(`Mostrador: Vendiste ${qty}x ${p.name} ($${totalVenta.toLocaleString()})`);
    if (typeof renderFinanceHome === 'function') renderFinanceHome();
  } else {
    // Cargar a un equipo activo
    const device = StationDB.getById(targetId);
    if(device) {
      if(!device.cart) device.cart = [];
      for(let i=0; i<qty; i++) {
        device.cart.push({ id: p.id, name: p.name, price: p.price });
      }
      StationDB.update(device.id, { cart: device.cart });
      ProductDB.reduceStock(prodId, qty);
      showToast(`Añadido ${qty}x ${p.name} a la cuenta de ${device.user}`);
    }
  }

  closeModal('modal-add-to-cart');
}

// ── CAJA / FACTURACIÓN ──
function setCajaMode(mode, btn) {
  cajaMode = mode;
  document.querySelectorAll('#caja-mode-device-btn, #caja-mode-client-btn, #caja-mode-extra-btn')
    .forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const panelDevice = document.getElementById('caja-panel-device');
  const panelClient = document.getElementById('caja-panel-client');
  const panelExtra = document.getElementById('caja-panel-extra');
  if (!panelDevice || !panelClient || !panelExtra) return;

  panelDevice.style.display = mode === 'device' ? 'block' : 'none';
  panelClient.style.display = mode === 'client' ? 'block' : 'none';
  panelExtra.style.display = mode === 'extra' ? 'block' : 'none';

  refreshCajaUI();
  renderCajaResumen();
}

function refreshCajaUI() {
  const deviceSel = document.getElementById('caja-device-select');
  const clientSel = document.getElementById('caja-client-device-select');
  const extraSel = document.getElementById('caja-extra-product');
  if (!deviceSel || !clientSel || !extraSel || typeof StationDB === 'undefined' || typeof ProductDB === 'undefined') return;

  const busy = StationDB.getAll().filter(d => d.status === 'busy');
  deviceSel.innerHTML = busy.length
    ? busy.map(d => `<option value="${d.id}">${d.id} - ${d.user || 'Sin nombre'}</option>`).join('')
    : '<option value="">Sin equipos ocupados</option>';

  clientSel.innerHTML = busy.length
    ? busy.map(d => `<option value="${d.id}">${d.user || 'Sin nombre'} - ${d.id}</option>`).join('')
    : '<option value="">Sin resultados</option>';

  const products = ProductDB.getAll();
  extraSel.innerHTML = products.length
    ? products.map(p => `<option value="${p.id}">${p.name} - $${p.price.toLocaleString()}</option>`).join('')
    : '<option value="">Sin productos</option>';

  renderCajaExtraTable();
}

function cajaBuscarCliente() {
  const q = (document.getElementById('caja-client-search')?.value || '').trim().toLowerCase();
  const sel = document.getElementById('caja-client-device-select');
  if (!sel || typeof StationDB === 'undefined') return;

  const busy = StationDB.getAll().filter(d => d.status === 'busy');
  const filtered = q ? busy.filter(d => (d.user || '').toLowerCase().includes(q)) : busy;
  sel.innerHTML = filtered.length
    ? filtered.map(d => `<option value="${d.id}">${d.user || 'Sin nombre'} - ${d.id}</option>`).join('')
    : '<option value="">Sin resultados</option>';
}

function cajaLoadDevice() {
  const id = document.getElementById('caja-device-select')?.value;
  if (!id) return showToast('Selecciona un dispositivo', 'error');
  cajaCurrentDeviceId = id;
  renderCajaResumen();
}

function cajaLoadClientDevice() {
  const id = document.getElementById('caja-client-device-select')?.value;
  if (!id) return showToast('Selecciona un cliente/dispositivo', 'error');
  cajaCurrentDeviceId = id;
  renderCajaResumen();
}

function cajaAddExtraItem() {
  const productId = document.getElementById('caja-extra-product')?.value;
  const qty = parseInt(document.getElementById('caja-extra-qty')?.value, 10) || 1;
  const product = ProductDB.getById(productId);
  if (!product) return showToast('Producto no válido', 'error');
  if (qty < 1) return showToast('Cantidad inválida', 'error');
  if (product.stock !== null && qty > product.stock) return showToast(`Stock insuficiente (${product.stock})`, 'error');

  cajaExtraItems.push({ id: product.id, name: product.name, qty, price: product.price });
  renderCajaExtraTable();
  renderCajaResumen();
}

function cajaRemoveExtraItem(idx) {
  cajaExtraItems.splice(idx, 1);
  renderCajaExtraTable();
  renderCajaResumen();
}

function renderCajaExtraTable() {
  const tbody = document.getElementById('caja-extra-table-body');
  if (!tbody) return;
  if (!cajaExtraItems.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);">Sin items agregados</td></tr>`;
    return;
  }

  tbody.innerHTML = cajaExtraItems.map((it, idx) => `
    <tr>
      <td>${it.name}</td>
      <td>${it.qty}</td>
      <td>$${it.price.toLocaleString()}</td>
      <td>$${(it.qty * it.price).toLocaleString()}</td>
      <td><button class="btn-action" style="padding:2px 8px;" onclick="cajaRemoveExtraItem(${idx})">Quitar</button></td>
    </tr>
  `).join('');
}

function renderCajaResumen() {
  const body = document.getElementById('caja-resumen-body');
  const totalEl = document.getElementById('caja-total-display');
  if (!body || !totalEl) return;

  if (cajaMode === 'extra') {
    const total = cajaExtraItems.reduce((s, i) => s + (i.qty * i.price), 0);
    totalEl.textContent = `$ ${total.toLocaleString()}`;
    body.innerHTML = cajaExtraItems.length
      ? cajaExtraItems.map(i => `<div>${i.qty}x ${i.name} - $${(i.qty * i.price).toLocaleString()}</div>`).join('')
      : 'Agrega servicios/productos para cobrar.';
    return;
  }

  const device = cajaCurrentDeviceId ? StationDB.getById(cajaCurrentDeviceId) : null;
  if (!device) {
    totalEl.textContent = '$ 0';
    body.textContent = 'Selecciona un dispositivo o cliente para cargar la cuenta.';
    return;
  }

  const { min, costo: timeCost } = calcularCostoTiempo(device);
  const itemsCost = (device.cart || []).reduce((s, i) => s + (i.price || 0), 0);
  const total = timeCost + itemsCost;

  totalEl.textContent = `$ ${total.toLocaleString()}`;
  body.innerHTML = `
    <div><strong>Dispositivo:</strong> ${device.id}</div>
    <div><strong>Cliente:</strong> ${device.user || 'Anónimo'}</div>
    <div><strong>Tiempo:</strong> ${min} min - $${timeCost.toLocaleString()}</div>
    <div><strong>Consumo:</strong> ${(device.cart || []).length} item(s) - $${itemsCost.toLocaleString()}</div>
  `;
}

function cajaBuildFacturaData() {
  if (cajaMode === 'extra') {
    const cliente = document.getElementById('caja-extra-cliente')?.value.trim() || 'Mostrador';
    const lineas = cajaExtraItems.map(i => ({ concepto: i.name, cantidad: i.qty, precio: i.price }));
    const total = cajaExtraItems.reduce((s, i) => s + (i.qty * i.price), 0);
    return {
      tipo: 'sale',
      cliente,
      referencia: 'Caja - Servicio Adicional',
      lineas,
      total,
      fecha: new Date().toISOString()
    };
  }

  const device = cajaCurrentDeviceId ? StationDB.getById(cajaCurrentDeviceId) : null;
  if (!device) return null;

  const { min, costo: timeCost } = calcularCostoTiempo(device);
  const lineas = [{ concepto: `Tiempo de Juego (${min}m)`, cantidad: 1, precio: timeCost }];
  (device.cart || []).forEach(i => lineas.push({ concepto: i.name, cantidad: 1, precio: i.price || 0 }));
  const total = lineas.reduce((s, l) => s + (l.cantidad * l.precio), 0);

  return {
    tipo: 'session',
    cliente: device.user || 'Anónimo',
    referencia: device.id,
    lineas,
    total,
    fecha: new Date().toISOString()
  };
}

function cajaPreviewFactura() {
  const factura = cajaBuildFacturaData();
  if (!factura) return showToast('No hay datos para facturar', 'error');
  showFacturaPreview(factura);
}

function cajaConfirmarCobro() {
  if (cajaMode === 'extra') {
    if (!cajaExtraItems.length) return showToast('Agrega al menos un item', 'error');

    let total = 0;
    cajaExtraItems.forEach(i => {
      ProductDB.reduceStock(i.id, i.qty);
      total += i.qty * i.price;
    });

    const cliente = document.getElementById('caja-extra-cliente')?.value.trim() || 'Mostrador';
    if (typeof FinanceDB !== 'undefined') {
      FinanceDB.addTransaction({
        type: 'sale',
        device: 'Caja',
        user: cliente,
        duration: 0,
        timeCost: 0,
        itemsCost: total,
        total,
        detail: cajaExtraItems.map(i => `${i.qty}x ${i.name}`).join(', ')
      });
    }

    const facturaExtra = cajaBuildFacturaData();
    cajaExtraItems = [];
    renderCajaExtraTable();
    renderCajaResumen();
    if (typeof renderFinanceHome === 'function') renderFinanceHome();
    if (typeof renderInventory === 'function') renderInventory();
    refreshCajaUI();
    showToast('Cobro adicional registrado', 'success');
    if (facturaExtra) showFacturaPreview(facturaExtra);
    return;
  }

  const device = cajaCurrentDeviceId ? StationDB.getById(cajaCurrentDeviceId) : null;
  if (!device) return showToast('Selecciona una cuenta para cobrar', 'error');

  const facturaSesion = ejecutarCobroSesion(device);
  cajaCurrentDeviceId = null;
  renderCajaResumen();
  refreshCajaUI();
  showToast(`Cobro realizado para ${device.id}`, 'success');
  if (facturaSesion) showFacturaPreview(facturaSesion);
}

function showFacturaPreview(factura) {
  const body = document.getElementById('factura-preview-body');
  if (!body) return;

  const fecha = new Date(factura.fecha || Date.now()).toLocaleString('es-CO');
  const filas = factura.lineas.map(l => `
    <tr>
      <td>${l.concepto}</td>
      <td>${l.cantidad}</td>
      <td>$${l.precio.toLocaleString()}</td>
      <td>$${(l.cantidad * l.precio).toLocaleString()}</td>
    </tr>
  `).join('');

  body.innerHTML = `
    <div style="margin-bottom:10px;">
      <div style="font-weight:700;font-size:18px;">${document.title || 'Factura'}</div>
      <div style="font-size:12px;color:var(--muted);">${fecha}</div>
      <div style="font-size:13px;"><strong>Cliente:</strong> ${factura.cliente}</div>
      <div style="font-size:13px;"><strong>Referencia:</strong> ${factura.referencia}</div>
    </div>
    <div style="overflow-x:auto;">
      <table class="finance-table">
        <thead><tr><th>Concepto</th><th>Cant.</th><th>Valor</th><th>Subtotal</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:12px;font-size:20px;font-weight:700;">
      Total: $${factura.total.toLocaleString()}
    </div>
  `;

  openModal('modal-factura');
}

 
// ── MODAL ──
// Función global: Abre y cierra modales en todas las secciones
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target===m) m.classList.remove('open'); });
});
 
// ── TOAST ──
// Función global: Muestra notificaciones emergentes (toast) en todas las secciones
function showToast(msg, tipo = '') {
  const t = document.getElementById('toast');
  if(!t) return;

  t.classList.remove('error', 'success');
  if (tipo === 'error' || tipo === 'success') {
    t.classList.add(tipo);
  }

  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => {
    t.classList.remove('show', 'error', 'success');
  }, 3000);
}
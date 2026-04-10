// en este archivo gestiono estaciones categorias y tarifas

// defino categorias y campos de especificaciones que se piden por tipo de equipo
const DEVICE_CATEGORIES = {
  pc: {
    label: 'PC Gaming', prefix: 'PC', icon: 'bi-pc-display-horizontal',
    specs: [
      { key: 'storage', label: 'Almacenamiento', placeholder: '447 GB SSD' },
      { key: 'gpu',     label: 'Tarjeta Gráfica', placeholder: 'NVIDIA GTX 1660' },
      { key: 'ram',     label: 'RAM',             placeholder: '16.0 GB DDR4' },
      { key: 'cpu',     label: 'Procesador',      placeholder: 'Ryzen 5 5600GT' },
      { key: 'monitor', label: 'Monitor',         placeholder: '24" 144Hz FHD' },
    ]
  },
  ps: {
    label: 'PlayStation', prefix: 'PS', icon: 'bi-controller',
    specs: [
      { key: 'version', label: 'Versión',        placeholder: 'PlayStation 5' },
      { key: 'storage', label: 'Almacenamiento', placeholder: '825 GB SSD' },
      { key: 'ram',     label: 'RAM',            placeholder: '16.0 GB GDDR6' },
      { key: 'cpu',     label: 'Procesador',     placeholder: 'Zen 2 Custom 8-core' },
    ]
  },
  mobile: {
    label: 'Móvil', prefix: 'MOV', icon: 'bi-phone',
    specs: [
      { key: 'model',   label: 'Modelo',         placeholder: 'Samsung Galaxy A54' },
      { key: 'ram',     label: 'RAM',            placeholder: '8 GB' },
      { key: 'storage', label: 'Almacenamiento', placeholder: '128 GB' },
      { key: 'battery', label: 'Batería',        placeholder: '5000 mAh' },
      { key: 'screen',  label: 'Pantalla',       placeholder: '6.4" AMOLED' },
    ]
  },
  laptop: {
    label: 'Portátil', prefix: 'LAP', icon: 'bi-laptop',
    specs: [
      { key: 'model',   label: 'Modelo',         placeholder: 'Lenovo IdeaPad 5' },
      { key: 'cpu',     label: 'Procesador',     placeholder: 'Ryzen 5 5500U' },
      { key: 'ram',     label: 'RAM',            placeholder: '16 GB DDR4' },
      { key: 'storage', label: 'Almacenamiento', placeholder: '512 GB SSD' },
      { key: 'screen',  label: 'Pantalla',       placeholder: '15.6" FHD IPS' },
    ]
  }
};

// creo un request base para estaciones con control de errores de api
async function apiRequest(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  // capturo errores http y regreso mensaje entendible
  if (!res.ok) {
    let detalle = '';
    try {
      const body = await res.json();
      detalle = body.error || '';
    } catch (_e) {
      detalle = '';
    }
    throw new Error(detalle || `Error API (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// uso stationdb como cache local para leer y pintar estaciones rapido
const StationDB = {
  _cache: [],

  // inicio cache trayendo estaciones del backend
  async init() {
    const rows = await apiRequest('/api/estaciones');
    this._cache = rows.map(r => ({ ...r, cart: Array.isArray(r.cart) ? r.cart : [] }));
    return this.getAll();
  },

  // devuelvo copia para que no muten cache desde afuera
  getAll() {
    return Array.isArray(this._cache) ? [...this._cache] : [];
  },

  // creo estacion en cache y en el backend
  async create(data) {
    if (this.exists(data.id)) {
      throw new Error(`El ID "${data.id}" ya existe`);
    }

    const payload = {
      id: data.id,
      number: data.number,
      category: data.category,
      specs: data.specs || {},
      status: data.status || 'available',
      user: data.user ?? null,
      startTime: data.startTime ?? null,
      modalidad: data.modalidad ?? null,
      cart: data.cart ?? []
    };

    await apiRequest('/api/estaciones', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const newDevice = {
      ...data,
      status: data.status || 'available',
      createdAt: new Date().toISOString(),
      cart: Array.isArray(data.cart) ? data.cart : []
    };
    this._cache.push(newDevice);
    if (typeof syncDashboardDevices === 'function') syncDashboardDevices();
    return newDevice;
  },

  // actualizo campos de una estacion y armo payload dinamico
  update(id, changes) {
    const idx = this._cache.findIndex(s => s.id === id);
    if (idx === -1) return null;

    this._cache[idx] = { ...this._cache[idx], ...changes };
    if (typeof syncDashboardDevices === 'function') syncDashboardDevices();

    // solo mando al backend los campos que realmente cambiaron
    const payload = {};
    if (changes.number !== undefined) payload.number = changes.number;
    if (changes.specs !== undefined) payload.specs = changes.specs;
    if (changes.status !== undefined) payload.status = changes.status;
    if (changes.user !== undefined) payload.user = changes.user;
    if (changes.startTime !== undefined) payload.startTime = changes.startTime;
    if (changes.modalidad !== undefined) payload.modalidad = changes.modalidad;
    if (changes.cart !== undefined) payload.cart = changes.cart;

    if (Object.keys(payload).length > 0) {
      apiRequest(`/api/estaciones/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      }).catch(err => showToast(`Error actualizando ${id}: ${err.message}`, 'error'));
    }

    return this._cache[idx];
  },

  // elimino de cache y tambien en backend
  async delete(id) {
    const previousCache = [...this._cache];
    this._cache = this._cache.filter(s => s.id !== id);
    if (typeof syncDashboardDevices === 'function') syncDashboardDevices();

    try {
      await apiRequest(`/api/estaciones/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (err) {
      this._cache = previousCache;
      if (typeof syncDashboardDevices === 'function') syncDashboardDevices();
      showToast(`Error eliminando ${id}: ${err.message}`, 'error');
      throw err;
    }
  },

  // busco estacion por id
  getById(id) {
    return this._cache.find(s => s.id === id) || null;
  },

  // filtro estaciones por texto en id categoria o specs
  search(query) {
    if (!query || !query.trim()) return this.getAll();
    const q = query.toLowerCase().trim();
    return this.getAll().filter(s =>
      s.id.toLowerCase().includes(q) ||
      DEVICE_CATEGORIES[s.category].label.toLowerCase().includes(q) ||
      Object.values(s.specs || {}).some(v => String(v).toLowerCase().includes(q))
    );
  },

  // verifico si existe un id para evitar duplicados
  exists(id) {
    return this._cache.some(s => s.id === id);
  }
};

// en tarifadb guardo tarifas por categoria con valores por defecto
const TarifaDB = {
  _cache: {},
  DEFAULTS: {
    pc:     { hour: 0, frac15: 0, combo1h: 0, combo2h: 0, comboNoche: 0 },
    ps:     { hour: 0, frac15: 0, combo1h: 0, combo2h: 0, comboNoche: 0 },
    mobile: { hour: 0, frac15: 0, combo1h: 0, combo2h: 0, comboNoche: 0 },
    laptop: { hour: 0, frac15: 0, combo1h: 0, combo2h: 0, comboNoche: 0 }
  },
  // inicio tarifas desde backend y si falla dejo defaults
  async init() {
    try {
      const raw = await apiRequest('/api/estaciones/tarifas');
      this._cache = {};
      Object.keys(this.DEFAULTS).forEach(cat => {
        const src = raw[cat] || {};
        this._cache[cat] = {
          hour: src.hour ?? this.DEFAULTS[cat].hour,
          frac15: src.frac15 ?? this.DEFAULTS[cat].frac15,
          combo1h: src.combo1h ?? this.DEFAULTS[cat].combo1h,
          combo2h: src.combo2h ?? this.DEFAULTS[cat].combo2h,
          comboNoche: src.combo_noche ?? this.DEFAULTS[cat].comboNoche
        };
      });
    } catch (_e) {
      this._cache = JSON.parse(JSON.stringify(this.DEFAULTS));
    }
  },
  // retorno tarifas y me aseguro de tener estructura valida
  get() {
    if (!Object.keys(this._cache).length) {
      this._cache = JSON.parse(JSON.stringify(this.DEFAULTS));
    }
    return this._cache;
  },
  // actualizo una tarifa puntual y persisto al backend
  updateField(cat, field, value) {
    if (!this._cache[cat]) this._cache[cat] = {};
    this._cache[cat][field] = parseInt(value, 10) || 0;

    const t = this._cache[cat];
    apiRequest(`/api/estaciones/tarifas/${cat}`, {
      method: 'PUT',
      body: JSON.stringify({
        hour: t.hour || 0,
        frac15: t.frac15 || 0,
        combo1h: t.combo1h || 0,
        combo2h: t.combo2h || 0,
        combo_noche: t.comboNoche || 0
      })
    }).catch(err => showToast(`Error guardando tarifa: ${err.message}`, 'error'));
  }
};

// guardo estado de edicion actual para crear o editar desde un solo modal
let _editingDeviceId  = null;
let _selectedCat      = 'pc';

// calculo el siguiente numero libre de una categoria
function getNextDeviceNumber(cat) {
  const all = StationDB.getAll().filter(s => s.category === cat);
  if (all.length === 0) return '01';
  const nums = all.map(s => parseInt(s.number, 10)).filter(n => !isNaN(n));
  if (nums.length === 0) return '01';
  const max = Math.max(...nums);
  return (max + 1).toString().padStart(2, '0');
}

// inicializo modulo de estaciones y disparo renders principales
async function initStations() {
  _generateDeviceSpecFields('pc'); // Pre-genera campos del modal
  // uso promise all para cargar estaciones y tarifas en paralelo
  await Promise.all([StationDB.init(), TarifaDB.init()]);
  renderAllStations();
  renderTarifas();
  renderMapa();
  if (typeof syncDashboardDevices === 'function') syncDashboardDevices();
}

// cambio entre subtabs de estaciones y oculto paneles no activos
function switchStationTab(tab, btn) {
  // Desactiva todos los botones de subtab
  document.querySelectorAll('#station-subtabs .subtab-btn')
    .forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Oculta todos los paneles
  ['home', 'tarifas'].forEach(t => {
    const el = document.getElementById('station-tab-' + t);
    if (el) el.style.display = 'none';
  });

  // Muestra el panel activo
  const panel = document.getElementById('station-tab-' + tab);
  if (panel) panel.style.display = 'block';

  // Los controles de búsqueda solo aparecen en Home
  const controls = document.getElementById('station-home-controls');
  if (controls) controls.style.display = (tab === 'home') ? 'flex' : 'none';
}

// renderizo estaciones por categoria y actualizo contadores
function renderAllStations(stations) {
  const all = stations !== undefined ? stations : StationDB.getAll();
  Object.keys(DEVICE_CATEGORIES).forEach(cat => {
    const catDevices = all.filter(s => s.category === cat);
    const grid = document.getElementById('station-' + cat + '-grid');
    const section = grid ? grid.closest('.category-section') : null;

    if (section) {
      section.style.display = catDevices.length ? '' : 'none';
    }

    _renderCategoryGrid(cat, catDevices);
    const countEl = document.getElementById('count-' + cat);
    if (countEl) countEl.textContent = catDevices.length;
  });
}

// pinto una grilla horizontal de una sola categoria
function _renderCategoryGrid(cat, devices) {
  const grid = document.getElementById('station-' + cat + '-grid');
  if (!grid) return;
  if (devices.length === 0) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = devices.map(_buildStationCard).join('');
}

// armo html de cada tarjeta de estacion con specs y botones
function _buildStationCard(s) {
  const cat = DEVICE_CATEGORIES[s.category];
  const isOk  = s.status === 'available';
  const specsHTML = cat.specs.map(def => {
    const val = s.specs?.[def.key] || '—';
    return `<div class="spec-row"><span class="label">${def.label}</span><span class="val">${val}</span></div>`;
  }).join('');

  return `<div class="station-card-wrap">
    <div class="station-card">
      <div class="station-header">
        <div>
          <div class="station-id">${s.id}</div>
          <div class="station-type-badge">${cat.label}</div>
        </div>
        <div class="station-actions-btns">
          <button class="edit-btn" onclick="openEditDevice('${s.id}')" title="Editar">
            <i class="bi bi-pencil-square"></i>
          </button>
          <button class="delete-btn" onclick="confirmDeleteDevice('${s.id}')" title="Eliminar">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </div>
      
      <div class="d-flex align-items-center justify-content-between mb-3">
        <div class="device-status-badge ${isOk ? 'available' : 'busy'}" style="margin-bottom:0;">
          <span class="status-dot ${isOk ? 'green' : 'red'}"></span>
          ${isOk ? 'Disponible' : 'Ocupado'}
        </div>
        ${isOk 
          ? `<button class="btn-action" style="padding:4px 10px;font-size:11px;" onclick="goTo('dashboard'); setTimeout(() => openModalTurno('${s.id}'), 100)">Iniciar</button>`
          : `<button class="btn-action" style="padding:4px 10px;font-size:11px;" onclick="goTo('dashboard'); setTimeout(() => showPCDetail('${s.id}'), 100)">Ver sesión</button>`
        }
      </div>

      <div class="specs-container">${specsHTML}</div>
    </div>
  </div>`;
}

// ─────────────────────────────────────────────────────────────────
// BÚSQUEDA EN TIEMPO REAL
// ─────────────────────────────────────────────────────────────────
function searchStations(query) {
  renderAllStations(StationDB.search(query));
}

// ─────────────────────────────────────────────────────────────────
// MODAL UNIFICADO — Abrir para crear o editar
// ─────────────────────────────────────────────────────────────────
function openDeviceModal(editId) {
  _editingDeviceId = editId || null;
  const isEdit = !!editId;

  document.getElementById('device-modal-title').textContent =
    isEdit ? 'Editar Equipo' : 'Agregar Equipo';

  // El selector de categoría solo aparece al crear
  const catSel = document.getElementById('device-category-selector');
  if (catSel) catSel.style.display = isEdit ? 'none' : 'block';

  if (isEdit) {
    const device = StationDB.getById(editId);
    if (!device) return;
    selectDeviceCategory(device.category, null, false);
    document.getElementById('device-number').value = device.number || '';
    document.getElementById('device-category-input').value = device.category;
    updateIdPreview();
    // Pre-llena los campos de specs con los datos actuales
    DEVICE_CATEGORIES[device.category].specs.forEach(def => {
      const input = document.getElementById('dspec-' + def.key);
      if (input) input.value = device.specs?.[def.key] || '';
    });
  } else {
    document.getElementById('device-form').reset();
    selectDeviceCategory('pc', document.querySelector('.cat-tab[data-cat="pc"]'));
    updateIdPreview();
  }
  openModal('modal-device');
}

function openEditDevice(id) { openDeviceModal(id); }

// cambio categoria activa en modal y regenero campos de specs
function selectDeviceCategory(cat, btn, resetNumber) {
  _selectedCat = cat;
  document.getElementById('device-category-input').value = cat;

  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else {
    const t = document.querySelector(`.cat-tab[data-cat="${cat}"]`);
    if (t) t.classList.add('active');
  }

  _generateDeviceSpecFields(cat);
  if (resetNumber !== false) {
    document.getElementById('device-number').value = getNextDeviceNumber(cat);
  }
  updateIdPreview();
}

// genero inputs de especificaciones segun categoria elegida
function _generateDeviceSpecFields(cat) {
  const container = document.getElementById('device-specs-fields');
  if (!container) return;
  const catConf = DEVICE_CATEGORIES[cat];
  container.innerHTML = catConf.specs.map(def => `
    <div class="form-group">
      <label>${def.label}</label>
      <input type="text" id="dspec-${def.key}" placeholder="${def.placeholder}" required>
    </div>`).join('');
}

// actualizo el preview del id en tiempo real mientras se edita
function updateIdPreview() {
  const num     = document.getElementById('device-number')?.value || '';
  const cat     = document.getElementById('device-category-input')?.value || 'pc';
  const prefix  = DEVICE_CATEGORIES[cat]?.prefix || cat.toUpperCase();
  const preview = num ? `${prefix}-${num.padStart(2, '0')}` : `${prefix}-??`;
  const el = document.getElementById('device-id-preview');
  if (el) el.textContent = preview;
}

// guardo dispositivo y decido si crear o actualizar
async function saveDevice() {
  const cat    = document.getElementById('device-category-input').value;
  const number = document.getElementById('device-number').value.trim().padStart(2, '0');
  const prefix = DEVICE_CATEGORIES[cat].prefix;
  const newId  = `${prefix}-${number}`;

  // recojo specs desde los campos dinamicos del modal
  const specs = {};
  DEVICE_CATEGORIES[cat].specs.forEach(def => {
    const inp = document.getElementById('dspec-' + def.key);
    if (inp) specs[def.key] = inp.value.trim();
  });

  try {
    if (_editingDeviceId) {
      // estoy editando un equipo existente
      if (_editingDeviceId !== newId) {
        // valido que el nuevo id no exista antes de renombrar
        if (StationDB.exists(newId)) {
          showToast(`El ID "${newId}" ya está en uso. Elige otro número.`, 'error');
          return;
        }
        const old = StationDB.getById(_editingDeviceId);
        await StationDB.create({
          id: newId,
          number,
          category: cat,
          specs,
          status: old?.status || 'available',
          user: old?.user,
          startTime: old?.startTime,
          modalidad: old?.modalidad,
          cart: old?.cart || []
        });
        await StationDB.delete(_editingDeviceId);
      } else {
        StationDB.update(_editingDeviceId, { number, specs });
      }
      showToast(`Equipo ${newId} actualizado ✓`, 'success');
    } else {
      // estoy creando un equipo nuevo
      if (StationDB.exists(newId)) {
        showToast(`El ID "${newId}" ya existe. Usa otro número.`, 'error');
        return;
      }
      await StationDB.create({ id: newId, number, category: cat, specs });
      showToast(`Equipo ${newId} agregado ✓`, 'success');
    }

    closeModal('modal-device');
    renderAllStations();
    renderMapa();
  } catch (err) {
    showToast(err.message || 'Error guardando equipo', 'error');
  }
}

// pido confirmacion y elimino equipo si el usuario acepta
function confirmDeleteDevice(id) {
  showConfirmDialog({
    titulo: `¿Eliminar el equipo "${id}"?`,
    texto: 'Esta acción no se puede deshacer.',
    tipo: 'error',
    textoConfirmar: 'Sí, eliminar',
    textoCancelar: 'No, conservar'
  }).then(confirmado => {
    if (!confirmado) return;
    StationDB.delete(id);
    showToast(`Equipo ${id} eliminado`, 'error');
    renderAllStations();
    renderMapa();
  });
}

// renderizo tarjetas de tarifas y manejo guardado por categoria
function renderTarifas() {
  const container = document.getElementById('tarifas-container');
  if (!container) return;
  const tarifas = TarifaDB.get();
  const fields = [
    { key: 'hour',       label: 'Precio por Hora',  icon: 'bi-clock' },
    { key: 'frac15',     label: 'Fracción 15 min',   icon: 'bi-clock-history' },
    { key: 'combo1h',    label: 'Combo 1 Hora',      icon: 'bi-tag' },
    { key: 'combo2h',    label: 'Combo 2 Horas',     icon: 'bi-tags' },
    { key: 'comboNoche', label: 'Combo Noche (4h+)', icon: 'bi-moon-stars' },
  ];

  container.innerHTML = Object.keys(DEVICE_CATEGORIES).map(cat => {
    const catConf   = DEVICE_CATEGORIES[cat];
    const catTarifas = tarifas[cat] || {};
    const fieldsHTML = fields.map(f => {
      if (cat === 'mobile' && f.key === 'comboNoche') return '';
      const val = catTarifas[f.key] ?? 0;
      return `<div class="tarifa-field">
        <div class="tarifa-field-label"><i class="bi ${f.icon}"></i>${f.label}</div>
        <div class="tarifa-input-wrap">
          <span class="tarifa-currency">$</span>
          <input type="number" class="tarifa-input" min="0" value="${val}"
            onchange="saveTarifa('${cat}','${f.key}',this.value)">
        </div>
      </div>`;
    }).join('');
    return `<div class="tarifa-card">
      <div class="tarifa-card-header">
        <i class="bi ${catConf.icon}"></i>${catConf.label}
      </div>
      <div class="tarifa-fields">${fieldsHTML}</div>
    </div>`;
  }).join('');
}

// guardo una tarifa puntual cuando cambia un input
function saveTarifa(cat, field, value) {
  TarifaDB.updateField(cat, field, value);
  showToast(`Tarifa de ${DEVICE_CATEGORIES[cat].label} actualizada ✓`, 'success');
}

// dibujo mapa visual del local dividido por zonas
function renderMapa() {
  const container = document.getElementById('mapa-container');
  if (!container) return;
  const all = StationDB.getAll();

  const iconMap = { pc: 'bi-pc-display-horizontal', ps: 'bi-controller', mobile: 'bi-phone', laptop: 'bi-laptop' };

  function buildMapDevices(devices) {
    if (!devices.length) return '<span class="zone-empty">Sin equipos</span>';
    return devices.map(d => `
      <div class="map-device ${d.status}" onclick="showToast('${d.id} — ${d.status === 'available' ? 'Disponible' : 'Ocupado'}')" title="${d.id}">
        <i class="bi ${iconMap[d.category]} map-device-icon"></i>
        <span class="map-device-id">${d.id}</span>
      </div>`).join('');
  }

  const legend = `<div class="floor-legend">
    <span class="legend-dot green"></span>Disponible
    <span class="legend-dot red" style="margin-left:12px"></span>Ocupado
  </div>`;

  container.innerHTML = `
    <!-- PISO 2: Gaming -->
    <div class="floor-card">
      <div class="floor-header">
        <div class="floor-badge gaming">PISO 2</div>
        <span>Gaming Zone</span>
        ${legend}
      </div>
      <div class="floor-layout">
        <div class="floor-zone">
          <div class="zone-label"><i class="bi bi-pc-display-horizontal"></i> PCs Gaming</div>
          <div class="zone-devices">${buildMapDevices(all.filter(s => s.category === 'pc'))}</div>
        </div>
        <div class="zone-divider"></div>
        <div class="floor-zone">
          <div class="zone-label"><i class="bi bi-controller"></i> PlayStation</div>
          <div class="zone-devices">${buildMapDevices(all.filter(s => s.category === 'ps'))}</div>
        </div>
      </div>
    </div>
    <!-- PISO 1: Coworking -->
    <div class="floor-card">
      <div class="floor-header">
        <div class="floor-badge cowork">PISO 1</div>
        <span>Coworking Zone</span>
        ${legend}
      </div>
      <div class="floor-layout">
        <div class="floor-zone">
          <div class="zone-label"><i class="bi bi-laptop"></i> Portátiles</div>
          <div class="zone-devices">${buildMapDevices(all.filter(s => s.category === 'laptop'))}</div>
        </div>
        <div class="zone-divider"></div>
        <div class="floor-zone">
          <div class="zone-label"><i class="bi bi-phone"></i> Móviles</div>
          <div class="zone-devices">${buildMapDevices(all.filter(s => s.category === 'mobile'))}</div>
        </div>
        <div class="floor-reception">
          <div style="text-align:center;padding:16px;border:1px dashed var(--border);border-radius:8px;color:var(--muted);font-size:13px;margin-top:8px;">
            <i class="bi bi-door-open" style="font-size:22px;display:block;margin-bottom:4px;"></i>
            Recepción / Entrada
          </div>
        </div>
      </div>
    </div>`;
}

// sincronizo dashboard cuando cambian estaciones en este modulo
function syncDashboardDevices() {
  const all = StationDB.getAll();
  // Actualiza la grid del dashboard si existe
  if (typeof renderPCs === 'function') renderPCs();
  if (typeof renderMapa === 'function') renderMapa();
  // Actualiza el select del modal "Iniciar Turno"
  _updateTurnSelect(all);
}

// repinto el select del modal de turnos solo con equipos disponibles
function _updateTurnSelect(all) {
  const sel = document.querySelector('#modal-turno select');
  if (!sel) return;
  const available = all.filter(s => s.status === 'available');
  sel.innerHTML = available.length
    ? available.map(s => `<option value="${s.id}">${s.id} — ${DEVICE_CATEGORIES[s.category].label} (Disponible)</option>`).join('')
    : '<option disabled>No hay equipos disponibles</option>';
}

// inicio estaciones al cargar dom y dejo fallback de render en caso de error
document.addEventListener('DOMContentLoaded', () => {
  initStations().catch(err => {
    showToast(`No se pudieron cargar estaciones: ${err.message}`, 'error');
    renderAllStations([]);
    renderTarifas();
    renderMapa();
  });
});
// tambien expongo init por si hace falta reiniciar modulo manualmente
window.initStations = initStations;


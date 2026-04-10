// ════════════════════════════════════════════════════════════════════════════════
// NEXUS GAMING — Módulo de Finanzas
// Conectado con: index.js (processCheckout, processAddToCart)
// Pestañas: Home (resumen hoy), Historial (tabla por fecha), Gráficas (Chart.js)
// ════════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// BASE DE DATOS DE TRANSACCIONES — API REST + caché en memoria
// ─────────────────────────────────────────────────────────────────
async function financeApiRequest(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
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

const FinanceDB = {
  _cache: [],

  async init() {
    const rows = await financeApiRequest('/api/transacciones');
    this._cache = rows.map(tx => ({
      id: tx.id,
      type: tx.type || 'sale',
      device: tx.device || '—',
      user: tx.user || 'Anónimo',
      duration: Number(tx.duration) || 0,
      timeCost: Number(tx.timeCost) || 0,
      itemsCost: Number(tx.itemsCost) || 0,
      total: Number(tx.total) || 0,
      detail: tx.detail || '',
      date: tx.date || new Date().toISOString()
    }));
    return this.getAll();
  },

  // Retorna todas las transacciones guardadas
  getAll() {
    return [...this._cache];
  },

  // Guarda una nueva transacción
  // data = { type, device, user, duration, timeCost, itemsCost, total, detail? }
  addTransaction(data) {
    const tx = {
      id: 'TMP-' + Date.now().toString().slice(-7),
      type: data.type || 'sale',         // 'session' | 'sale'
      device: data.device || '—',
      user: data.user || 'Anónimo',
      duration: data.duration || 0,
      timeCost: data.timeCost || 0,
      itemsCost: data.itemsCost || 0,
      total: data.total || 0,
      detail: data.detail || '',
      date: new Date().toISOString()     // Guardamos como ISO para filtrar por fecha
    };
    this._cache.push(tx);

    financeApiRequest('/api/transacciones', {
      method: 'POST',
      body: JSON.stringify(tx)
    }).then(() => this.init())
      .catch(err => {
        if (typeof showToast === 'function') {
          showToast(`Error guardando transacción: ${err.message}`, 'error');
        }
      });

    return tx;
  },

  // Retorna transacciones filtradas por una fecha (YYYY-MM-DD)
  getByDate(dateStr) {
    return this.getAll().filter(tx => tx.date.startsWith(dateStr));
  },

  // Retorna transacciones de los últimos N días agrupadas por fecha
  getLast7Days() {
    const result = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      result[key] = 0;
    }
    this.getAll().forEach(tx => {
      const day = tx.date.slice(0, 10);
      if (day in result) result[day] += tx.total;
    });
    return result;
  },

  // Limpia todas las transacciones (para debugging)
  clear() {
    this._cache = [];
    financeApiRequest('/api/transacciones', { method: 'DELETE' })
      .catch(err => {
        if (typeof showToast === 'function') {
          showToast(`Error limpiando transacciones: ${err.message}`, 'error');
        }
      });
  }
};

// ─────────────────────────────────────────────────────────────────
// ESTADO INTERNO
// ─────────────────────────────────────────────────────────────────
let _financeChart = null;  // Referencia al chart de Chart.js
let _currentFinanceTab = 'home';

// ─────────────────────────────────────────────────────────────────
// NAVEGACIÓN ENTRE SUBTABS DE FINANZAS
// ─────────────────────────────────────────────────────────────────
function switchFinanceTab(tab, btn) {
  _currentFinanceTab = tab;

  // Actualizar botones activos
  document.querySelectorAll('#finanzas-subtabs .subtab-btn')
    .forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // Ocultar todos los paneles
  ['home', 'history', 'charts'].forEach(t => {
    const el = document.getElementById('finanzas-tab-' + t);
    if (el) el.style.display = 'none';
  });

  // Mostrar el activo
  const panel = document.getElementById('finanzas-tab-' + tab);
  if (panel) panel.style.display = 'block';

  // Renderizar contenido según pestaña
  if (tab === 'home')    renderFinanceHome();
  if (tab === 'history') renderFinanceHistory(getTodayStr());
  if (tab === 'charts')  renderFinanceChart();
}

// ─────────────────────────────────────────────────────────────────
// UTILIDAD — Fecha de hoy como YYYY-MM-DD
// ─────────────────────────────────────────────────────────────────
function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Formatea una fecha YYYY-MM-DD a "dd/mm/yyyy"
function formatFechaDisplay(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ─────────────────────────────────────────────────────────────────
// PESTAÑA HOME — Tarjetas de resumen de hoy
// ─────────────────────────────────────────────────────────────────
function renderFinanceHome() {
  const todayTx = FinanceDB.getByDate(getTodayStr());
  const yesterdayTx = FinanceDB.getByDate(getYesterdayStr());

  // Totales de hoy
  const totalHoy       = todayTx.reduce((s, t) => s + t.total, 0);
  const productosHoy   = todayTx.reduce((s, t) => s + t.itemsCost, 0);
  const tiempoHoy      = todayTx.reduce((s, t) => s + t.timeCost, 0);
  const sesionesHoy    = todayTx.filter(t => t.type === 'session').length;
  const ventasHoy      = todayTx.filter(t => t.type === 'sale').length;
  const avgDuracion    = sesionesHoy > 0
    ? Math.round(todayTx.filter(t => t.type === 'session').reduce((s, t) => s + t.duration, 0) / sesionesHoy)
    : 0;

  // Comparativa con ayer
  const totalAyer = yesterdayTx.reduce((s, t) => s + t.total, 0);
  const pct = totalAyer > 0 ? Math.round(((totalHoy - totalAyer) / totalAyer) * 100) : 0;
  const pctIcon = pct >= 0 ? '<i class="bi bi-arrow-up-short"></i>' : '<i class="bi bi-arrow-down-short"></i>';
  const pctColor = pct >= 0 ? 'var(--accent)' : 'var(--red, #e74c3c)';

  // Inyectar en los elementos
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

  setEl('finance-total-val',    `$ ${totalHoy.toLocaleString('es-CO')}`);
  setEl('finance-total-sub',    `<span style="color:${pctColor}">${pctIcon} ${pct >= 0 ? '+' : ''}${pct}% vs ayer</span>`);
  setEl('finance-products-val', `$ ${productosHoy.toLocaleString('es-CO')}`);
  setEl('finance-products-sub', `${ventasHoy + sesionesHoy} transacciones hoy`);
  setEl('finance-time-val',     `$ ${tiempoHoy.toLocaleString('es-CO')}`);
  setEl('finance-time-sub',     `Promedio: ${avgDuracion} min / sesión`);

  // Widget de sesiones activas en este momento
  _actualizarWidgetSesiones();

  // Tabla resumen semanal reciente en Home
  renderFinanceHomeTable();
}

function getYesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Tabla inferior con las últimas 8 transacciones visibles en Home
function renderFinanceHomeTable(query) {
  const tbody = document.getElementById('finance-table-body');
  const countEl = document.getElementById('finance-home-count');
  if (!tbody) return;

  let recientes = FinanceDB.getAll()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Filtro de búsqueda
  if (query && query.trim()) {
    const q = query.toLowerCase();
    recientes = recientes.filter(tx =>
      tx.user.toLowerCase().includes(q) ||
      tx.device.toLowerCase().includes(q) ||
      tx.id.toLowerCase().includes(q) ||
      (tx.detail || '').toLowerCase().includes(q)
    );
  } else {
    recientes = recientes.slice(0, 8);
  }

  if (recientes.length === 0) {
    if (countEl) countEl.textContent = '';
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:32px;">
      Sin transacciones registradas aún. Las ventas y cierres de sesión aparecerán aquí.
    </td></tr>`;
    return;
  }

  if (countEl) countEl.textContent = query ? `${recientes.length} resultados` : `Últimas ${recientes.length}`;

  tbody.innerHTML = recientes.map(tx => {
    const hora = new Date(tx.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const fecha = new Date(tx.date).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
    const badge = tx.type === 'session'
      ? `<span class="badge-type session">🎮 Sesión</span>`
      : `<span class="badge-type sale">🛒 Venta</span>`;
    return `<tr>
      <td style="font-size:11px;color:var(--muted);">${tx.id}</td>
      <td>${badge}</td>
      <td>${tx.user}</td>
      <td>${tx.device}${tx.detail ? ` <span style="color:var(--muted);font-size:11px;">(${tx.detail})</span>` : ''}</td>
      <td>${tx.duration > 0 ? `${tx.duration} min` : '—'}</td>
      <td style="font-size:11px;color:var(--muted);">${fecha} ${hora}</td>
      <td style="font-weight:700;color:var(--accent);">$${tx.total.toLocaleString('es-CO')}</td>
    </tr>`;
  }).join('');
}

// ── WIDGET SESIONES ACTIVAS (se inserta al inicio del tab Home) ──
function _actualizarWidgetSesiones() {
  const sesionesActivas = typeof StationDB !== 'undefined'
    ? StationDB.getAll().filter(d => d.status === 'busy').length
    : 0;
  let widgetEl = document.getElementById('finance-active-sessions');
  if (!widgetEl) {
    const home = document.getElementById('finanzas-tab-home');
    if (!home) return;
    widgetEl = document.createElement('div');
    widgetEl.id = 'finance-active-sessions';
    widgetEl.style.cssText = 'margin-bottom:10px;';
    home.insertBefore(widgetEl, home.firstChild);
  }
  widgetEl.innerHTML = sesionesActivas > 0
    ? `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(108,92,231,0.09);border:1px solid rgba(108,92,231,0.25);padding:6px 16px;border-radius:20px;font-size:13px;">
        <span style="width:8px;height:8px;background:#6c5ce7;border-radius:50%;display:inline-block;"></span>
        <strong>${sesionesActivas}</strong> sesión${sesionesActivas !== 1 ? 'es' : ''} activa${sesionesActivas !== 1 ? 's' : ''} en este momento
      </div>`
    : `<div style="display:inline-flex;align-items:center;gap:8px;background:#f5f5f5;padding:6px 16px;border-radius:20px;font-size:13px;color:var(--muted)">
        <i class="bi bi-moon"></i> Sin sesiones activas
      </div>`;
}

// ── BÚSQUEDA GLOBAL DENTRO DE FINANZAS ──
function buscarEnHistorial(query) {
  if (_currentFinanceTab === 'home') {
    renderFinanceHomeTable(query);
  } else if (_currentFinanceTab === 'history') {
    const fecha = document.getElementById('finance-history-date')?.value || getTodayStr();
    renderFinanceHistory(fecha, query);
  }
}

// ─────────────────────────────────────────────────────────────────
// PESTAÑA HISTORIAL — Tabla filtrada por fecha (+ búsqueda opcional)
// ─────────────────────────────────────────────────────────────────
function renderFinanceHistory(dateStr, query) {
  // Actualiza el input date con la fecha seleccionada
  const dateInput = document.getElementById('finance-history-date');
  if (dateInput) dateInput.value = dateStr || getTodayStr();


  // Actualiza el texto de display de fecha
  const displayEl = document.getElementById('finance-history-date-display');
  const dStr = dateStr || getTodayStr();
  if (displayEl) {
    displayEl.textContent = dStr === getTodayStr()
      ? 'Hoy'
      : formatFechaDisplay(dStr);
  }

  const tbody = document.getElementById('finance-history-table-body');
  if (!tbody) return;

  let txs = FinanceDB.getByDate(dStr)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (query && query.trim()) {
    const q = query.toLowerCase();
    txs = txs.filter(tx =>
      String(tx.id).toLowerCase().includes(q) ||
      String(tx.user).toLowerCase().includes(q) ||
      String(tx.device).toLowerCase().includes(q) ||
      String(tx.detail || '').toLowerCase().includes(q)
    );
  }

  if (txs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:40px;">
      <i class="bi bi-inbox" style="font-size:28px;display:block;margin-bottom:8px;"></i>
      Sin transacciones para esta fecha.
    </td></tr>`;
    return;
  }

  let sumaTotal = 0, sumaTiempo = 0, sumaMenu = 0;

  const rows = txs.map(tx => {
    sumaTotal  += tx.total;
    sumaTiempo += tx.timeCost;
    sumaMenu   += tx.itemsCost;
    const hora = new Date(tx.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const badge = tx.type === 'session'
      ? `<span class="badge-type session">🎮 Sesión</span>`
      : `<span class="badge-type sale">🛒 Venta</span>`;
    return `<tr>
      <td style="font-size:11px;color:var(--muted);">${tx.id}</td>
      <td>${badge}</td>
      <td>${tx.user}</td>
      <td>${tx.device}${tx.detail ? ` <small style="color:var(--muted);">(${tx.detail})</small>` : ''}</td>
      <td>$ ${tx.timeCost.toLocaleString('es-CO')}</td>
      <td>$ ${tx.itemsCost.toLocaleString('es-CO')}</td>
      <td style="font-weight:700;color:var(--accent);">$ ${tx.total.toLocaleString('es-CO')}</td>
    </tr>`;
  }).join('');

  // Fila de totales
  const totalRow = `<tr style="background:var(--bg, #f5f5f5);font-weight:600;border-top:2px solid var(--border);">
    <td colspan="4" style="text-align:right;padding-right:12px;">TOTALES DEL DÍA:</td>
    <td>$ ${sumaTiempo.toLocaleString('es-CO')}</td>
    <td>$ ${sumaMenu.toLocaleString('es-CO')}</td>
    <td style="color:var(--accent);">$ ${sumaTotal.toLocaleString('es-CO')}</td>
  </tr>`;

  tbody.innerHTML = rows + totalRow;
}

// ─────────────────────────────────────────────────────────────────
// PESTAÑA GRÁFICAS — Chart.js últimos 7 días
// ─────────────────────────────────────────────────────────────────
function renderFinanceChart() {
  const canvas = document.getElementById('finance-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const data7 = FinanceDB.getLast7Days();
  const labels = Object.keys(data7).map(d => {
    const fecha = new Date(d + 'T12:00:00');
    return fecha.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });
  });
  const valores = Object.values(data7);

  // Destruir chart previo para evitar duplicados
  if (_financeChart) {
    _financeChart.destroy();
    _financeChart = null;
  }

  const ctx = canvas.getContext('2d');

  // Degradado en las barras
  const gradiente = ctx.createLinearGradient(0, 0, 0, 300);
  gradiente.addColorStop(0, 'rgba(108, 92, 231, 0.9)');
  gradiente.addColorStop(1, 'rgba(108, 92, 231, 0.2)');

  _financeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Ingresos ($)',
        data: valores,
        backgroundColor: gradiente,
        borderColor: 'rgba(108, 92, 231, 1)',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `$ ${ctx.parsed.y.toLocaleString('es-CO')}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            callback: v => `$${(v/1000).toFixed(0)}K`
          }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });

  // Tabla resumen de la semana debajo del gráfico
  renderFinanceWeeklySummary(data7);
}

// Tabla de totales semanales debajo del gráfico de barras
function renderFinanceWeeklySummary(data7) {
  let container = document.getElementById('finance-weekly-summary');
  if (!container) {
    const chartTab = document.getElementById('finanzas-tab-charts');
    if (!chartTab) return;
    container = document.createElement('div');
    container.id = 'finance-weekly-summary';
    container.style.cssText = 'margin-top:20px;';
    chartTab.appendChild(container);
  }

  const totalSemana = Object.values(data7).reduce((s, v) => s + v, 0);
  const dias = Object.entries(data7);
  const mejorDia = dias.reduce((best, [d, v]) => v > best[1] ? [d, v] : best, ['', 0]);

  container.innerHTML = `
    <div class="row g-3" style="margin-top:0;">
      <div class="col-md-4">
        <div class="stat-card">
          <div class="stat-label">Total 7 Días</div>
          <div class="stat-value" style="font-size:22px;">$ ${totalSemana.toLocaleString('es-CO')}</div>
          <div class="stat-sub">Ingresos acumulados de la semana</div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="stat-card">
          <div class="stat-label">Promedio Diario</div>
          <div class="stat-value" style="font-size:22px;">$ ${Math.round(totalSemana / 7).toLocaleString('es-CO')}</div>
          <div class="stat-sub">Ingreso promedio por día</div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="stat-card">
          <div class="stat-label">Mejor Día</div>
          <div class="stat-value" style="font-size:22px;">$ ${mejorDia[1].toLocaleString('es-CO')}</div>
          <div class="stat-sub">${mejorDia[0] ? formatFechaDisplay(mejorDia[0]) : 'Sin datos'}</div>
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────
// ESTILOS DINÁMICOS — Badges tipo transacción
// ─────────────────────────────────────────────────────────────────
function _inyectarEstilosFinanzas() {
  if (document.getElementById('finanzas-dynamic-styles')) return;
  const style = document.createElement('style');
  style.id = 'finanzas-dynamic-styles';
  style.textContent = `
    .badge-type {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .badge-type.session {
      background: rgba(108, 92, 231, 0.12);
      color: #6c5ce7;
    }
    .badge-type.sale {
      background: rgba(0, 184, 148, 0.12);
      color: #00b894;
    }
    #finanzas-tab-home .table-header {
      font-size: 14px;
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────
// ARRANQUE DEL MÓDULO
// ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  _inyectarEstilosFinanzas();

  try {
    await FinanceDB.init();
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(`No se pudo cargar finanzas: ${err.message}`, 'error');
    }
  }

  renderFinanceHome();  // Siempre actualiza el Home al cargar

  // Mostrar solo el tab Home al inicio
  ['history', 'charts'].forEach(t => {
    const el = document.getElementById('finanzas-tab-' + t);
    if (el) el.style.display = 'none';
  });

  // Configurar el input de fecha del historial con la fecha de hoy
  const dateInput = document.getElementById('finance-history-date');
  if (dateInput) dateInput.value = getTodayStr();
});

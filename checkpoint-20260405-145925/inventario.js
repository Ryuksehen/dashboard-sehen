// ════════════════════════════════════════════════════════════════════════════════
// NEXUS GAMING - Módulo de Inventario
// ════════════════════════════════════════════════════════════════════════════════

const PRODUCT_CATEGORIES = {
  snacks:   { id: 'snacks', label: 'Snacks' },
  drinks:   { id: 'drinks', label: 'Bebidas' },
  tech:     { id: 'tech', label: 'Tecnología y Periféricos' },
  services: { id: 'services', label: 'Servicios Extra', isInfinite: true }
};

async function productApiRequest(url, options = {}) {
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

const ProductDB = {
  _cache: [],

  async init() {
    const rows = await productApiRequest('/api/inventario');
    this._cache = rows.map(r => ({
      id: String(r.id),
      name: r.name,
      category: r.category,
      price: Number(r.price) || 0,
      stock: r.stock === null ? null : Number(r.stock),
      image_url: r.image_url || '',
      createdAt: r.created_at || null
    }));
    if (typeof renderInventory === 'function') renderInventory();
  },

  getAll() {
    return [...this._cache];
  },

  getById(id) {
    return this._cache.find(p => String(p.id) === String(id)) || null;
  },

  create(data) {
    const tmpId = 'TMP-' + Date.now().toString();
    const newProduct = {
      id: tmpId,
      name: data.name,
      category: data.category,
      price: parseFloat(data.price) || 0,
      stock: PRODUCT_CATEGORIES[data.category]?.isInfinite ? null : (parseInt(data.stock) || 0),
      image_url: data.image_url || '',
      createdAt: new Date().toISOString()
    };

    this._cache.push(newProduct);
    if (typeof renderInventory === 'function') renderInventory();

    productApiRequest('/api/inventario', {
      method: 'POST',
      body: JSON.stringify({
        name: newProduct.name,
        category: newProduct.category,
        price: newProduct.price,
        stock: newProduct.stock,
        image_url: newProduct.image_url || null
      })
    }).then(() => this.init())
      .catch(err => showToast(`Error creando producto: ${err.message}`, 'error'));

    return newProduct;
  },

  update(id, changes) {
    const idx = this._cache.findIndex(p => String(p.id) === String(id));
    if (idx !== -1) {
      // Validar si cambio la categoría a "infinito" para anular el stock
      const newCat = changes.category || this._cache[idx].category;
      if (PRODUCT_CATEGORIES[newCat]?.isInfinite) {
        changes.stock = null;
      }

      this._cache[idx] = { ...this._cache[idx], ...changes };
      if (typeof renderInventory === 'function') renderInventory();

      const realId = parseInt(id, 10);
      if (!Number.isNaN(realId)) {
        productApiRequest(`/api/inventario/${realId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: this._cache[idx].name,
            category: this._cache[idx].category,
            price: this._cache[idx].price,
            stock: this._cache[idx].stock,
            image_url: this._cache[idx].image_url || null
          })
        }).catch(err => showToast(`Error actualizando producto: ${err.message}`, 'error'));
      }

      return this._cache[idx];
    }
    return null;
  },

  delete(id) {
    this._cache = this._cache.filter(p => String(p.id) !== String(id));
    if (typeof renderInventory === 'function') renderInventory();

    const realId = parseInt(id, 10);
    if (!Number.isNaN(realId)) {
      productApiRequest(`/api/inventario/${realId}`, { method: 'DELETE' })
        .catch(err => showToast(`Error eliminando producto: ${err.message}`, 'error'));
    }
  },
  
  addStock(id, amount) {
    const product = this.getById(id);
    if (product && product.stock !== null) {
      const delta = parseInt(amount, 10) || 0;
      if (delta < 1) return;
      const realId = parseInt(id, 10);
      product.stock += delta;
      if (typeof renderInventory === 'function') renderInventory();

      if (!Number.isNaN(realId)) {
        productApiRequest(`/api/inventario/${realId}/stock`, {
          method: 'POST',
          body: JSON.stringify({ cantidad: delta })
        }).catch(err => showToast(`Error actualizando stock: ${err.message}`, 'error'));
      }
    }
  },

  reduceStock(id, amount) {
    const product = this.getById(id);
    if (product && product.stock !== null) {
      const delta = parseInt(amount, 10) || 0;
      const newStock = Math.max(0, product.stock - delta);
      product.stock = newStock;
      if (typeof renderInventory === 'function') renderInventory();

      const realId = parseInt(id, 10);
      if (!Number.isNaN(realId)) {
        productApiRequest(`/api/inventario/${realId}`, {
          method: 'PUT',
          body: JSON.stringify({ stock: newStock })
        }).catch(err => showToast(`Error descontando stock: ${err.message}`, 'error'));
      }

      return newStock >= 0; // retorna true si habia stock
    }
    return true; // si es servicio infinito no falla stock
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ProductDB.init().catch(err => {
    if (typeof showToast === 'function') {
      showToast(`No se pudo cargar inventario: ${err.message}`, 'error');
    }
  });
});

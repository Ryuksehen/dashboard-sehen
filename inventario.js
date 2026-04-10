// en este archivo manejo todo el inventario de productos

// aqui defino las categorias que voy a usar en inventario
const PRODUCT_CATEGORIES = {
  snacks:   { id: 'snacks', label: 'Snacks' },
  drinks:   { id: 'drinks', label: 'Bebidas' },
  tech:     { id: 'tech', label: 'Tecnología y Periféricos' },
  services: { id: 'services', label: 'Servicios Extra', isInfinite: true }
};

// aqui creo una funcion general para hablar con la api de inventario
async function productApiRequest(url, options = {}) {
  // uso await para esperar la respuesta del servidor antes de seguir
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    // uso spread para mezclar opciones nuevas con las que ya vienen
    ...options
  });
  // valido si la respuesta vino mal para lanzar un error claro
  if (!res.ok) {
    let detalle = '';
    try {
      // intento leer el json de error que manda el backend
      const body = await res.json();
      detalle = body.error || '';
    } catch (_e) {
      // caigo aqui si no vino json valido en la respuesta
      detalle = '';
    }
    throw new Error(detalle || `Error API (${res.status})`);
  }
  // manejo 204 porque significa que no viene contenido
  if (res.status === 204) return null;
  // regreso la data en json para que otras funciones la usen
  return res.json();
}

// aqui guardo metodos tipo base de datos en memoria para productos
const ProductDB = {
  _cache: [],

  // inicializo productos desde backend y los guardo en cache local
  async init() {
    const rows = await productApiRequest('/api/inventario');
    // uso map para transformar cada fila del backend a mi formato local
    this._cache = rows.map(r => ({
      id: String(r.id),
      name: r.name,
      category: r.category,
      price: Number(r.price) || 0,
      stock: r.stock === null ? null : Number(r.stock),
      image_url: r.image_url || '',
      createdAt: r.created_at || null
    }));
    // valido que exista la funcion antes de llamarla para evitar errores
    if (typeof renderInventory === 'function') renderInventory();
  },

  // devuelvo una copia del cache para no mutar el original sin querer
  getAll() {
    return [...this._cache];
  },

  // busco un producto por id y comparo en string para evitar choques de tipo
  getById(id) {
    return this._cache.find(p => String(p.id) === String(id)) || null;
  },

  // creo un producto primero en cache y luego lo mando al backend
  create(data) {
    const tmpId = 'TMP-' + Date.now().toString();
    const newProduct = {
      id: tmpId,
      name: data.name,
      category: data.category,
      price: parseFloat(data.price) || 0,
      // uso optional chaining aqui para revisar si la categoria es infinita sin romper la app
      stock: PRODUCT_CATEGORIES[data.category]?.isInfinite ? null : (parseInt(data.stock) || 0),
      image_url: data.image_url || '',
      createdAt: new Date().toISOString()
    };

    // hago insercion optimista para que se vea rapido en pantalla
    this._cache.push(newProduct);
    if (typeof renderInventory === 'function') renderInventory();

    // envio el post al backend y luego refresco cache para sincronizar ids reales
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
  

  // actualizo un producto en cache y luego intento persistir en backend
  update(id, changes) {
    const idx = this._cache.findIndex(p => String(p.id) === String(id));
    if (idx !== -1) {
      // valido si la categoria nueva maneja stock infinito
      const newCat = changes.category || this._cache[idx].category;
      // uso optional chaining otra vez para leer una propiedad opcional sin error
      if (PRODUCT_CATEGORIES[newCat]?.isInfinite) {
        changes.stock = null;
      }

      // uso spread para combinar los cambios con el producto anterior
      this._cache[idx] = { ...this._cache[idx], ...changes };
      if (typeof renderInventory === 'function') renderInventory();

      // convierto el id a numero porque la ruta del backend usa id numerico
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

  // borro producto en cache y despues intento borrarlo en backend
  delete(id) {
    // uso filter para crear un nuevo arreglo sin el producto eliminado
    this._cache = this._cache.filter(p => String(p.id) !== String(id));
    if (typeof renderInventory === 'function') renderInventory();

    const realId = parseInt(id, 10);
    if (!Number.isNaN(realId)) {
      productApiRequest(`/api/inventario/${realId}`, { method: 'DELETE' })
        .catch(err => showToast(`Error eliminando producto: ${err.message}`, 'error'));
    }
  },
  
    // sumo unidades de stock y sincronizo ese cambio con backend
  addStock(id, amount) {
    const product = this.getById(id);
    if (product && product.stock !== null) {
      const delta = parseInt(amount, 10) || 0;
        // corto el flujo si la cantidad no tiene sentido
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

  // descuento stock cuidando que nunca quede negativo
  reduceStock(id, amount) {
    const product = this.getById(id);
    if (product && product.stock !== null) {
      const delta = parseInt(amount, 10) || 0;
      // uso math max para forzar minimo cero y evitar stock negativo
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

      // regreso true para mantener compatible la logica que ya existe
      return newStock >= 0;
    }
    // regreso true tambien cuando es servicio infinito
    return true;
  }
};

// inicializo inventario cuando el html ya termino de cargar
document.addEventListener('DOMContentLoaded', () => {
  // atrapo errores de inicio para avisar con toast y que no se caiga todo
  ProductDB.init().catch(err => {
    if (typeof showToast === 'function') {
      showToast(`No se pudo cargar inventario: ${err.message}`, 'error');
    }
  });
});


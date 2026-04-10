// creo router de inventario separado para mantener orden en endpoints
const router = require('express').Router();
// traigo conexion mysql para ejecutar queries
const db     = require('../db/connection');
// protejo rutas con auth para evitar cambios sin sesion
const { requireAuth } = require('../middleware/auth');

// en este endpoint listo todo el inventario ordenado por categoria e id
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
        id,
        nombre AS name,
        precio AS price,
        existencias AS stock,
        categoria AS category,
        url_imagen AS image_url,
        creado_en AS created_at,
        actualizado_en AS updated_at
       FROM productos
       ORDER BY categoria, id`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

// en este endpoint creo un producto nuevo en base de datos
router.post('/', requireAuth, async (req, res) => {
  const { name, price, stock, category, image_url } = req.body;

  // valido campos minimos para no insertar datos incompletos
  if (!name || price === undefined || stock === undefined || !category)
    return res.status(400).json({ error: 'name, price, stock y category son requeridos' });

  // limito categorias permitidas para evitar datos fuera de catalogo
  if (!['snacks', 'drinks', 'tech', 'services'].includes(category))
    return res.status(400).json({ error: 'Categoría debe ser snacks, drinks, tech o services' });

  try {
    // convierto stock a entero o null cuando es servicio
    const finalStock = stock === null ? null : parseInt(stock);
    const [result] = await db.execute(
      'INSERT INTO productos (nombre, precio, existencias, categoria, url_imagen) VALUES (?,?,?,?,?)',
      [name, parseInt(price), finalStock, category, image_url || null]
    );
    res.status(201).json({ message: 'Producto creado', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// en este endpoint actualizo solo campos que realmente lleguen en el body
router.put('/:id', requireAuth, async (req, res) => {
  const { name, price, image_url } = req.body;
  try {
    // construyo update dinamico con sets y vals para no sobreescribir campos faltantes
    const sets = [];
    const vals = [];
     if (name  !== undefined) { sets.push('nombre = ?');  vals.push(name); }
     if (price !== undefined) { sets.push('precio = ?'); vals.push(parseInt(price)); }
    if (req.body.stock !== undefined) { 
       sets.push('existencias = ?'); 
       vals.push(req.body.stock === null ? null : parseInt(req.body.stock)); 
    }
     if (image_url !== undefined) { sets.push('url_imagen = ?'); vals.push(image_url); }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });

    vals.push(req.params.id);
    const [result] = await db.execute(
      `UPDATE productos SET ${sets.join(', ')} WHERE id = ?`, vals
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

// en este endpoint elimino un producto por id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [result] = await db.execute('DELETE FROM productos WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

// en este endpoint sumo stock sin tocar los otros datos del producto
router.post('/:id/stock', requireAuth, async (req, res) => {
  const cantidad = parseInt(req.body.cantidad);
  // valido que cantidad sea un entero positivo
  if (!cantidad || cantidad < 1)
    return res.status(400).json({ error: 'cantidad debe ser un número mayor a 0' });

  try {
    const [result] = await db.execute(
      'UPDATE productos SET existencias = existencias + ? WHERE id = ?',
      [cantidad, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: `Stock actualizado (+${cantidad})` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar stock' });
  }
});

// exporto el router de inventario para montarlo en server js
module.exports = router;


const router = require('express').Router();
const db     = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

// GET /api/inventario
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM productos ORDER BY category, id');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

// POST /api/inventario
router.post('/', requireAuth, async (req, res) => {
  const { name, price, stock, category, image_url } = req.body;

  if (!name || price === undefined || stock === undefined || !category)
    return res.status(400).json({ error: 'name, price, stock y category son requeridos' });

  if (!['snacks', 'drinks', 'tech', 'services'].includes(category))
    return res.status(400).json({ error: 'Categoría debe ser snacks, drinks, tech o services' });

  try {
    const finalStock = stock === null ? null : parseInt(stock);
    const [result] = await db.execute(
      'INSERT INTO productos (name, price, stock, category, image_url) VALUES (?,?,?,?,?)',
      [name, parseInt(price), finalStock, category, image_url || null]
    );
    res.status(201).json({ message: 'Producto creado', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// PUT /api/inventario/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { name, price, image_url } = req.body;
  try {
    const sets = [];
    const vals = [];
    if (name  !== undefined) { sets.push('name = ?');  vals.push(name); }
    if (price !== undefined) { sets.push('price = ?'); vals.push(parseInt(price)); }
    if (req.body.stock !== undefined) { 
       sets.push('stock = ?'); 
       vals.push(req.body.stock === null ? null : parseInt(req.body.stock)); 
    }
    if (image_url !== undefined) { sets.push('image_url = ?'); vals.push(image_url); }
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

// DELETE /api/inventario/:id
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

// POST /api/inventario/:id/stock  — agregar unidades al stock
router.post('/:id/stock', requireAuth, async (req, res) => {
  const cantidad = parseInt(req.body.cantidad);
  if (!cantidad || cantidad < 1)
    return res.status(400).json({ error: 'cantidad debe ser un número mayor a 0' });

  try {
    const [result] = await db.execute(
      'UPDATE productos SET stock = stock + ? WHERE id = ?',
      [cantidad, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: `Stock actualizado (+${cantidad})` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar stock' });
  }
});

module.exports = router;

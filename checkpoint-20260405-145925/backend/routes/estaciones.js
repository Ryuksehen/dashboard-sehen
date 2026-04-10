const router = require('express').Router();
const db     = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

const VALID_CATS = ['pc', 'ps', 'mobile', 'laptop'];

// ── TARIFAS (definidas antes de /:id para evitar conflictos de ruta) ──

// GET /api/estaciones/tarifas
router.get('/tarifas', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM tarifas');
    const result = {};
    rows.forEach(r => { result[r.category] = r; });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tarifas' });
  }
});

// PUT /api/estaciones/tarifas/:categoria
router.put('/tarifas/:categoria', requireAuth, async (req, res) => {
  if (!VALID_CATS.includes(req.params.categoria))
    return res.status(400).json({ error: 'Categoría inválida' });

  const { hour, frac15, combo1h, combo2h, combo_noche } = req.body;
  try {
    await db.execute(
      `INSERT INTO tarifas (category, hour, frac15, combo1h, combo2h, combo_noche)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         hour = VALUES(hour),
         frac15 = VALUES(frac15),
         combo1h = VALUES(combo1h),
         combo2h = VALUES(combo2h),
         combo_noche = VALUES(combo_noche)`,
      [req.params.categoria, hour ?? 0, frac15 ?? 0, combo1h ?? 0, combo2h ?? 0, combo_noche ?? 0]
    );
    res.json({ message: 'Tarifa actualizada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar tarifa' });
  }
});

// ── ESTACIONES ────────────────────────────────────────

// GET /api/estaciones
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, number, category, status,
              usuario_actual AS user,
              session_start,
              session_mode AS modalidad,
              cart,
              specs,
              created_at, updated_at
       FROM estaciones
       ORDER BY category, id`
    );
    rows.forEach(r => {
      if (typeof r.specs === 'string') r.specs = JSON.parse(r.specs);
      if (typeof r.cart === 'string') r.cart = JSON.parse(r.cart);
      r.startTime = r.session_start ? new Date(r.session_start).getTime() : null;
      delete r.session_start;
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estaciones' });
  }
});

// POST /api/estaciones
router.post('/', requireAuth, async (req, res) => {
  const { id, number, category, specs, status, user, startTime, modalidad, cart } = req.body;

  if (!id || !number || !category)
    return res.status(400).json({ error: 'id, number y category son requeridos' });

  if (!VALID_CATS.includes(category))
    return res.status(400).json({ error: 'Categoría inválida' });

  try {
    await db.execute(
      `INSERT INTO estaciones
      (id, number, category, status, usuario_actual, session_start, session_mode, cart, specs)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        id,
        number,
        category,
        status || 'available',
        user ?? null,
        startTime ? new Date(Number(startTime)) : null,
        modalidad ?? null,
        JSON.stringify(cart || []),
        JSON.stringify(specs || {})
      ]
    );
    res.status(201).json({ message: 'Estación creada', id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: `El ID "${id}" ya existe` });
    console.error(err);
    res.status(500).json({ error: 'Error al crear estación' });
  }
});

// GET /api/estaciones/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, number, category, status,
              usuario_actual AS user,
              session_start,
              session_mode AS modalidad,
              cart,
              specs,
              created_at, updated_at
       FROM estaciones
       WHERE id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Estación no encontrada' });
    const s = rows[0];
    if (typeof s.specs === 'string') s.specs = JSON.parse(s.specs);
    if (typeof s.cart === 'string') s.cart = JSON.parse(s.cart);
    s.startTime = s.session_start ? new Date(s.session_start).getTime() : null;
    delete s.session_start;
    res.json(s);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estación' });
  }
});

// PUT /api/estaciones/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { number, specs, status, user, startTime, modalidad, cart } = req.body;
  const validStatuses = ['available', 'busy', 'maintenance'];
  const validModes = ['hora', '1h', '2h', 'noche'];

  if (status && !validStatuses.includes(status))
    return res.status(400).json({ error: 'Estado inválido' });
  if (modalidad && !validModes.includes(modalidad))
    return res.status(400).json({ error: 'Modalidad inválida' });

  try {
    const sets = [];
    const vals = [];
    if (number !== undefined) { sets.push('number = ?'); vals.push(number); }
    if (specs  !== undefined) { sets.push('specs = ?');  vals.push(JSON.stringify(specs)); }
    if (status !== undefined) { sets.push('status = ?'); vals.push(status); }
    if (user !== undefined) { sets.push('usuario_actual = ?'); vals.push(user); }
    if (startTime !== undefined) {
      sets.push('session_start = ?');
      vals.push(startTime ? new Date(Number(startTime)) : null);
    }
    if (modalidad !== undefined) { sets.push('session_mode = ?'); vals.push(modalidad); }
    if (cart !== undefined) { sets.push('cart = ?'); vals.push(JSON.stringify(cart || [])); }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });

    vals.push(req.params.id);
    const [result] = await db.execute(
      `UPDATE estaciones SET ${sets.join(', ')} WHERE id = ?`, vals
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Estación no encontrada' });
    res.json({ message: 'Estación actualizada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar estación' });
  }
});

// DELETE /api/estaciones/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [result] = await db.execute('DELETE FROM estaciones WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Estación no encontrada' });
    res.json({ message: 'Estación eliminada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar estación' });
  }
});

module.exports = router;

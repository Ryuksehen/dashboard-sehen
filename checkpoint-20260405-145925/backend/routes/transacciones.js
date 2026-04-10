const router = require('express').Router();
const db = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

// GET /api/transacciones
router.get('/', requireAuth, async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, type, device, user, duration, time_cost AS timeCost,
              items_cost AS itemsCost, total, detail, created_at AS date
       FROM transacciones
       ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener transacciones' });
  }
});

// POST /api/transacciones
router.post('/', requireAuth, async (req, res) => {
  const { type, device, user, duration, timeCost, itemsCost, total, detail, date } = req.body;

  try {
    const [result] = await db.execute(
      `INSERT INTO transacciones
       (type, device, user, duration, time_cost, items_cost, total, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        type || 'sale',
        device || '—',
        user || 'Anónimo',
        parseInt(duration, 10) || 0,
        parseInt(timeCost, 10) || 0,
        parseInt(itemsCost, 10) || 0,
        parseInt(total, 10) || 0,
        detail || '',
        date ? new Date(date) : new Date()
      ]
    );

    res.status(201).json({ message: 'Transacción creada', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear transacción' });
  }
});

// DELETE /api/transacciones
router.delete('/', requireAuth, async (_req, res) => {
  try {
    await db.execute('DELETE FROM transacciones');
    res.json({ message: 'Transacciones eliminadas' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al limpiar transacciones' });
  }
});

module.exports = router;

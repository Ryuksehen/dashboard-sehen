// creo router para registrar movimientos de caja y sesiones cobradas
const router = require('express').Router();
// traigo conexion mysql para consultas sql
const db = require('../db/connection');
// exijo autenticacion para leer y escribir transacciones
const { requireAuth } = require('../middleware/auth');

// en este endpoint devuelvo todas las transacciones ordenadas de mas nueva a mas vieja
router.get('/', requireAuth, async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id,
              CASE tipo WHEN 'sesion' THEN 'session' ELSE 'sale' END AS type,
              dispositivo AS device,
              usuario AS user,
              duracion AS duration,
              costo_tiempo AS timeCost,
              costo_items AS itemsCost,
              total,
              detalle AS detail,
              creado_en AS date
       FROM transacciones
       ORDER BY creado_en DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener transacciones' });
  }
});

// en este endpoint guardo una nueva transaccion en la base de datos
router.post('/', requireAuth, async (req, res) => {
  const { type, device, user, duration, timeCost, itemsCost, total, detail, date } = req.body;
  const tipoBd = type === 'session' ? 'sesion' : 'venta';

  try {
    const [result] = await db.execute(
      `INSERT INTO transacciones
       (tipo, dispositivo, usuario, duracion, costo_tiempo, costo_items, total, detalle, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tipoBd,
        device || '—',
        user || 'Anónimo',
        // convierto valores numericos con parseint para evitar que entren strings raros
        parseInt(duration, 10) || 0,
        parseInt(timeCost, 10) || 0,
        parseInt(itemsCost, 10) || 0,
        parseInt(total, 10) || 0,
        detail || '',
        // si no llega fecha uso fecha actual del servidor
        date ? new Date(date) : new Date()
      ]
    );

    res.status(201).json({ message: 'Transacción creada', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear transacción' });
  }
});

// en este endpoint limpio historial completo pensado para pruebas o reinicios
router.delete('/', requireAuth, async (_req, res) => {
  try {
    await db.execute('DELETE FROM transacciones');
    res.json({ message: 'Transacciones eliminadas' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al limpiar transacciones' });
  }
});

// exporto el router para usarlo en el servidor principal
module.exports = router;


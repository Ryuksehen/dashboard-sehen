const router = require('express').Router();
const db     = require('../db/connection');
const { requireAuth } = require('../middleware/auth');

// GET /api/finanzas/resumen?fecha=YYYY-MM-DD
router.get('/resumen', requireAuth, async (req, res) => {
  const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
  try {
    const [[resumen]] = await db.execute(
      `SELECT
         COUNT(*)                          AS total_sesiones,
         COALESCE(SUM(total_pagado),  0)   AS ingresos_totales,
         COALESCE(SUM(total_consumo), 0)   AS ventas_productos,
         COALESCE(SUM(total_tiempo),  0)   AS ingresos_tiempo,
         ROUND(AVG(duracion_min) / 60, 1)  AS promedio_horas
       FROM sesiones
       WHERE estado = 'cerrada' AND DATE(fin) = ?`,
      [fecha]
    );
    res.json(resumen);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

// GET /api/finanzas/sesiones/activas
router.get('/sesiones/activas', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM sesiones WHERE estado = 'activa' ORDER BY inicio DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener sesiones activas' });
  }
});

// GET /api/finanzas/sesiones?fecha=YYYY-MM-DD&limit=50
router.get('/sesiones', requireAuth, async (req, res) => {
  const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  try {
    const [rows] = await db.execute(
      `SELECT
         s.*,
         JSON_ARRAYAGG(
           IF(sp.id IS NOT NULL,
             JSON_OBJECT('producto', p.name, 'cantidad', sp.cantidad, 'precio', sp.precio_unitario),
             NULL
           )
         ) AS consumo_detalle
       FROM sesiones s
       LEFT JOIN sesion_productos sp ON sp.sesion_id = s.id
       LEFT JOIN productos p         ON p.id = sp.producto_id
       WHERE DATE(s.inicio) = ?
       GROUP BY s.id
       ORDER BY s.inicio DESC
       LIMIT ?`,
      [fecha, limit]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener sesiones' });
  }
});

// POST /api/finanzas/sesiones  — iniciar turno
router.post('/sesiones', requireAuth, async (req, res) => {
  const { equipo_id, usuario, modalidad } = req.body;

  if (!equipo_id || !usuario)
    return res.status(400).json({ error: 'equipo_id y usuario son requeridos' });

  const validModalidades = ['por_hora', 'combo1h', 'combo2h', 'combo_noche'];
  const mod = validModalidades.includes(modalidad) ? modalidad : 'por_hora';

  try {
    const [[equipo]] = await db.execute('SELECT * FROM estaciones WHERE id = ?', [equipo_id]);
    if (!equipo)
      return res.status(404).json({ error: 'Equipo no encontrado' });
    if (equipo.status !== 'available')
      return res.status(409).json({ error: 'El equipo no está disponible' });

    const [[activa]] = await db.execute(
      `SELECT id FROM sesiones WHERE equipo_id = ? AND estado = 'activa'`, [equipo_id]
    );
    if (activa)
      return res.status(409).json({ error: 'El equipo ya tiene una sesión activa' });

    const [result] = await db.execute(
      'INSERT INTO sesiones (equipo_id, usuario, modalidad, created_by) VALUES (?,?,?,?)',
      [equipo_id, usuario, mod, req.user.id]
    );
    const modoEstacion = mod === 'por_hora' ? 'hora' : (mod === 'combo_noche' ? 'noche' : mod.replace('combo', ''));
    await db.execute(
      `UPDATE estaciones
       SET status = 'busy', usuario_actual = ?, session_start = NOW(), session_mode = ?, cart = JSON_ARRAY()
       WHERE id = ?`,
      [usuario, modoEstacion, equipo_id]
    );

    res.status(201).json({ message: 'Turno iniciado', sesion_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar turno' });
  }
});

// PUT /api/finanzas/sesiones/:id/cerrar  — cerrar turno
router.put('/sesiones/:id/cerrar', requireAuth, async (req, res) => {
  const { productos } = req.body; // [{ producto_id, cantidad }]

  try {
    const [[sesion]] = await db.execute(
      `SELECT * FROM sesiones WHERE id = ? AND estado = 'activa'`, [req.params.id]
    );
    if (!sesion)
      return res.status(404).json({ error: 'Sesión activa no encontrada' });

    const fin          = new Date();
    const duracion_min = Math.ceil((fin - new Date(sesion.inicio)) / 60000);

    // Calcula costo de tiempo según modalidad y tarifa del equipo
    const [[tarifa]] = await db.execute(
      `SELECT t.* FROM tarifas t
       JOIN estaciones e ON e.category = t.category
       WHERE e.id = ?`,
      [sesion.equipo_id]
    );

    let total_tiempo = 0;
    if (tarifa) {
      switch (sesion.modalidad) {
        case 'combo1h':     total_tiempo = tarifa.combo1h;    break;
        case 'combo2h':     total_tiempo = tarifa.combo2h;    break;
        case 'combo_noche': total_tiempo = tarifa.combo_noche; break;
        default:            total_tiempo = Math.ceil(duracion_min / 15) * tarifa.frac15;
      }
    }

    // Registra consumo de productos
    let total_consumo = 0;
    if (Array.isArray(productos) && productos.length > 0) {
      for (const item of productos) {
        const cantidad = parseInt(item.cantidad);
        if (!cantidad || cantidad < 1) continue;

        const [[prod]] = await db.execute(
          'SELECT * FROM productos WHERE id = ?', [item.producto_id]
        );
        if (!prod) continue;

        await db.execute(
          'INSERT INTO sesion_productos (sesion_id, producto_id, cantidad, precio_unitario) VALUES (?,?,?,?)',
          [sesion.id, prod.id, cantidad, prod.price]
        );
        await db.execute(
          'UPDATE productos SET stock = GREATEST(stock - ?, 0) WHERE id = ?',
          [cantidad, prod.id]
        );
        total_consumo += prod.price * cantidad;
      }
    }

    const total_pagado = total_tiempo + total_consumo;

    await db.execute(
      `UPDATE sesiones
       SET fin=?, duracion_min=?, total_tiempo=?, total_consumo=?, total_pagado=?, estado='cerrada'
       WHERE id=?`,
      [fin, duracion_min, total_tiempo, total_consumo, total_pagado, sesion.id]
    );

    await db.execute(
      `UPDATE estaciones
       SET status = 'available', usuario_actual = NULL, session_start = NULL, session_mode = NULL, cart = NULL
       WHERE id = ?`,
      [sesion.equipo_id]
    );

    res.json({ message: 'Sesión cerrada', duracion_min, total_tiempo, total_consumo, total_pagado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cerrar sesión' });
  }
});

module.exports = router;

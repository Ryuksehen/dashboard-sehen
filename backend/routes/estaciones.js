// creo router para gestionar equipos y tarifas de estaciones
const router = require('express').Router();
// traigo conexion a mysql
const db     = require('../db/connection');
// protejo rutas de estaciones con autenticacion
const { requireAuth } = require('../middleware/auth');

// dejo lista blanca de categorias validas para validar datos de entrada
const VALID_CATS = ['pc', 'ps', 'mobile', 'laptop'];
const MAP_CAT_API_A_BD = { pc: 'pc', ps: 'playstation', mobile: 'movil', laptop: 'portatil' };
const MAP_CAT_BD_A_API = { pc: 'pc', playstation: 'ps', movil: 'mobile', portatil: 'laptop' };
const MAP_ESTADO_API_A_BD = { available: 'disponible', busy: 'ocupado', maintenance: 'mantenimiento' };
const MAP_ESTADO_BD_A_API = { disponible: 'available', ocupado: 'busy', mantenimiento: 'maintenance' };

// dejo rutas de tarifas antes de id para evitar choques con rutas dinamicas

// en este endpoint consulto todas las tarifas por categoria
router.get('/tarifas', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
        categoria,
        precio_hora,
        fraccion_15,
        combo_1h,
        combo_2h,
        combo_noche
       FROM tarifas`
    );
    // transformo arreglo a objeto para acceso directo por categoria en frontend
    const result = {};
    rows.forEach(r => {
      const apiCat = MAP_CAT_BD_A_API[r.categoria];
      if (!apiCat) return;
      result[apiCat] = {
        category: apiCat,
        hour: r.precio_hora,
        frac15: r.fraccion_15,
        combo1h: r.combo_1h,
        combo2h: r.combo_2h,
        combo_noche: r.combo_noche
      };
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tarifas' });
  }
});

// en este endpoint creo o actualizo tarifa segun categoria
router.put('/tarifas/:categoria', requireAuth, async (req, res) => {
  // valido categoria antes de tocar base de datos
  if (!VALID_CATS.includes(req.params.categoria))
    return res.status(400).json({ error: 'Categoría inválida' });

  const { hour, frac15, combo1h, combo2h, combo_noche } = req.body;
  const categoriaBd = MAP_CAT_API_A_BD[req.params.categoria];
  try {
    // uso insert on duplicate key update para hacer upsert en una sola query
    await db.execute(
      `INSERT INTO tarifas (categoria, precio_hora, fraccion_15, combo_1h, combo_2h, combo_noche)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         precio_hora = VALUES(precio_hora),
         fraccion_15 = VALUES(fraccion_15),
         combo_1h = VALUES(combo_1h),
         combo_2h = VALUES(combo_2h),
         combo_noche = VALUES(combo_noche)`,
      [categoriaBd, hour ?? 0, frac15 ?? 0, combo1h ?? 0, combo2h ?? 0, combo_noche ?? 0]
    );
    res.json({ message: 'Tarifa actualizada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar tarifa' });
  }
});

// desde aqui manejo crud de estaciones

// en este endpoint listo todas las estaciones con datos de sesion
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, numero, categoria, estado,
              usuario_actual AS user,
              inicio_sesion,
              modo_sesion AS modalidad,
              carrito,
              especificaciones AS specs,
              creado_en AS created_at,
              actualizado_en AS updated_at
       FROM estaciones
       ORDER BY categoria, id`
    );
    rows.forEach(r => {
      // parseo json de mysql cuando llega como string
      if (typeof r.specs === 'string') r.specs = JSON.parse(r.specs);
      if (typeof r.carrito === 'string') r.carrito = JSON.parse(r.carrito);
      // convierto fecha sql a timestamp para compatibilidad con frontend actual
      r.startTime = r.inicio_sesion ? new Date(r.inicio_sesion).getTime() : null;
      r.number = r.numero;
      r.category = MAP_CAT_BD_A_API[r.categoria] || r.categoria;
      r.status = MAP_ESTADO_BD_A_API[r.estado] || r.estado;
      r.cart = r.carrito;
      delete r.numero;
      delete r.categoria;
      delete r.estado;
      delete r.inicio_sesion;
      delete r.carrito;
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estaciones' });
  }
});

// en este endpoint creo una estacion nueva
router.post('/', requireAuth, async (req, res) => {
  const { id, number, category, specs, status, user, startTime, modalidad, cart } = req.body;

  // valido campos obligatorios
  if (!id || !number || !category)
    return res.status(400).json({ error: 'id, number y category son requeridos' });

  // valido categoria contra lista blanca
  if (!VALID_CATS.includes(category))
    return res.status(400).json({ error: 'Categoría inválida' });

  const categoriaBd = MAP_CAT_API_A_BD[category];
  const estadoBd = MAP_ESTADO_API_A_BD[status || 'available'];

  try {
    await db.execute(
      `INSERT INTO estaciones
      (id, numero, categoria, estado, usuario_actual, inicio_sesion, modo_sesion, carrito, especificaciones)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        id,
        number,
        categoriaBd,
        estadoBd,
        user ?? null,
        // convierto starttime a objeto date solo cuando llega valor
        startTime ? new Date(Number(startTime)) : null,
        modalidad ?? null,
        // serializo arreglos y objetos antes de guardar en columnas json
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

// en este endpoint consulto una sola estacion por id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, numero, categoria, estado,
              usuario_actual AS user,
              inicio_sesion,
              modo_sesion AS modalidad,
              carrito,
              especificaciones AS specs,
              creado_en AS created_at,
              actualizado_en AS updated_at
       FROM estaciones
       WHERE id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Estación no encontrada' });
    const s = rows[0];
    // parseo json y normalizo starttime igual que en listado general
    if (typeof s.specs === 'string') s.specs = JSON.parse(s.specs);
    if (typeof s.carrito === 'string') s.carrito = JSON.parse(s.carrito);
    s.startTime = s.inicio_sesion ? new Date(s.inicio_sesion).getTime() : null;
    s.number = s.numero;
    s.category = MAP_CAT_BD_A_API[s.categoria] || s.categoria;
    s.status = MAP_ESTADO_BD_A_API[s.estado] || s.estado;
    s.cart = s.carrito;
    delete s.numero;
    delete s.categoria;
    delete s.estado;
    delete s.inicio_sesion;
    delete s.carrito;
    res.json(s);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estación' });
  }
});

// en este endpoint actualizo solo los campos que lleguen
router.put('/:id', requireAuth, async (req, res) => {
  const { number, specs, status, user, startTime, modalidad, cart } = req.body;
  const validStatuses = ['available', 'busy', 'maintenance'];
  const validModes = ['hora', '1h', '2h', 'noche'];

  // valido estado y modalidad para evitar valores invalidos
  if (status && !validStatuses.includes(status))
    return res.status(400).json({ error: 'Estado inválido' });
  if (modalidad && !validModes.includes(modalidad))
    return res.status(400).json({ error: 'Modalidad inválida' });

  try {
    // construyo update dinamico con arrays para actualizar solo lo necesario
    const sets = [];
    const vals = [];
    if (number !== undefined) { sets.push('numero = ?'); vals.push(number); }
    if (specs  !== undefined) { sets.push('especificaciones = ?');  vals.push(JSON.stringify(specs)); }
    if (status !== undefined) { sets.push('estado = ?'); vals.push(MAP_ESTADO_API_A_BD[status]); }
    if (user !== undefined) { sets.push('usuario_actual = ?'); vals.push(user); }
    if (startTime !== undefined) {
      sets.push('inicio_sesion = ?');
      // manejo null cuando vienen cierres de sesion
      vals.push(startTime ? new Date(Number(startTime)) : null);
    }
    if (modalidad !== undefined) { sets.push('modo_sesion = ?'); vals.push(modalidad); }
    if (cart !== undefined) { sets.push('carrito = ?'); vals.push(JSON.stringify(cart || [])); }
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

// en este endpoint elimino una estacion por id
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

// exporto el router para conectarlo en server js
module.exports = router;


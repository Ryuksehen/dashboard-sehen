// creo router para gestion de usuarios y aprobaciones
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db     = require('../db/connection');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// middleware personalizado para superusuario
function requireSuperUser(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'superusuario')
      return res.status(403).json({ error: 'Se requiere rol de superusuario' });
    next();
  });
}

// middleware para admin de sede o superusuario
function requireAdminOrSuper(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'superusuario' && req.user.role !== 'admin_sede')
      return res.status(403).json({ error: 'Se requiere rol de administrador' });
    next();
  });
}

// endpoint publico para registro inicial de usuarios
router.post('/register', async (req, res) => {
  const { username, email, password, telefono, documento_identidad, sede_id } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ error: 'username, email y password son requeridos' });

  if (password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

  try {
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      `INSERT INTO usuarios
       (nombre_usuario, correo, hash_contrasena, telefono, documento_identidad, sede_id, estado, rol)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente', 'personal')`,
      [username, email, hash, telefono || null, documento_identidad || null, sede_id || null]
    );
    res.status(201).json({
      message: 'Usuario registrado exitosamente. Pendiente de aprobación.',
      userId: result.insertId
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'El username o email ya existe' });
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// listar usuarios pendientes de aprobacion (para admins)
router.get('/pending', requireAdminOrSuper, async (req, res) => {
  try {
    let query = `
      SELECT u.id, u.nombre_usuario, u.correo, u.telefono, u.documento_identidad,
             u.sede_id, s.nombre as sede_nombre, u.creado_en
      FROM usuarios u
      LEFT JOIN sedes s ON u.sede_id = s.id
      WHERE u.estado = 'pendiente'
    `;
    const params = [];

    // si es admin de sede, solo ve usuarios de su sede
    if (req.user.role === 'admin_sede') {
      query += ' AND u.sede_id = (SELECT sede_id FROM usuarios WHERE id = ?)';
      params.push(req.user.id);
    }

    query += ' ORDER BY u.creado_en DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios pendientes' });
  }
});

// aprobar o rechazar usuario
router.put('/:id/status', requireAdminOrSuper, async (req, res) => {
  const { action, motivo_rechazo } = req.body;
  const userId = req.params.id;

  if (!['aprobar', 'rechazar'].includes(action))
    return res.status(400).json({ error: 'Acción debe ser "aprobar" o "rechazar"' });

  if (action === 'rechazar' && !motivo_rechazo)
    return res.status(400).json({ error: 'Se requiere motivo de rechazo' });

  try {
    // verificar que el usuario existe y esta pendiente
    const [[user]] = await db.execute(
      'SELECT estado, sede_id FROM usuarios WHERE id = ?',
      [userId]
    );

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (user.estado !== 'pendiente')
      return res.status(400).json({ error: 'El usuario ya fue procesado' });

    // verificar permisos: admin de sede solo puede aprobar usuarios de su sede
    if (req.user.role === 'admin_sede' && user.sede_id !== req.user.sede_id) {
      return res.status(403).json({ error: 'No tienes permisos para esta sede' });
    }

    const nuevoEstado = action === 'aprobar' ? 'aprobado' : 'rechazado';
    const [result] = await db.execute(
      `UPDATE usuarios SET
         estado = ?,
         aprobado_por = ?,
         fecha_aprobacion = NOW(),
         motivo_rechazo = ?
       WHERE id = ?`,
      [nuevoEstado, req.user.id, motivo_rechazo || null, userId]
    );

    if (!result.affectedRows)
      return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({
      message: `Usuario ${action === 'aprobar' ? 'aprobado' : 'rechazado'} exitosamente`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar usuario' });
  }
});

// listar todos los usuarios (solo superusuario)
router.get('/', requireSuperUser, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT u.id, u.nombre_usuario, u.correo, u.rol, u.estado, u.telefono,
             u.documento_identidad, u.sede_id, s.nombre as sede_nombre,
             u.aprobado_por, u.fecha_aprobacion, u.motivo_rechazo, u.creado_en,
             ap.nombre_usuario as aprobado_por_nombre
      FROM usuarios u
      LEFT JOIN sedes s ON u.sede_id = s.id
      LEFT JOIN usuarios ap ON u.aprobado_por = ap.id
      ORDER BY u.creado_en DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// actualizar rol de usuario (solo superusuario)
router.put('/:id/role', requireSuperUser, async (req, res) => {
  const { rol, sede_id } = req.body;
  const validRoles = ['superusuario', 'admin_sede', 'personal'];

  if (!validRoles.includes(rol))
    return res.status(400).json({ error: 'Rol inválido' });

  try {
    const [result] = await db.execute(
      'UPDATE usuarios SET rol = ?, sede_id = ? WHERE id = ?',
      [rol, sede_id || null, req.params.id]
    );

    if (!result.affectedRows)
      return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({ message: 'Rol actualizado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
});

// gestionar sedes (solo superusuario)
router.get('/sedes', requireSuperUser, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT s.id, s.nombre, s.direccion, s.telefono, s.admin_principal_id,
             u.nombre_usuario as admin_nombre
      FROM sedes s
      LEFT JOIN usuarios u ON s.admin_principal_id = u.id
      WHERE s.activo = TRUE
      ORDER BY s.nombre
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener sedes' });
  }
});

router.post('/sedes', requireSuperUser, async (req, res) => {
  const { nombre, direccion, telefono } = req.body;

  if (!nombre)
    return res.status(400).json({ error: 'Nombre de sede es requerido' });

  try {
    const [result] = await db.execute(
      'INSERT INTO sedes (nombre, direccion, telefono) VALUES (?, ?, ?)',
      [nombre, direccion || null, telefono || null]
    );
    res.status(201).json({
      message: 'Sede creada exitosamente',
      sedeId: result.insertId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear sede' });
  }
});

router.put('/sedes/:id', requireSuperUser, async (req, res) => {
  const { nombre, direccion, telefono } = req.body;

  if (!nombre)
    return res.status(400).json({ error: 'Nombre de sede es requerido' });

  try {
    const [result] = await db.execute(
      'UPDATE sedes SET nombre = ?, direccion = ?, telefono = ? WHERE id = ? AND activo = TRUE',
      [nombre, direccion || null, telefono || null, req.params.id]
    );

    if (!result.affectedRows)
      return res.status(404).json({ error: 'Sede no encontrada' });

    res.json({ message: 'Sede actualizada exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar sede' });
  }
});

router.delete('/sedes/:id', requireSuperUser, async (req, res) => {
  try {
    // verificar que no haya usuarios asignados a esta sede
    const [users] = await db.execute(
      'SELECT COUNT(*) as count FROM usuarios WHERE sede_id = ?',
      [req.params.id]
    );

    if (users[0].count > 0)
      return res.status(400).json({ error: 'No se puede eliminar sede con usuarios asignados' });

    const [result] = await db.execute(
      'UPDATE sedes SET activo = FALSE WHERE id = ?',
      [req.params.id]
    );

    if (!result.affectedRows)
      return res.status(404).json({ error: 'Sede no encontrada' });

    res.json({ message: 'Sede eliminada exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar sede' });
  }
});

module.exports = router;
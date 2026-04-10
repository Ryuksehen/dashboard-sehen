// creo un router aislado para todo lo de autenticacion
const router  = require('express').Router();
// uso bcrypt para hashear y comparar contraseñas de forma segura
const bcrypt  = require('bcryptjs');
// uso jwt para generar token de sesion al iniciar login
const jwt     = require('jsonwebtoken');
// traigo la conexion a base de datos
const db      = require('../db/connection');

// en este endpoint registro un usuario nuevo
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  // valido campos minimos para no guardar registros incompletos
  if (!username || !email || !password)
    return res.status(400).json({ error: 'username, email y password son requeridos' });

  // pido largo minimo para mejorar seguridad de contraseña
  if (password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

  try {
    // hasheo con 12 rondas que ya es una configuracion segura para backend comun
    const hash     = await bcrypt.hash(password, 12);
    const safeRole = 'personal';
    await db.execute(
      'INSERT INTO usuarios (nombre_usuario, correo, hash_contrasena, rol) VALUES (?,?,?,?)',
      [username, email, hash, safeRole]
    );
    res.status(201).json({ message: 'Usuario creado exitosamente' });
  } catch (err) {
    // detecto duplicados por codigo sql para devolver mensaje claro
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'El username o email ya existe' });
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// en este endpoint valido credenciales y devuelvo token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // valido que lleguen los dos campos basicos del login
  if (!email || !password)
    return res.status(400).json({ error: 'email y password son requeridos' });

  try {
    // busco por email porque en este flujo ese es el identificador de acceso
    const [rows] = await db.execute('SELECT * FROM usuarios WHERE correo = ?', [email]);
    const user   = rows[0];

    // uso el mismo mensaje cuando falla usuario o contraseña para no filtrar datos a atacantes
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    // comparo contraseña plana contra hash almacenado
    const valid = await bcrypt.compare(password, user.hash_contrasena);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    // valido secret antes de firmar para evitar romper el login por mala config
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET no está definido en variables de entorno');
      return res.status(500).json({ error: 'Configuración del servidor incompleta' });
    }

    // firmo el jwt con datos utiles del usuario y expiracion de 8 horas
    const token = jwt.sign(
      { id: user.id, username: user.nombre_usuario, role: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // respondo token y perfil basico para mostrar info en frontend
    res.json({
      token,
      user: { id: user.id, username: user.nombre_usuario, email: user.correo, role: user.rol }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// exporto este router para conectarlo en server js
module.exports = router;


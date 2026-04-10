const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db/connection');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password)
    return res.status(400).json({ error: 'username, email y password son requeridos' });

  if (password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

  try {
    const hash     = await bcrypt.hash(password, 12);
    const safeRole = 'staff';
    await db.execute(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?,?,?,?)',
      [username, email, hash, safeRole]
    );
    res.status(201).json({ message: 'Usuario creado exitosamente' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ error: 'El username o email ya existe' });
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'email y password son requeridos' });

  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    const user   = rows[0];

    // Misma respuesta para usuario no encontrado y contraseña incorrecta (evita user enumeration)
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET no está definido en variables de entorno');
      return res.status(500).json({ error: 'Configuración del servidor incompleta' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;

const jwt = require('jsonwebtoken');

// En entorno local permite trabajar sin login para simplificar la integración del frontend.
const AUTH_DISABLED = String(process.env.AUTH_DISABLED || 'true').toLowerCase() === 'true';

function requireAuth(req, res, next) {
  if (AUTH_DISABLED) {
    req.user = { id: 1, username: 'dev', role: 'admin' };
    return next();
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token requerido' });

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin')
      return res.status(403).json({ error: 'Se requiere rol de administrador' });
    next();
  });
}

module.exports = { requireAuth, requireAdmin };

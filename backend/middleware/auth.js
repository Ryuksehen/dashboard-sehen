// uso jwt para validar tokens de sesion firmados en el login
const jwt = require('jsonwebtoken');

// dejo esta bandera para desarrollo rapido cuando no quiero bloquear el frontend por auth
/* const AUTH_DISABLED = String(process.env.AUTH_DISABLED || 'true').toLowerCase() === 'true'; */
 const AUTH_DISABLED = true
// en este middleware valido si el usuario esta autenticado o no
function requireAuth(req, res, next) {
  // si auth esta desactivado inyecto un usuario de prueba y dejo pasar
  if (AUTH_DISABLED) {
    req.user = { id: 1, username: 'dev', role: 'administrador' };
    return next();
  }

  // leo el header authorization y valido formato bearer
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token requerido' });

  // recorto bearer con slice para quedarme solo con el token
  const token = header.slice(7);
  try {
    // verifico firma y expiracion y guardo payload en req user para usarlo en rutas
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    // respondo 401 cuando token no sirve o esta vencido
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// en este middleware reutilizo requireAuth y ademas pido rol admin
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'administrador' && req.user.role !== 'superusuario' && req.user.role !== 'admin_sede')
      return res.status(403).json({ error: 'Se requiere rol de administrador' });
    next();
  });
}

// exporto los dos middlewares para usarlos segun el nivel de acceso
module.exports = { requireAuth, requireAdmin };


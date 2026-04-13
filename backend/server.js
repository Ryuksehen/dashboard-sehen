// cargo variables de entorno desde el archivo env para usar configuraciones sin quemarlas en codigo
require('dotenv').config();
// importo express para levantar el servidor web
const express  = require('express');
// importo cors para permitir peticiones desde el frontend
const cors     = require('cors');
// importo path para armar rutas de carpetas de forma segura
const path     = require('path');

// separo rutas por modulos para tener el backend ordenado
const authRoutes       = require('./routes/auth');
const estacionRoutes   = require('./routes/estaciones');
const inventarioRoutes = require('./routes/inventario');
const finanzasRoutes   = require('./routes/finanzas');
const transaccionesRoutes = require('./routes/transacciones');
const usuariosRoutes   = require('./routes/usuarios');

// creo la app principal de express
const app = express();

// habilito cors usando origen configurable desde variables de entorno
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
// habilito lectura de json y pongo limite para no recibir cargas gigantes
app.use(express.json({ limit: '10mb' }));

// sirvo el frontend estatico desde la raiz para abrir index html directo desde este servidor
app.use(express.static(path.join(__dirname, '..')));

// conecto cada grupo de endpoints con su modulo correspondiente
app.use('/api/auth',       authRoutes);
app.use('/api/estaciones', estacionRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/finanzas',   finanzasRoutes);
app.use('/api/transacciones', transaccionesRoutes);
app.use('/api/usuarios',   usuariosRoutes);

// devuelvo 404 cuando piden una ruta api que no existe
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// centralizo errores para no repetir try catch de respuesta final en todos lados
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// leo el puerto desde env y uso 3001 como respaldo si no existe configuracion
const PORT = parseInt(process.env.PORT) || 3001;
// arranco el servidor y muestro en consola la url de trabajo
app.listen(PORT, () => {
  console.log(`Nexus Gaming API corriendo en http://localhost:${PORT}`);
});


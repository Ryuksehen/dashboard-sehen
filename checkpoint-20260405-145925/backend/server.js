require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');

const authRoutes       = require('./routes/auth');
const estacionRoutes   = require('./routes/estaciones');
const inventarioRoutes = require('./routes/inventario');
const finanzasRoutes   = require('./routes/finanzas');
const transaccionesRoutes = require('./routes/transacciones');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));

// Sirve el frontend estático desde la carpeta raíz del proyecto
app.use(express.static(path.join(__dirname, '..')));

// Rutas API
app.use('/api/auth',       authRoutes);
app.use('/api/estaciones', estacionRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/finanzas',   finanzasRoutes);
app.use('/api/transacciones', transaccionesRoutes);

// 404 para rutas API desconocidas
app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Manejo centralizado de errores
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Nexus Gaming API corriendo en http://localhost:${PORT}`);
});

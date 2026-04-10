// importo la version promise de mysql2 para poder usar async await
const mysql = require('mysql2/promise');

// creo un pool para reutilizar conexiones y evitar abrir una nueva por cada request
const pool = mysql.createPool({
  // tomo host y puerto desde env y dejo valores por defecto para desarrollo local
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT) || 3306,
  // dejo credenciales por env para no acoplar el backend a una sola maquina
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '123456',
  database:           process.env.DB_NAME     || 'VHO_gaming',
  // configuro limites del pool para balancear rendimiento y consumo
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

// exporto el pool para usarlo en todas las rutas del backend
module.exports = pool;


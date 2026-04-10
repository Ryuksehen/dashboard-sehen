-- VHO Gaming schema mysql en espanol y compatible con el backend actual
-- Ejecutar con mysql -u root -p < backend/db/schema.sql

CREATE DATABASE IF NOT EXISTS VHO_gaming
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE VHO_gaming;

-- tabla de sedes para organizar administradores por ubicacion
CREATE TABLE IF NOT EXISTS sedes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  direccion VARCHAR(255) NULL,
  telefono VARCHAR(20) NULL,
  admin_principal_id INT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_sedes_admin_principal FOREIGN KEY (admin_principal_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- tabla de usuarios para autenticacion
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre_usuario VARCHAR(50) NOT NULL UNIQUE,
  correo VARCHAR(100) NOT NULL UNIQUE,
  hash_contrasena VARCHAR(255) NOT NULL,
  rol ENUM('superusuario', 'admin_sede', 'personal') NOT NULL DEFAULT 'personal',
  estado ENUM('pendiente', 'aprobado', 'rechazado') NOT NULL DEFAULT 'pendiente',
  sede_id INT NULL,
  aprobado_por INT NULL,
  fecha_aprobacion DATETIME NULL,
  motivo_rechazo TEXT NULL,
  telefono VARCHAR(20) NULL,
  documento_identidad VARCHAR(20) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuarios_aprobado_por FOREIGN KEY (aprobado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_usuarios_sede FOREIGN KEY (sede_id) REFERENCES sedes(id) ON DELETE SET NULL
);

-- tabla de estaciones del local
CREATE TABLE IF NOT EXISTS estaciones (
  id VARCHAR(20) PRIMARY KEY,
  numero VARCHAR(10) NOT NULL,
  categoria ENUM('pc', 'playstation', 'movil', 'portatil') NOT NULL,
  estado ENUM('disponible', 'ocupado', 'mantenimiento') NOT NULL DEFAULT 'disponible',
  usuario_actual VARCHAR(100) NULL,
  inicio_sesion DATETIME NULL,
  modo_sesion ENUM('hora', '1h', '2h', 'noche') NULL,
  carrito JSON NULL,
  especificaciones JSON NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_estaciones_categoria_numero UNIQUE (categoria, numero),
  CONSTRAINT chk_estaciones_especificaciones_json CHECK (JSON_VALID(especificaciones)),
  CONSTRAINT chk_estaciones_carrito_json CHECK (carrito IS NULL OR JSON_VALID(carrito))
);

CREATE INDEX idx_estaciones_estado ON estaciones(estado);
CREATE INDEX idx_estaciones_categoria ON estaciones(categoria);

-- tabla de tarifas por categoria
CREATE TABLE IF NOT EXISTS tarifas (
  categoria ENUM('pc', 'playstation', 'movil', 'portatil') PRIMARY KEY,
  precio_hora INT NOT NULL DEFAULT 0,
  fraccion_15 INT NOT NULL DEFAULT 0,
  combo_1h INT NOT NULL DEFAULT 0,
  combo_2h INT NOT NULL DEFAULT 0,
  combo_noche INT NOT NULL DEFAULT 0,
  CONSTRAINT chk_tarifas_no_negativas CHECK (
    precio_hora >= 0 AND fraccion_15 >= 0 AND combo_1h >= 0 AND combo_2h >= 0 AND combo_noche >= 0
  )
);

-- tabla de productos del inventario
CREATE TABLE IF NOT EXISTS productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  precio INT NOT NULL DEFAULT 0,
  existencias INT NULL DEFAULT NULL,
  categoria ENUM('snacks', 'drinks', 'tech', 'services') NOT NULL,
  url_imagen LONGTEXT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_productos_precio_no_negativo CHECK (precio >= 0),
  CONSTRAINT chk_productos_existencias_no_negativo CHECK (existencias IS NULL OR existencias >= 0)
);

CREATE INDEX idx_productos_categoria ON productos(categoria);

-- tabla de sesiones de juego
CREATE TABLE IF NOT EXISTS sesiones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  equipo_id VARCHAR(20) NOT NULL,
  usuario VARCHAR(100) NOT NULL,
  modalidad ENUM('por_hora', 'combo1h', 'combo2h', 'combo_noche') NOT NULL DEFAULT 'por_hora',
  inicio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fin DATETIME NULL,
  duracion_min INT NULL,
  total_tiempo INT NOT NULL DEFAULT 0,
  total_consumo INT NOT NULL DEFAULT 0,
  total_pagado INT NOT NULL DEFAULT 0,
  estado ENUM('activa', 'cerrada') NOT NULL DEFAULT 'activa',
  creado_por INT NULL,
  CONSTRAINT chk_sesiones_no_negativas CHECK (
    (duracion_min IS NULL OR duracion_min >= 0)
    AND total_tiempo >= 0
    AND total_consumo >= 0
    AND total_pagado >= 0
  ),
  CONSTRAINT fk_sesiones_estacion FOREIGN KEY (equipo_id) REFERENCES estaciones(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sesiones_usuario FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX idx_sesiones_estado ON sesiones(estado);
CREATE INDEX idx_sesiones_inicio ON sesiones(inicio);
CREATE INDEX idx_sesiones_equipo_estado ON sesiones(equipo_id, estado);

-- detalle de productos consumidos por sesion
CREATE TABLE IF NOT EXISTS sesion_productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sesion_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario INT NOT NULL,
  CONSTRAINT chk_sesion_productos_no_negativos CHECK (cantidad > 0 AND precio_unitario >= 0),
  CONSTRAINT fk_sesion_productos_sesion FOREIGN KEY (sesion_id) REFERENCES sesiones(id) ON DELETE CASCADE,
  CONSTRAINT fk_sesion_productos_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
);

-- historial financiero usado por frontend de finanzas
CREATE TABLE IF NOT EXISTS transacciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('sesion', 'venta') NOT NULL DEFAULT 'venta',
  dispositivo VARCHAR(30) NOT NULL DEFAULT '—',
  usuario VARCHAR(100) NOT NULL DEFAULT 'Anónimo',
  duracion INT NOT NULL DEFAULT 0,
  costo_tiempo INT NOT NULL DEFAULT 0,
  costo_items INT NOT NULL DEFAULT 0,
  total INT NOT NULL DEFAULT 0,
  detalle VARCHAR(255) NOT NULL DEFAULT '',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_transacciones_no_negativas CHECK (
    duracion >= 0 AND costo_tiempo >= 0 AND costo_items >= 0 AND total >= 0
  )
);

CREATE INDEX idx_transacciones_creado_en ON transacciones(creado_en);
CREATE INDEX idx_transacciones_tipo ON transacciones(tipo);

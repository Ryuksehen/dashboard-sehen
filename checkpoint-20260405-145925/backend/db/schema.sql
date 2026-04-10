-- ════════════════════════════════════════════════════════
-- VHO Gaming — Schema MySQL (estructura limpia)
-- Ejecutar: mysql -u root -p < schema.sql
-- ════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS VHO_gaming
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE VHO_gaming;

-- ── USUARIOS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── ESTACIONES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estaciones (
  id         VARCHAR(20) PRIMARY KEY,
  number     VARCHAR(10) NOT NULL,
  category   ENUM('pc','ps','mobile','laptop') NOT NULL,
  status     ENUM('available','busy','maintenance') NOT NULL DEFAULT 'available',
  usuario_actual VARCHAR(100) NULL,
  session_start DATETIME NULL,
  session_mode ENUM('hora','1h','2h','noche') NULL,
  cart JSON NULL,
  specs      JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_estaciones_category_number UNIQUE (category, number),
  CONSTRAINT chk_estaciones_specs_json CHECK (JSON_VALID(specs)),
  CONSTRAINT chk_estaciones_cart_json CHECK (cart IS NULL OR JSON_VALID(cart))
);

CREATE INDEX idx_estaciones_status ON estaciones(status);
CREATE INDEX idx_estaciones_category ON estaciones(category);

-- ── TARIFAS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tarifas (
  category    ENUM('pc','ps','mobile','laptop') NOT NULL PRIMARY KEY,
  hour        INT NOT NULL DEFAULT 0,
  frac15      INT NOT NULL DEFAULT 0,
  combo1h     INT NOT NULL DEFAULT 0,
  combo2h     INT NOT NULL DEFAULT 0,
  combo_noche INT NOT NULL DEFAULT 0,
  CONSTRAINT chk_tarifas_non_negative CHECK (
    hour >= 0 AND frac15 >= 0 AND combo1h >= 0 AND combo2h >= 0 AND combo_noche >= 0
  )
);

-- ── PRODUCTOS (inventario) ────────────────────────────
CREATE TABLE IF NOT EXISTS productos (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  price      INT NOT NULL DEFAULT 0,
  stock      INT NULL DEFAULT NULL,
  category   ENUM('snacks','drinks','tech','services') NOT NULL,
  image_url  LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_productos_price_non_negative CHECK (price >= 0),
  CONSTRAINT chk_productos_stock_non_negative CHECK (stock IS NULL OR stock >= 0)
);

CREATE INDEX idx_productos_category ON productos(category);

-- ── SESIONES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sesiones (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  equipo_id     VARCHAR(20)  NOT NULL,
  usuario       VARCHAR(100) NOT NULL,
  modalidad     ENUM('por_hora','combo1h','combo2h','combo_noche') NOT NULL DEFAULT 'por_hora',
  inicio        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fin           DATETIME NULL,
  duracion_min  INT NULL,
  total_tiempo  INT NOT NULL DEFAULT 0,
  total_consumo INT NOT NULL DEFAULT 0,
  total_pagado  INT NOT NULL DEFAULT 0,
  estado        ENUM('activa','cerrada') NOT NULL DEFAULT 'activa',
  created_by    INT NULL,
  CONSTRAINT chk_sesiones_non_negative CHECK (
    (duracion_min IS NULL OR duracion_min >= 0)
    AND total_tiempo >= 0
    AND total_consumo >= 0
    AND total_pagado >= 0
  ),
  FOREIGN KEY (equipo_id)  REFERENCES estaciones(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id)      ON DELETE SET NULL
);

CREATE INDEX idx_sesiones_estado ON sesiones(estado);
CREATE INDEX idx_sesiones_inicio ON sesiones(inicio);
CREATE INDEX idx_sesiones_equipo_estado ON sesiones(equipo_id, estado);

-- ── CONSUMO POR SESIÓN ────────────────────────────────
CREATE TABLE IF NOT EXISTS sesion_productos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  sesion_id       INT NOT NULL,
  producto_id     INT NOT NULL,
  cantidad        INT NOT NULL DEFAULT 1,
  precio_unitario INT NOT NULL,
  CONSTRAINT chk_sesion_productos_non_negative CHECK (cantidad > 0 AND precio_unitario >= 0),
  FOREIGN KEY (sesion_id)   REFERENCES sesiones(id)  ON DELETE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
);

-- ── TRANSACCIONES (historial financiero del frontend) ─────────
CREATE TABLE IF NOT EXISTS transacciones (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  type       ENUM('session','sale') NOT NULL DEFAULT 'sale',
  device     VARCHAR(30)  NOT NULL DEFAULT '—',
  user       VARCHAR(100) NOT NULL DEFAULT 'Anónimo',
  duration   INT NOT NULL DEFAULT 0,
  time_cost  INT NOT NULL DEFAULT 0,
  items_cost INT NOT NULL DEFAULT 0,
  total      INT NOT NULL DEFAULT 0,
  detail     VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_transacciones_non_negative CHECK (
    duration >= 0 AND time_cost >= 0 AND items_cost >= 0 AND total >= 0
  )
);

CREATE INDEX idx_transacciones_created_at ON transacciones(created_at);
CREATE INDEX idx_transacciones_type ON transacciones(type);

-- ================================================================
-- IMPORTANTE: Este schema crea la base de datos VACIA (sin seed).
-- Si luego quieres datos de prueba, insértalos manualmente.
-- ================================================================

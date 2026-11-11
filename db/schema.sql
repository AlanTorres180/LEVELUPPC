-- =====================================================================
-- LevelUp PC · Esquema relacional (3FN) · MySQL 8.0.16+ (CHECK activos)
-- Ejecutar con:  npm run db:setup
-- =====================================================================
CREATE DATABASE IF NOT EXISTS levelup_pc
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE levelup_pc;

-- 1. USUARIO -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS USUARIO (
  id_usuario         INT AUTO_INCREMENT PRIMARY KEY,
  correo_electronico VARCHAR(150) NOT NULL UNIQUE,
  clave_acceso       VARCHAR(255) NOT NULL,              -- hash (bcrypt/argon2), nunca texto plano
  fecha_registro     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rol_usuario        VARCHAR(20) NOT NULL DEFAULT 'Cliente',
  estado             VARCHAR(10) NOT NULL DEFAULT 'ACTIVO',  -- borrado lógico
  CONSTRAINT chk_usuario_rol    CHECK (rol_usuario IN ('Cliente','Administrador')),
  CONSTRAINT chk_usuario_estado CHECK (estado IN ('ACTIVO','INACTIVO'))
) ENGINE=InnoDB;

-- 2. CLIENTE (1:1 con USUARIO) ----------------------------------------
CREATE TABLE IF NOT EXISTS CLIENTE (
  id_cliente         INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario         INT NOT NULL UNIQUE,                -- UNIQUE => relación 1:1
  nombre             VARCHAR(100) NOT NULL,
  documento_identidad VARCHAR(20) NULL,
  telefono           VARCHAR(15) NOT NULL,
  direccion_envio    VARCHAR(200) NOT NULL,
  ciudad             VARCHAR(50) NULL,
  CONSTRAINT fk_cliente_usuario FOREIGN KEY (id_usuario)
    REFERENCES USUARIO(id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. CATEGORIA ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS CATEGORIA (
  id_categoria     INT AUTO_INCREMENT PRIMARY KEY,
  slug             VARCHAR(50) NOT NULL UNIQUE,          -- 'graphics-cards' (lo usa el frontend)
  nombre_categoria VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- 4. MARCA -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS MARCA (
  id_marca     INT AUTO_INCREMENT PRIMARY KEY,
  slug         VARCHAR(50) NOT NULL UNIQUE,              -- 'cooler-master'
  nombre_marca VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- 5. PRODUCTO ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS PRODUCTO (
  id_producto     INT AUTO_INCREMENT PRIMARY KEY,
  id_categoria    INT NOT NULL,
  id_marca        INT NOT NULL,
  nombre_producto VARCHAR(255) NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  socket_cpu      VARCHAR(30) NULL,
  vatiaje         INT NULL,
  tipo_ram        VARCHAR(20) NULL,
  stock_disponible INT NOT NULL DEFAULT 0,               -- necesario para RN06 y el checkout
  imagen_url      VARCHAR(500) NULL,
  activo          TINYINT(1) NOT NULL DEFAULT 1,         -- borrado lógico (app_cliente no tiene DELETE)
  CONSTRAINT chk_producto_precio CHECK (precio_unitario > 0),
  CONSTRAINT chk_producto_vatiaje CHECK (vatiaje IS NULL OR vatiaje >= 0),
  CONSTRAINT chk_producto_stock  CHECK (stock_disponible >= 0),
  CONSTRAINT fk_producto_categoria FOREIGN KEY (id_categoria) REFERENCES CATEGORIA(id_categoria),
  CONSTRAINT fk_producto_marca     FOREIGN KEY (id_marca)     REFERENCES MARCA(id_marca),
  INDEX idx_producto_cat_precio (id_categoria, precio_unitario),
  INDEX idx_producto_marca (id_marca)
) ENGINE=InnoDB;

-- 6. COMBO -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS COMBO (
  id_combo          INT AUTO_INCREMENT PRIMARY KEY,
  nombre_combo      VARCHAR(100) NOT NULL,
  precio_total      DECIMAL(12,2) NOT NULL,              -- referencia; el motor recalcula con precios vivos
  nivel_rendimiento VARCHAR(50) NOT NULL,
  activo            TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT chk_combo_precio CHECK (precio_total > 0)
) ENGINE=InnoDB;

-- 7. COMBO_PRODUCTO (N:M) ---------------------------------------------
CREATE TABLE IF NOT EXISTS COMBO_PRODUCTO (
  id_combo    INT NOT NULL,
  id_producto INT NOT NULL,
  cantidad    INT NOT NULL DEFAULT 1,
  PRIMARY KEY (id_combo, id_producto),
  CONSTRAINT chk_cp_cantidad CHECK (cantidad > 0),
  CONSTRAINT fk_cp_combo    FOREIGN KEY (id_combo)    REFERENCES COMBO(id_combo) ON DELETE CASCADE,
  CONSTRAINT fk_cp_producto FOREIGN KEY (id_producto) REFERENCES PRODUCTO(id_producto)
) ENGINE=InnoDB;

-- 8. PEDIDO ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS PEDIDO (
  id_pedido       INT AUTO_INCREMENT PRIMARY KEY,
  id_cliente      INT NOT NULL,
  fecha_pedido    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado_entrega  VARCHAR(30) NOT NULL DEFAULT 'En preparación',
  estado_pago     VARCHAR(20) NOT NULL DEFAULT 'Pendiente',   -- RN03
  valor_total     DECIMAL(12,2) NOT NULL,
  direccion_envio VARCHAR(200) NOT NULL,                      -- copia histórica de la dirección
  CONSTRAINT chk_pedido_estado CHECK (estado_entrega IN ('En preparación','Enviado','Entregado','Cancelado')),
  CONSTRAINT chk_pedido_pago   CHECK (estado_pago IN ('Pendiente','Aprobado','Rechazado')),
  CONSTRAINT chk_pedido_total  CHECK (valor_total > 0),
  CONSTRAINT fk_pedido_cliente FOREIGN KEY (id_cliente) REFERENCES CLIENTE(id_cliente),
  INDEX idx_pedido_cliente (id_cliente)
) ENGINE=InnoDB;

-- 9. DETALLE_PEDIDO ----------------------------------------------------
CREATE TABLE IF NOT EXISTS DETALLE_PEDIDO (
  id_pedido             INT NOT NULL,
  id_producto           INT NOT NULL,
  cantidad              INT NOT NULL,
  precio_unitario_venta DECIMAL(12,2) NOT NULL,          -- precio congelado al vender
  PRIMARY KEY (id_pedido, id_producto),
  CONSTRAINT chk_dp_cantidad CHECK (cantidad > 0),
  CONSTRAINT chk_dp_precio   CHECK (precio_unitario_venta > 0),
  CONSTRAINT fk_dp_pedido   FOREIGN KEY (id_pedido)   REFERENCES PEDIDO(id_pedido) ON DELETE CASCADE,
  CONSTRAINT fk_dp_producto FOREIGN KEY (id_producto) REFERENCES PRODUCTO(id_producto)
) ENGINE=InnoDB;

-- 10. FACTURA (1:1 con PEDIDO) ----------------------------------------
CREATE TABLE IF NOT EXISTS FACTURA (
  id_factura         INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido          INT NOT NULL UNIQUE,                -- 1:1
  fecha_emision      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metodo_pago        VARCHAR(30) NOT NULL,
  numero_comprobante VARCHAR(50) NOT NULL UNIQUE,
  CONSTRAINT chk_factura_metodo CHECK (metodo_pago IN ('Tarjeta de crédito','Tarjeta débito','PSE','Contraentrega')),
  CONSTRAINT fk_factura_pedido FOREIGN KEY (id_pedido) REFERENCES PEDIDO(id_pedido)
) ENGINE=InnoDB;

-- RN04: factura inalterable (ni UPDATE ni DELETE, ni siquiera el admin) --
DROP TRIGGER IF EXISTS trg_factura_no_update;
CREATE TRIGGER trg_factura_no_update BEFORE UPDATE ON FACTURA
  FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN04: las facturas no se pueden modificar';
DROP TRIGGER IF EXISTS trg_factura_no_delete;
CREATE TRIGGER trg_factura_no_delete BEFORE DELETE ON FACTURA
  FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN04: las facturas no se pueden eliminar';

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

-- =====================================================================
-- DATOS INICIALES (generado por db/export-sql.js)
-- =====================================================================
INSERT INTO CATEGORIA (id_categoria, slug, nombre_categoria) VALUES
(1, 'cases', 'Chasis'),
(2, 'power-supplies', 'Fuentes de Poder'),
(3, 'memory', 'Memorias RAM'),
(4, 'monitors', 'Monitores'),
(5, 'peripherals', 'Periféricos'),
(6, 'motherboards', 'Tarjetas Madre'),
(7, 'processors', 'Procesadores'),
(8, 'graphics-cards', 'Tarjetas Gráficas'),
(9, 'storage', 'Almacenamiento');

INSERT INTO MARCA (id_marca, slug, nombre_marca) VALUES
(1, 'corsair', 'Corsair'),
(2, 'cooler-master', 'Cooler Master'),
(3, 'thermaltake', 'Thermaltake'),
(4, 'cougar', 'Cougar'),
(5, 'redragon', 'Redragon'),
(6, 'asus', 'ASUS'),
(7, 'patriot', 'Patriot'),
(8, 'adata', 'ADATA'),
(9, 'lg', 'LG'),
(10, 'samsung', 'Samsung'),
(11, 'aoc', 'AOC'),
(12, 'dell', 'Dell'),
(13, 'hp', 'HP'),
(14, 'msi', 'MSI'),
(15, 'gigabyte', 'Gigabyte'),
(16, 'acer', 'Acer'),
(17, 'viewsonic', 'Viewsonic'),
(18, 'logitech', 'Logitech'),
(19, 'razer', 'Razer'),
(20, 'attackshark', 'Attackshark'),
(21, 'intel', 'Intel'),
(22, 'amd', 'AMD'),
(23, 'nvidia', 'NVIDIA');

INSERT INTO PRODUCTO (id_producto, id_categoria, id_marca, nombre_producto, precio_unitario, socket_cpu, vatiaje, tipo_ram, stock_disponible, imagen_url, activo) VALUES
(1, 1, 1, 'Chasis Corsair 4000D Airflow ATX Mid Tower', 510000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_850900-MLA43939869555_102020-O.webp', 1),
(2, 1, 1, 'Chasis Corsair 5000D Airflow ATX Mid Tower', 620000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_840721-MLA93873319386_102025-O.webp', 1),
(3, 1, 1, 'Chasis Corsair iCUE 7000X RGB Full Tower', 900000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_662193-MLU78018021213_072024-O.webp', 1),
(4, 1, 2, 'Chasis Cooler Master MasterBox NR200 Mini-ITX', 445000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_989852-MLA94292566137_102025-B.webp', 1),
(5, 1, 2, 'Chasis Cooler Master TD500 Mesh ATX Mid Tower', 480000, NULL, NULL, NULL, 80, 'https://compugamercol.com/wp-content/uploads/2022/09/CHASIS-Cooler-Master-MasterBox-TD500-Mesh-White-0.webp', 1),
(6, 1, 2, 'Chasis Cooler Master MasterBox Q300L ATX Vidrio Templado', 315000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_653908-MLA95519197736_102025-O.webp', 1),
(7, 1, 3, 'Chasis Thermaltake Divider 300 TG Mid Tower Negro', 490000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_917663-MCO49809519138_042022-O.webp', 1),
(8, 1, 3, 'Chasis Thermaltake Versa H18 Micro ATX Vidrio Templado', 295000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_874349-MLA94291382459_102025-O.webp', 1),
(9, 1, 3, 'Chasis Thermaltake View 270 Plus TG ARGB Mid Tower', 420000, NULL, NULL, NULL, 80, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTgo8CbeecvXgY6Rpe7NBdG0WQ2pcUZOFBuSw&s', 1),
(10, 1, 4, 'Chasis Cougar MX330-G ATX Vidrio Templado', 380000, NULL, NULL, NULL, 80, 'https://cougargaming.com/global/img/products/cases/mx330_g/product-image.png', 1),
(11, 1, 4, 'Chasis Cougar Panzer Mid Tower Gamer', 550000, NULL, NULL, NULL, 80, 'https://static.tweaktown.com/content/9/0/9022_33_cougar-panzer-mid-tower-chassis-review.jpg', 1),
(12, 1, 4, 'Chasis Cougar MX440 Mesh ATX Mid Tower', 315000, NULL, NULL, NULL, 80, 'https://cougargaming.com/_cgrwdr_/wwdpp/wp-content/uploads/2020/08/05-2-1.png', 1),
(13, 1, 5, 'Chasis Redragon Reflect Flow CA606 ATX Gaming PC Case', 656000, NULL, NULL, NULL, 80, 'https://redragonshop.com/cdn/shop/files/RedragonCA606GamingBack-MountedPCCase_2.png?v=1732955431&width=1946', 1),
(14, 1, 5, 'Chasis Redragon Grapple Mid Tower RGB', 260000, NULL, NULL, NULL, 80, 'https://img.terabyteshop.com.br/produto/g/gabinete-gamer-redragon-grapple-mid-tower-s-fan-vidro-temperado-black-s-fonte-gc-607-bk_107502.jpg', 1),
(15, 1, 5, 'Chasis Redragon Snow M-ATX Gaming PC Case', 295000, NULL, NULL, NULL, 80, 'https://m.media-amazon.com/images/I/71DGwysHeqL.jpg', 1),
(16, 2, 1, 'Fuente de poder Corsair CV550 550W 80 Plus Bronze', 270000, NULL, 550, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_814980-MCO43037233861_082020-O.webp', 1),
(17, 2, 1, 'Fuente de poder Corsair RM750e 750W 80 Plus Gold', 460000, NULL, 750, NULL, 80, 'https://s3-sa-east-1.amazonaws.com/saasargentina/EFPfyOzuQ7726IDrdRpS/imagen', 1),
(18, 2, 1, 'Fuente de poder Corsair HX1000 1000W 80 Plus Platinum', 850000, NULL, 1000, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_837264-MLU70509326826_072023-O.webp', 1),
(19, 2, 2, 'Fuente de poder Cooler Master MWE 550W 80 Plus Bronze', 250000, NULL, 550, NULL, 80, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQY0hJD2y5y1UdxUNwXazBdjEbLQncq8DVgSQ&s', 1),
(20, 2, 2, 'Fuente de poder Cooler Master MWE Gold 750W Full Modular', 430000, NULL, 750, NULL, 80, 'https://media.falabella.com/falabellaCO/148353201_01/w=800,h=800,fit=pad', 1),
(21, 2, 2, 'Fuente de poder Cooler Master V850 850W 80 Plus Gold', 570000, NULL, 850, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_826075-MLU75097515362_032024-O.webp', 1),
(22, 2, 3, 'Fuente de poder Thermaltake Smart 600W 80 Plus White', 280000, NULL, 600, NULL, 80, 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQgNlN4iTzREw-FL1ZiHqX-Uvzq74HQtKk7CA&s', 1),
(23, 2, 3, 'Fuente de poder Thermaltake Toughpower GX2 600W 80 Plus Gold', 340000, NULL, 600, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_686736-MLA93857232222_102025-O.webp', 1),
(24, 2, 3, 'Fuente de poder Thermaltake Toughpower GF1 750W 80 Plus Gold', 460000, NULL, 750, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_983375-MLU54970737426_042023-O.webp', 1),
(25, 2, 6, 'Fuente de poder ASUS TUF Gaming 550W 80 Plus Bronze', 310000, NULL, 550, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_909731-MCO49604197785_042022-O.webp', 1),
(26, 2, 6, 'Fuente de poder ASUS TUF Gaming 650W 80 Plus Bronze', 350000, NULL, 650, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_741717-MCO44826703496_022021-O.webp', 1),
(27, 2, 6, 'Fuente de poder ASUS ROG Strix 750W 80 Plus Gold Modular', 520000, NULL, 750, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_677660-CBT79210969431_092024-O.webp', 1),
(28, 2, 5, 'Fuente de poder Redragon RGPS 500W 80 Plus Bronze', 230000, NULL, 500, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_888756-MCO44668307005_012021-O.webp', 1),
(29, 2, 5, 'Fuente de poder Redragon RGPS 700W 80 Plus Bronze', 280000, NULL, 700, NULL, 80, 'https://redragon.es/content/uploads/2021/05/700-M.png', 1),
(30, 2, 5, 'Fuente de poder Redragon RGPS 850W 80 Plus Gold', 360000, NULL, 850, NULL, 80, 'https://www.idcmayoristas.com/wp-content/uploads/2024/10/redragon-gc-ps010-80-plus-gold-850w-atx-modular-gc-ps010-lal-5.png', 1),
(31, 3, 1, 'Memoria RAM Corsair Vengeance LPX 16GB (2x8GB) DDR4 3200MHz', 380000, NULL, NULL, 'DDR4', 80, 'https://http2.mlstatic.com/D_NQ_NP_690295-MLA95404589144_102025-O.webp', 1),
(32, 3, 1, 'Memoria RAM Corsair Vengeance LPX 32GB (2x16GB) DDR4 3200MHz', 720000, NULL, NULL, 'DDR4', 80, 'https://http2.mlstatic.com/D_NQ_NP_918190-MCO43423401188_092020-O.webp', 1),
(33, 3, 7, 'Memoria RAM Patriot Viper Steel 16GB (2x8GB) DDR4 3400MHz', 355000, NULL, NULL, 'DDR4', 80, 'https://http2.mlstatic.com/D_NQ_NP_963563-MCO81609666400_012025-O.webp', 1),
(34, 3, 7, 'Memoria RAM Patriot Viper Steel 32GB (2x16GB) DDR4 3600MHz', 650000, NULL, NULL, 'DDR4', 80, 'https://http2.mlstatic.com/D_NQ_NP_965302-MCO47784251849_102021-O.webp', 1),
(35, 3, 8, 'Memoria RAM ADATA XPG Gammix D35 16GB (2x8GB) DDR4 3200MHz', 370000, NULL, NULL, 'DDR4', 80, 'https://http2.mlstatic.com/D_NQ_NP_833918-MCO76040767730_052024-O.webp', 1),
(36, 3, 8, 'Memoria RAM ADATA XPG Gammix D35 32GB (2x16GB) DDR4 3600MHz', 680000, NULL, NULL, 'DDR4', 80, 'https://img.pccomponentes.com/articles/1080/10805487/4531-adata-xpg-gammix-d35-ddr4-3600mhz-32gb-2x16gb-negro-especificaciones.jpg', 1),
(37, 3, 1, 'Memoria RAM Corsair Vengeance RGB Pro 16GB (2x8GB) DDR4 3600MHz', 410000, NULL, NULL, 'DDR4', 80, 'https://http2.mlstatic.com/D_NQ_NP_807808-MLU71842224724_092023-O.webp', 1),
(38, 3, 1, 'Memoria RAM Corsair Vengeance RGB Pro 32GB (2x16GB) DDR4 3600MHz', 750000, NULL, NULL, 'DDR4', 80, 'https://http2.mlstatic.com/D_NQ_NP_684097-CBT53449178804_012023-O.webp', 1),
(39, 3, 7, 'Memoria RAM Patriot Viper Elite II 16GB (2x8GB) DDR4 3200MHz', 340000, NULL, NULL, 'DDR4', 80, 'https://www.tradeinn.com/f/13920/139205679/patriot-memoria-ram-viper-elite-ii-16gb-2x8gb-ddr4-3200mhz.webp', 1),
(40, 3, 7, 'Memoria RAM Patriot Viper Elite II 32GB (2x16GB) DDR4 3200MHz', 620000, NULL, NULL, 'DDR4', 80, 'https://http2.mlstatic.com/D_NQ_NP_757046-MCO83383691365_032025-O.webp', 1),
(41, 3, 8, 'Memoria RAM ADATA XPG D50 16GB (2x8GB) DDR4 3600MHz RGB', 365000, NULL, NULL, 'DDR4', 80, 'https://www.quorumsystem.com.co/wp-content/uploads/2024/02/productGallery215.png', 1),
(42, 3, 8, 'Memoria RAM ADATA XPG D50 32GB (2x16GB) DDR4 3600MHz RGB', 700000, NULL, NULL, 'DDR4', 80, 'https://m.media-amazon.com/images/I/51chbyj1YTL.AC_SX679.jpg', 1),
(43, 3, 1, 'Memoria RAM Corsair Vengeance LPX 32GB (2x16GB) DDR5 6000MHz', 950000, NULL, NULL, 'DDR5', 80, 'https://http2.mlstatic.com/D_NQ_NP_2X_935167-MLU73129844372_122023-F.webp', 1),
(44, 3, 8, 'Memoria RAM ADATA XPG Lancer 32GB (2x16GB) DDR5 6000MHz RGB', 890000, NULL, NULL, 'DDR5', 80, 'https://m.media-amazon.com/images/I/51oNTYOhLeL.AC_SX355.jpg', 1),
(45, 3, 7, 'Memoria RAM Patriot Viper Venom RGB 32GB (2x16GB) DDR5 6000MHz', 920000, NULL, NULL, 'DDR5', 80, 'https://http2.mlstatic.com/D_Q_NP_974635-MLA80736486230_112024-O.webp', 1),
(46, 4, 9, 'Monitor LG UltraGear 24GN600-B 24'''' Full HD 144Hz 1ms', 720000, NULL, NULL, NULL, 80, 'https://www.mrpc.com.co/wp-content/uploads/2023/09/001-58.jpg', 1),
(47, 4, 10, 'Monitor Samsung Odyssey G3 24'''' Full HD 165Hz', 850000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_920268-MLA95958514067_102025-O.webp', 1),
(48, 4, 6, 'Monitor ASUS TUF Gaming VG259QR 24.5'''' 165Hz 1ms', 870000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_729870-MLA91843298477_092025-B.webp', 1),
(49, 4, 11, 'Monitor AOC 24G2SPU 24'''' Full HD 165Hz 1ms', 830000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_959986-MCO76681485229_052024-O.webp', 1),
(50, 4, 12, 'Monitor Dell SE2722H 27'''' Full HD 75Hz', 780000, NULL, NULL, NULL, 80, 'https://computechstore.in/wp-content/uploads/2023/02/Dell-27-SE2722H-1.jpg', 1),
(51, 4, 13, 'Monitor HP X24ih 24'''' Full HD 144Hz IPS', 740000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_788342-MPE47718119298_092021-O.webp', 1),
(52, 4, 14, 'Monitor MSI G24C6P 24'''' Curvo Full HD 165Hz', 890000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_882979-MCO47951513383_102021-O.webp', 1),
(53, 4, 15, 'Monitor Gigabyte G27F 27'''' Full HD 144Hz IPS', 950000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_828759-MLA45731320593_042021-O.webp', 1),
(54, 4, 16, 'Monitor Acer Nitro VG240Y 24'''' Full HD 75Hz IPS', 680000, NULL, NULL, NULL, 80, 'https://exitocol.vteximg.com.br/arquivos/ids/18199836/monitor-gamer-acer-nitro-24-pulgadas-full-hd-75-hz-1-ms-vg240y.jpg?v=638183174878170000', 1),
(55, 4, 17, 'Monitor ViewSonic XG2405 24'''' Full HD 144Hz IPS', 910000, NULL, NULL, NULL, 80, 'https://m.media-amazon.com/images/I/61o0UwxQ11L.AC_UF894,1000_QL80.jpg', 1),
(56, 4, 9, 'Monitor LG 32UN500-W 32'''' 4K UHD HDR10', 1550000, NULL, NULL, NULL, 80, 'https://m.media-amazon.com/images/I/71V9R7esdxL.jpg', 1),
(57, 4, 10, 'Monitor Samsung Odyssey G5 32'''' QHD Curvo 165Hz', 1850000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_601890-MCO89358320686_082025-O.webp', 1),
(58, 4, 6, 'Monitor ASUS ProArt Display PA278QV 27'''' QHD IPS', 1350000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_744206-MLA95648445061_102025-O.webp', 1),
(59, 4, 12, 'Monitor Dell Alienware AW2523HF 25'''' 360Hz', 2100000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_955445-CBT85683501080_062025-O.webp', 1),
(60, 4, 14, 'Monitor MSI Optix MAG342CQR 34'''' Ultrawide Curvo QHD 144Hz', 2450000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_NQ_NP_932147-MLA95631182047_102025-O.webp', 1),
(61, 5, 18, 'Logitech G502 Lightspeed, Mouse Gamer Inalámbrico / 25600dpi Color Negro', 550000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_845790-MLA96090565777_102025-L.webp', 1),
(62, 5, 18, 'Logitech G305, Mouse Gamer Inalámbrico / 12000dpi - Negro Color Black', 200000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_853062-MLA96151905597_102025-L.webp', 1),
(63, 5, 18, 'Logitech G733, Diadema Gamer Rgb Inalámbrica', 780000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_828712-MLA95645753686_102025-B.webp', 1),
(64, 5, 18, 'Teclado Logitech G Serie G QWERTY Romer-G inglés internacional color negro con luz RGB', 195000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_863666-MLA95843493597_102025-B.webp', 1),
(65, 5, 18, 'Teclado Inalámbrico Logitech G Pro X 60 Lightspeed Negro', 680000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_700435-MLA95398524416_102025-B.webp', 1),
(66, 5, 19, 'Mouse Razer Viper V3 Hyperspeed 30k Dpi 280h Inalambrico', 370000, NULL, NULL, NULL, 80, 'https://backoffice.max.com.gt/media/catalog/product/cache/94dd7777337ccc7ac42c8ee85d48fab6/R/Z/RZ0104650100_3.jpg', 1),
(67, 5, 19, 'Razer Basilisk V3 - Mouse Chroma Rgb Ligh Color Classic black', 193000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_767359-MLA93082762568_092025-B.webp', 1),
(68, 5, 19, 'Auriculares Razer Blackshark V2 X Gaming', 190000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_697962-MLA95837345411_102025-B.webp', 1),
(69, 5, 19, 'Razer Ornata V3 X Teclado Gamer Meca-membrana Rgb', 160000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_772295-MLA95839208515_102025-B.webp', 1),
(70, 5, 19, 'Combo Razer 3 En 1 Gamming Bundle Teclado Mouse Y Pad Mouse Negro Inglés Internacional', 140000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_740624-MCO92673555913_092025-B.webp', 1),
(71, 5, 20, 'Mouse Inalámbrico Para Juegos Attack Shark X6 26k Dpi Rgb Wh', 270000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_955718-CBT81652823015_122024-B.webp', 1),
(72, 5, 20, 'Mouse Gamer X11 Attack Shark Tri Mode 22000 dpi Paw3311 Dock Color Negro', 150000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_936423-MLA95398405208_102025-B.webp', 1),
(73, 5, 20, 'Teclado Mecanico A.jazz Attack Shark Ak820 Pro 75% Negro', 375000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_667271-CBT81231003488_122024-B.webp', 1),
(74, 5, 20, 'Teclado Para Juegos A.jazz Attack Shark Ak820 Pro Wireless P', 455000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_606118-CBT81746197049_012025-B.webp', 1),
(75, 5, 20, 'Attack Shark X65pro He Y X11 Combo De Juegos-efecto Hall & 8', 690000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_714245-CBT93120334051_092025-B.webp', 1),
(76, 6, 6, 'Mother Asus Rog Strix B250g Gaming Lga 1151 Ddr4', 305400, 'LGA1151', NULL, 'DDR4', 80, 'https://http2.mlstatic.com/D_Q_NP_668331-CBT96680537874_112025-L.webp', 1),
(77, 6, 6, 'Board Asrock B860m Pro A Wifi 6e - Negro', 845000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_668331-CBT96680537874_112025-L.webp', 1),
(78, 6, 14, 'Placa Madre Msi Mpg B550 Gaming Plus, Atx, Am4, Pcie 4.0', 628000, 'AM4', NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_862331-CBT70232660582_072023-L.webp', 1),
(79, 6, 15, 'Placa Madre Gigabyte Amd B850 Gaming Wifi 6 Color Negro', 975000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_729357-MLA95959336193_102025-L.webp', 1),
(80, 6, 6, 'Tarjeta Madre Asus Rog Strix B650-a Gaming Wifi 6e Usb C', 1069200, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_795590-MLA96080475507_102025-L.webp', 1),
(81, 6, 15, 'Gigabyte B650 Aorus Elite Ax (am5/ Lga 1718/ Amd B650', 1001200, 'AM5', NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_944532-CBT76901443485_062024-L.webp', 1),
(82, 6, 6, 'Placa Madre Asrock Z790 Pro Rs Wifi Intel Lga1700 Ddr5', 1035000, 'LGA1700', NULL, 'DDR5', 80, 'https://http2.mlstatic.com/D_Q_NP_734467-CBT81477070697_122024-L.webp', 1),
(83, 6, 14, 'Placa Msi Mag Z790 Tomahawk Max Wifi Pro D5 Lga 1700 Atx Color Negro', 1410000, 'LGA1700', NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_795590-MLA96080475507_102025-L.webp', 1),
(84, 6, 15, 'Placa Madre Gigabyte B650e Aorus Elite X Ax Ice Am5 Lga 1718', 985600, 'AM5', NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_665050-CBT79919404141_102024-L.webp', 1),
(85, 6, 6, 'Asus Rog Maximus Z790 Hero Wifi6e Lga 1700(intel 14th', 4242000, 'LGA1700', NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_932815-CBT74327768467_012024-L.webp', 1),
(86, 6, 15, 'Placa Madre Gigabyte Z890 Aorus Master, Atx, Ddr5', 2196000, NULL, NULL, 'DDR5', 80, 'https://http2.mlstatic.com/D_Q_NP_932815-CBT74327768467_012024-L.webp', 1),
(87, 6, 6, 'Asus Rog Maximus Z890 Hero Intel® Z890 Lga 1851 Atx', 2296300, 'LGA1851', NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_829502-CBT82992688406_032025-L.webp', 1),
(88, 6, 14, 'Msi Meg X870e Godlike, E-atx - Soporta Amd Ryzen', 6203800, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_716379-CBT83876267735_042025-L.webp', 1),
(89, 6, 14, 'Placa Base Msi Mag X870, Wifi7, Am5, Pcie 5.0, Ddr5, Atx', 1548800, 'AM5', NULL, 'DDR5', 80, 'https://http2.mlstatic.com/D_Q_NP_681881-CBT83282339055_032025-L.webp', 1),
(90, 6, 14, 'Placa Base Para Juegos Msi Mag B550 Tomahawk Max Wifi', 923000, NULL, NULL, NULL, 80, 'https://http2.mlstatic.com/D_Q_NP_908387-CBT71945863728_092023-L.webp', 1),
(91, 7, 21, 'PROCESADOR INTEL CORE I3-12100F 4.30 GHZ', 975000, NULL, NULL, NULL, 80, 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcTAlyF3yeEEd-o3ZBj-cwsT2vdvp_LSO8kwCn85Q6vPBU1EkJRdgSnn0YdVhn6LYVGNj-J-Y4Jxj4pHJcG2Y2eh9ob1WiagknFcNMyeOMhRLRGhluDg5xld3Q', 1),
(92, 7, 21, 'Procesador Intel Core i5-12400 1700', 895000, NULL, NULL, NULL, 80, 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcQXvR2xoV5Vbukehex1IkIwqd6RaDQ2826SOLlZJ5AttfmT7zh8W3nCdwbCFxq6VxkcoJg3lFbWZUc98PNSlFm_35yK_BG7sh1Ah2tljC9-_eNVPX1uvHZ_d1Q', 1),
(93, 7, 21, 'Procesador Intel Core i7-10700K 3.8 GHz', 1943200, NULL, NULL, NULL, 80, 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcTwHT_wXM6qg3htYfkKgP_fmT-MVBpVAJoKmm70tqDRV_MAGaYUkMjAHT57wMfBN_-OC5EGAeTZGNR4ZIgcsihr6Ew_0so2aK5Z6MtaOFbr2eEojIPw3kLG', 1),
(94, 7, 21, 'Procesador Intel Core I7 12700F', 1837000, NULL, NULL, NULL, 80, 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcR0MIbGEMuzubb9GnI6Ex6KMqy6Ztlyk91MvDDahyp9nblmEsjkg6QT-fnHntScRqgLVLOa-W5uY-UkUGuYe1KisnlZ1V-5WYyXihW4_dc-ooPDVLrdbpYq', 1),
(95, 7, 21, 'Procesador Intel Core i9‑13900K', 1872600, NULL, NULL, NULL, 80, 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSCHnuIwIjrdB7_qFKr7fD68k4ia4gpHC0W2MmtdtQ_1BWT_HgUopho6FOnKCNhF_InxwinJjrf3uqYzoi6qORqvRXu9IPXhp3ZCyXKMpbXLQLV7YoovyqK', 1),
(96, 7, 21, 'Procesador Intel Core i7-12700K 1700', 1051000, NULL, NULL, NULL, 80, 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcTa-IKeEYSle2P7go25N-mMY0OQuAz4YjbSTwOFlFwOXed9XQ8Pv2bvhGCecOMwIARR1JbDJS274wkN1EutMf4LAxVvM7_BWG3oMK3CAf0ofpLHcdihSZ-gPg', 1),
(97, 7, 21, 'Procesador Intel Ultra 7 265f', 1510000, NULL, NULL, NULL, 80, 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcRdlPou4GFme5I7CNIzH0C2GtYrwEmcH-6fL1L5tFbIlzPh8zYhPVkkgR4PGADqqjns3QD-0BCOrnalgppsU8jVpN_fz2LPO26MaAQiknUe', 1),
(98, 7, 22, 'Procesador Amd Ryzen 5 7600x Am5', 799000, 'AM5', NULL, NULL, 80, 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcQelFi5sShjQnTe0CrgVRu1AtKC_5KOfvqkEi2xXIjiNadjFvKozAxnh2reN7J9vx9OeKR8Vj-N0JEugR60L_Cwj_KnPSmsTayftgAKtHb90IZvSWD6B1PCWNk', 1),
(99, 7, 22, 'Procesador Amd Ryzen 7 5700G', 1279000, 'AM4', NULL, NULL, 80, 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcTmalcrC4QhmRxnFVgylwRpRdr3isZkSj5ADJgKyCNeTC2mRzk-iRi1_oCTMgEtVUHWdtWn_-Bib5ZdxxQl_lmpv80UHPXiQxzXjwEFnA9L-6JdkBl4-M2D3cM', 1),
(100, 7, 22, 'Procesador Amd Ryzen 7 5800X', 1027000, 'AM4', NULL, NULL, 80, 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcR4rw9p_wTXFbEoDeTkQRNM_6a9mDmapxEXAv6LKI8jZuEySnunAOq9UvQd6P2P1rYXSzqIDnG1Avvaoy5OrPe0-RmfP5rT0sXLLNOEUqqVBw3tAzXytv8X0w', 1),
(101, 7, 22, 'Procesador Amd R9-7900x 4.70ghz', 1659900, 'AM5', NULL, NULL, 80, 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcTrohzqflkdJj-TWrWKFmBpl4Qhb8lYVb4Mn67NRkkwNAAXZqc5YsV4JoQ1hNps0Rehkiv0SM7wVuZkU3MRBCqgqBxYYBzakDsok-F9U6m7RLVXXVt8C4Rr-w', 1),
(102, 7, 22, 'Procesador Amd R9-7950x3d 4.2ghz', 3537000, 'AM5', NULL, NULL, 80, 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcQTtcsNZOmaANX9p0__yTXe-1FziDlmulrQlCfcFsjBLQrTuKa7PAP2-EeMfATqJfZ5y-b-H7IDO86ithFQ4uCcDyp3D1cNarCX0EPV_isxK9tc_GY8PMgUlA', 1),
(103, 7, 22, 'Procesador Amd Cpu R9-5950x 3.4ghz', 1250000, 'AM4', NULL, NULL, 80, 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcQOhZ5WDV5ecBfZTorW3a7sPxBpc79SSgmM_lYrvHKEwM5NOEJKLIzsdQ5qrRvuRteMrGcmuBuLwSVbYcRimNvjrUT1eqWl_gMQNk5hGJj3ilmixkbJJ_6e', 1),
(104, 7, 22, 'Amd Procesador Am4 Ryzen 7 3800xt 8 X 4.7ghz/36mb One Size', 1413000, 'AM4', NULL, NULL, 80, 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcQisUMPzy7ZXlWIxkgjDpKSQiwgy6jLPscKgErI8OByA0Up4j37RNXEUShgZTGOzspXDXTXDgG9dqNvf43anyALMRPKRfm4FDIa3hSIy4-rLEXh5J4dUmN4Hg', 1),
(105, 7, 22, 'Procesadr AMD Ryzen 5 4600G AM4', 590000, 'AM4', NULL, NULL, 80, 'https://media.falabella.com/falabellaCO/139162013_01/w=1500,h=1500,fit=pad', 1),
(106, 8, 14, 'MSI GeForce RTX 4070 Super 12G Gaming X Slim', 3909000, NULL, NULL, NULL, 80, 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcS_o_sE6_G6pGR9gfPrz2DEVemEOZ4-sz9nSnKzN61EQtDs5_3UtBzgN-2KOmsYyfh43PmChn91httnS3USrRV31I1UZRd1E8wP27O3BJ5UrnRCir3wL1XHvlM', 1),
(107, 8, 14, 'Nvidia geforce msi rtx 4060 ti ventus 3x 16gb oc', 2953000, NULL, NULL, NULL, 80, 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcTbPF7D5IrkuPNxR-WlKooLQEkHMYmBf3jPyi3slcDRoyOf-s6j9yLlBQFU5BDR62sySPdYeAcf9mCCVo77TKk_8GdkJmooqIV1PMSoU3lQt0b2H8maPkVy', 1),
(108, 8, 14, 'MSI RTX 3060 Gaming 12G NVIDIA GeForce RTX 3060 12 GB GDDR6', 3672000, NULL, NULL, NULL, 80, 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcT05FUuJLS1Z3OXoGOAbjZ2fXhFygvqZivmKd_izEc6FNpQ8E34LoqbwUDnzqDNvWVa0FuTjdv034oQKjS91TOkwE6IYILqb51Oku_eXUIlEILlQrFoeCW54w', 1),
(109, 8, 15, 'Gigabyte Tarjeta Gráfica Rx 9070 Gaming Oc 16gb Gddr6', 2767000, NULL, NULL, NULL, 80, 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcRW3ziJxDiA2qoFzjuYxqmcciqShga_sSbIAUkw9HTUkN4z2eVTKPb-N6TNtf-ybsfzUAPqNgDxLkzSmwjoapk_tbvLYaav_HTQnlgyfCSe_eqnczZ3l1pDBw', 1),
(110, 8, 15, 'Tarjeta Gráfica GIGABYTE Radeon 9060XT 16GB GDDR7 Gaming', 2088000, NULL, NULL, NULL, 80, 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcQocc1Q9q2ncB8eZnmU5AfpjtlAvJ42S3IQ1aDJ9XnxtC3oFKnsHDLd_fVsASp1NbksZ6U2VpymyHjxM1glHZNuC4eNTWoC-haI_Jmcbtpy', 1),
(111, 8, 15, 'Gigabyte Tarjeta Gráfica Radeon Rx 6500 Xt Eagle 4g 4gb Gddr6', 1137000, NULL, NULL, NULL, 80, 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcTWwOy46gZKLdb2uJbSJeHraT7vwR-TohfDifI1Yc0OtRaVxjfQ4jJOnc85IBcCpJg0KE3GT-jEjouWl8hnjYG6zxh5lnerQda8kudSt7PNDYoqLEvOJ9rjSw', 1),
(112, 8, 6, 'ASUS ROG Strix RTX 4080', 6099000, NULL, NULL, NULL, 80, 'https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcQKuKo47_Ifgo7ZxVzFOFzb-cfzQdcgP1X632CDo9rk6A6Lctga12ECuKMdAUUcsUddT9xKlmOA78boPYRDFSKD0p3JW16_2EkxBSR2nxEZ242iI2zGhEPX', 1),
(113, 8, 6, 'Tarjeta de Video ASUS TUF Gaming RTX 4070 OC Edition GDDR6X 12GB NVIDIA', 2022000, NULL, NULL, NULL, 80, 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcSub5ukx_soJukp3DsnR4_SevafIPPEDkkWN0ys9x5nJW7gxaQ1Fjwo1raywqs5S52gTGWjA5ch9xU98dxUU8u5DgT3oQGbp7hPiPyZk8fEOXzmtoi5w9MAUQ', 1),
(114, 8, 6, 'ASUS TUF GAMING GeForce RTX 3060 OC', 1089000, NULL, NULL, NULL, 80, 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcTxDZNUznT88RSRQfcezMtBaLoetnCME3ngOs1fmrq9VplkaJgop3jQ6-dB4VDcYJZTVWeEG8gH5NVX9QI1jFha0EjidAVZ755SrMH7aPYo3EZd_n0xDjBP', 1),
(115, 8, 22, 'Tarjeta de video xfx amd radeon rx 9070 xt quicksilver', 3090000, NULL, NULL, NULL, 80, 'https://www.dateks.lv/images/pic/2400/2400/238/1904.jpg', 1),
(116, 8, 22, 'Asrock Tarjeta Gráfica Rx 9060 Xt Gddr6', 2038000, NULL, NULL, NULL, 80, 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcSNg-khYMVdKbgFONxp_QmHvHqT7vcKcbJzzpWo4FGIGgqiWQzDKkr8ZPIJhTa7VOhVZPTitPfbrEaZRij045cA29Hv-MtA-avPQapNjSOJ_rGRToax--GC8g', 1),
(117, 8, 22, 'Tarjeta Gráfica Amd Radeon Rx 7900xt 20 Gb Gddr6 Gaming', 8636000, NULL, NULL, NULL, 80, 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcS_UdbcQ5bqc79UKDj3bLjsaxseJidSoORvuq9vjCH7GQlobZMQxPiQ3PMjyKPZLm11LYR8xWkN3yxfB0AlO5Hh4-PRWlSvgKm27sTI2am-PY7W9i-wyEmX', 1),
(118, 8, 23, 'Gigabyte Tarjeta Gráfica Rtx 5090 Windforce Oc 32gb Gddr7', 14938000, NULL, NULL, NULL, 80, 'https://encrypted-tbn3.gstatic.com/shopping?q=tbn:ANd9GcQ6qyfMN0HFAVCj8_pHM4Uq7Q98OWGlgMW8CCufvP6aEv6nC3LMAsNU967VnIfsSNVB3-p8Yj5oMbAW8diUdF3mNA2LOh5P71Wqn5-HlGUGx0cdwOSZ_9MTEw', 1),
(119, 8, 23, 'Gigabyte Tarjeta Gráfica Rtx 5070 Ti Windforce Sff 16gb Gddr7', 3470000, NULL, NULL, NULL, 80, 'https://encrypted-tbn2.gstatic.com/shopping?q=tbn:ANd9GcRCatEnKBaX7jGUPGXTcBVbSQjO3FgOUqjNPSzV1AVmPCTaQJtWJ1HkoDRV_NjF99rv2I7YylHOvcJxSivCQvHKTdCv-PwVcXpgSR9CjYw6', 1),
(120, 8, 23, 'GIGABYTE Tarjeta gráfica GeForce RTX 3060 Gaming OC 12G', 1248000, NULL, NULL, NULL, 80, 'https://m.media-amazon.com/images/I/61XAtpgr1lL.AC_UY218.jpg', 1);

INSERT INTO COMBO (id_combo, nombre_combo, precio_total, nivel_rendimiento) VALUES
(1, 'Combo Gamer Entrada', 3137000, '1080p Entrada (estimado)'),
(2, 'Combo Gamer Básico', 5241600, '1080p Medio (estimado)'),
(3, 'Combo Gamer Medio', 5620000, '1080p Alto (estimado)'),
(4, 'Combo Gamer Avanzado', 6836000, '1440p Alto (estimado)'),
(5, 'Combo Entusiasta', 14904200, '4K (estimado)');

INSERT INTO COMBO_PRODUCTO (id_combo, id_producto, cantidad) VALUES
(1, 105, 1),
(1, 78, 1),
(1, 39, 1),
(1, 114, 1),
(1, 28, 1),
(1, 14, 1),
(2, 98, 1),
(2, 84, 1),
(2, 44, 1),
(2, 113, 1),
(2, 19, 1),
(2, 8, 1),
(3, 103, 1),
(3, 78, 1),
(3, 31, 1),
(3, 109, 1),
(3, 29, 1),
(3, 6, 1),
(4, 104, 1),
(4, 78, 1),
(4, 34, 1),
(4, 119, 1),
(4, 30, 1),
(4, 12, 1),
(5, 102, 1),
(5, 81, 1),
(5, 43, 1),
(5, 117, 1),
(5, 30, 1),
(5, 9, 1);

-- =====================================================================
-- SEGURIDAD (mínimo privilegio). CAMBIA LAS CONTRASEÑAS antes de ejecutar.
-- =====================================================================
CREATE USER IF NOT EXISTS 'admin_levelup'@'localhost' IDENTIFIED BY 'CAMBIAR_clave_admin_2026';
GRANT ALL PRIVILEGES ON levelup_pc.* TO 'admin_levelup'@'localhost';

CREATE USER IF NOT EXISTS 'app_cliente'@'localhost' IDENTIFIED BY 'CAMBIAR_clave_app_2026';
GRANT SELECT, INSERT, UPDATE ON levelup_pc.* TO 'app_cliente'@'localhost';
-- DELETE queda denegado explícitamente: el borrado es lógico (activo / estado / estado_entrega)
REVOKE DELETE ON levelup_pc.* FROM 'app_cliente'@'localhost';

FLUSH PRIVILEGES;

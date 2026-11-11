-- =====================================================================
-- Seguridad del SGBD · mínimo privilegio
-- Los marcadores {{...}} los reemplaza `npm run db:setup` con valores del .env.
-- Si lo ejecutas a mano, sustitúyelos por contraseñas reales y fuertes.
-- =====================================================================
CREATE USER IF NOT EXISTS 'admin_levelup'@{{HOST}} IDENTIFIED BY {{ADMIN_PASSWORD}};
GRANT ALL PRIVILEGES ON levelup_pc.* TO 'admin_levelup'@{{HOST}};

CREATE USER IF NOT EXISTS 'app_cliente'@{{HOST}} IDENTIFIED BY {{APP_PASSWORD}};
GRANT SELECT, INSERT, UPDATE ON levelup_pc.* TO 'app_cliente'@{{HOST}};
-- DELETE queda denegado explícitamente: el borrado es lógico (activo / estado / estado_entrega)
REVOKE DELETE ON levelup_pc.* FROM 'app_cliente'@{{HOST}};

FLUSH PRIVILEGES;

# Base de datos LevelUp PC (MySQL 8.0.16+)

## Opción A · con Node (recomendada)
1. Copia `.env.example` a `.env` y completa DB_ROOT_PASSWORD, DB_ADMIN_PASSWORD y DB_PASSWORD.
2. `npm install`
3. `npm run db:setup`  → crea `levelup_pc`, las 10 tablas, triggers y los usuarios `admin_levelup` / `app_cliente`
4. `npm run db:seed`   → carga categorías, marcas, 120 productos (stock 80) y combos compatibles
5. `npm run server` (API en :3000) y en otra terminal `npm run dev` (Vite)

## Opción B · sin Node (Workbench / phpMyAdmin / consola)
Importa `db/levelup_pc_completo.sql` (cambia antes las dos contraseñas del final del archivo
y pon esas mismas en `DB_PASSWORD` / `DB_ADMIN_PASSWORD` del `.env`).
  mysql -u root -p < db/levelup_pc_completo.sql

## Regenerar el SQL completo tras cambiar el catálogo
  node db/export-sql.js

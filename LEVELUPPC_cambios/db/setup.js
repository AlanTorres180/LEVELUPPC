// Crea la base de datos, las 10 tablas y los usuarios del SGBD.
// Uso: npm run db:setup   (requiere DB_ROOT_USER / DB_ROOT_PASSWORD en .env)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const required = ["DB_ROOT_PASSWORD", "DB_ADMIN_PASSWORD", "DB_PASSWORD"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Faltan variables en .env: ${missing.join(", ")}`);
  process.exit(1);
}

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_ROOT_USER || "root",
  password: process.env.DB_ROOT_PASSWORD,
  multipleStatements: true,
  charset: "utf8mb4",
});

try {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await conn.query(schema);
  console.log("✅ Esquema creado (10 tablas + triggers de factura)");

  const host = process.env.DB_USER_HOST || "localhost";
  const security = fs
    .readFileSync(path.join(__dirname, "security.sql"), "utf8")
    .replaceAll("{{HOST}}", conn.escape(host))
    .replaceAll("{{ADMIN_PASSWORD}}", conn.escape(process.env.DB_ADMIN_PASSWORD))
    .replaceAll("{{APP_PASSWORD}}", conn.escape(process.env.DB_PASSWORD));
  await conn.query(security);
  console.log("✅ Usuarios admin_levelup y app_cliente configurados");
} catch (err) {
  console.error("❌ Error en el setup:", err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}

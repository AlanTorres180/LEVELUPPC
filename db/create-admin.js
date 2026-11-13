import "dotenv/config";
import bcrypt from "bcryptjs";
import { createAdminConnection } from "../server/db.js";

const [correo, clave] = process.argv.slice(2);
if (!correo || !clave || clave.length < 10) { console.error('Uso: node db/create-admin.js correo "clave de 10+ caracteres"'); process.exit(1); }
const conn = await createAdminConnection();
const hash = await bcrypt.hash(clave, 12);
await conn.query(
  `INSERT INTO USUARIO (correo_electronico, clave_acceso, rol_usuario) VALUES (?,?, 'Administrador')
   ON DUPLICATE KEY UPDATE clave_acceso = VALUES(clave_acceso), rol_usuario = 'Administrador'`,
  [correo.toLowerCase(), hash]);
console.log("Administrador listo:", correo);
await conn.end();
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const common = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || "levelup_pc",
  charset: "utf8mb4",
  decimalNumbers: true, // DECIMAL -> number (no string)
  waitForConnections: true,
  connectionLimit: 10,
};

// La aplicación se conecta SIEMPRE con el usuario restringido (app_cliente).
export const pool = mysql.createPool({
  ...common,
  user: process.env.DB_USER || "app_cliente",
  password: process.env.DB_PASSWORD || "",
});

// Solo para scripts de mantenimiento (db/seed.js). Nunca se usa en las rutas web.
export function createAdminConnection() {
  return mysql.createConnection({
    ...common,
    user: process.env.DB_ADMIN_USER || "admin_levelup",
    password: process.env.DB_ADMIN_PASSWORD || "",
  });
}

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

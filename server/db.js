import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const common = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  charset: "utf8mb4",
  decimalNumbers: true, // DECIMAL -> number (no string)
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 15000, // el proxy de Railway puede tardar en responder
};

// Conexión que usan las rutas de la web
export const pool = mysql.createPool({
  ...common,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Solo para db:seed. Si no defines DB_ADMIN_*, usa el mismo usuario del .env
export function createAdminConnection() {
  return mysql.createConnection({
    ...common,
    user: process.env.DB_ADMIN_USER || process.env.DB_USER,
    password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD,
  });
}

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
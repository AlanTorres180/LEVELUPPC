import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { HttpError } from "./db.js"; // db.js ya ejecuta dotenv

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) throw new Error("JWT_SECRET faltante o muy corto");

export const hashClave = (c) => bcrypt.hash(c, 12);          // 12 rondas + salt automático
export const verificarClave = (c, h) => bcrypt.compare(c, h);
export const DUMMY_HASH = bcrypt.hashSync("dummy-no-usar", 12); // iguala tiempos si el correo no existe
export const firmar = (u) =>
  jwt.sign({ sub: u.id_usuario, rol: u.rol_usuario }, SECRET, { expiresIn: process.env.JWT_EXPIRES || "2h" });

export function requireAuth(req, res, next) {
  const t = (req.headers.authorization || "").replace(/^Bearer /, "");
  try { req.user = jwt.verify(t, SECRET); next(); }
  catch { next(new HttpError(401, "Sesión inválida o expirada")); }
}
export const requireRole = (rol) => [
  requireAuth,
  (req, res, next) => (req.user.rol === rol ? next() : next(new HttpError(403, "Permiso denegado"))),
];
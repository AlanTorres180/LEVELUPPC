import { Router } from "express";
import rateLimit from "express-rate-limit";
import { pool, HttpError } from "../db.js";
import { hashClave, verificarClave, firmar, requireAuth, DUMMY_HASH } from "../auth.js";

const router = Router();
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const CLAVE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/;
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: "Demasiados intentos. Espera 15 minutos." } });

router.post("/auth/register", limiter, async (req, res, next) => {
  let conn;
  try {
    const { correo, clave, nombre, telefono, direccion, ciudad } = req.body || {};
    const mail = String(correo || "").trim().toLowerCase();
    if (!EMAIL.test(mail)) throw new HttpError(400, "Correo inválido");
    if (!CLAVE.test(String(clave || ""))) throw new HttpError(400, "La clave debe tener 8-64 caracteres, con mayúscula, minúscula y número");
    if (!String(nombre || "").trim() || !/^\d{7,15}$/.test(String(telefono || "")) || !String(direccion || "").trim())
      throw new HttpError(400, "Nombre, teléfono (7-15 dígitos) y dirección son obligatorios");
    const hash = await hashClave(String(clave));

    conn = await pool.getConnection();
    await conn.beginTransaction();
    const [[u]] = await conn.query("SELECT id_usuario, clave_acceso FROM USUARIO WHERE correo_electronico = ? FOR UPDATE", [mail]);
    let id;
    if (!u) {
      const [r] = await conn.query("INSERT INTO USUARIO (correo_electronico, clave_acceso, rol_usuario) VALUES (?,?, 'Cliente')", [mail, hash]);
      id = r.insertId;
    } else if (u.clave_acceso.startsWith("!INVITADO!")) {
      await conn.query("UPDATE USUARIO SET clave_acceso = ? WHERE id_usuario = ?", [hash, u.id_usuario]);
      id = u.id_usuario;
    } else throw new HttpError(409, "Ese correo ya está registrado");

    await conn.query(
      `INSERT INTO CLIENTE (id_usuario, nombre, telefono, direccion_envio, ciudad) VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), telefono = VALUES(telefono),
         direccion_envio = VALUES(direccion_envio), ciudad = VALUES(ciudad)`,
      [id, String(nombre).trim(), telefono, String(direccion).trim(), ciudad || null]);
    await conn.commit();
    res.status(201).json({ mensaje: "Cuenta creada" });
  } catch (e) { if (conn) await conn.rollback().catch(() => {}); next(e); }
  finally { conn?.release(); }
});

router.post("/auth/login", limiter, async (req, res, next) => {
  try {
    const mail = String(req.body?.correo || "").trim().toLowerCase();
    const clave = String(req.body?.clave || "");
    const [[u]] = await pool.query(
      "SELECT id_usuario, correo_electronico, clave_acceso, rol_usuario FROM USUARIO WHERE correo_electronico = ? AND estado = 'ACTIVO'", [mail]);
    const hash = u?.clave_acceso?.startsWith("$2") ? u.clave_acceso : DUMMY_HASH; // los invitados no pueden iniciar sesión
    const ok = await verificarClave(clave, hash);
    if (!u || !ok) throw new HttpError(401, "Correo o contraseña incorrectos"); // mensaje genérico
    res.json({ token: firmar(u), rol: u.rol_usuario, correo: u.correo_electronico });
  } catch (e) { next(e); }
});

router.get("/auth/me", requireAuth, (req, res) => res.json(req.user));
export default router;
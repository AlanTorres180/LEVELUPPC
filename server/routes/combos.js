import { Router } from "express";
import { pool, HttpError } from "../db.js";
import { validarCompatibilidad } from "../compat.js";

const router = Router();
const MARGEN = 0.05; // RN01: máximo +5 % sobre el presupuesto

// Desglose de uno o varios combos a través de COMBO_PRODUCTO
async function desglosar(ids) {
  if (!ids.length) return new Map();
  const [rows] = await pool.query(
    `SELECT cp.id_combo, p.id_producto AS id, p.nombre_producto AS name, m.nombre_marca AS brand,
            c.slug AS category, cp.cantidad, p.precio_unitario AS price, p.imagen_url AS image,
            p.socket_cpu, p.tipo_ram
     FROM COMBO_PRODUCTO cp
     JOIN PRODUCTO p ON p.id_producto = cp.id_producto
     JOIN MARCA m ON m.id_marca = p.id_marca
     JOIN CATEGORIA c ON c.id_categoria = p.id_categoria
     WHERE cp.id_combo IN (?) ORDER BY cp.id_combo, c.id_categoria`,
    [ids]
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.id_combo)) map.set(r.id_combo, []);
    map.get(r.id_combo).push(r);
  }
  return map;
}

// RF-01/RF-02/RN01/RN06: 2-3 combos dentro del presupuesto, con stock y compatibles
router.get("/combos/recomendar", async (req, res, next) => {
  try {
    const presupuesto = Number(req.query.presupuesto);
    if (!Number.isFinite(presupuesto) || presupuesto <= 0) throw new HttpError(400, "Indica un presupuesto válido (> 0).");
    const tope = presupuesto * (1 + MARGEN);

    const [combos] = await pool.query(
      `SELECT c.id_combo AS id, c.nombre_combo AS nombre, c.nivel_rendimiento AS nivel,
              SUM(p.precio_unitario * cp.cantidad) AS total
       FROM COMBO c
       JOIN COMBO_PRODUCTO cp ON cp.id_combo = c.id_combo
       JOIN PRODUCTO p ON p.id_producto = cp.id_producto
       WHERE c.activo = 1
       GROUP BY c.id_combo, c.nombre_combo, c.nivel_rendimiento
       HAVING MIN(p.activo) = 1                               -- RN06: sin productos retirados
          AND MIN(p.stock_disponible >= cp.cantidad) = 1      -- RN06: sin stock cero
          AND total <= ?                                      -- RN01: presupuesto + 5 %
       ORDER BY total DESC
       LIMIT 3`,
      [tope]
    );

    const detalle = await desglosar(combos.map((c) => c.id));
    const resultado = combos
      .map((c) => {
        const items = detalle.get(c.id) || [];
        const incompat = validarCompatibilidad(
          items.map((i) => ({ nombre: i.name, categoria: i.category, socket_cpu: i.socket_cpu, tipo_ram: i.tipo_ram }))
        );
        return { ...c, diferencia: Math.round(c.total - presupuesto), compatible: incompat.length === 0, items };
      })
      .filter((c) => c.compatible);

    res.json({ presupuesto, tope: Math.round(tope), combos: resultado });
  } catch (err) { next(err); }
});

router.get("/combos/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [[combo]] = await pool.query(
      "SELECT id_combo AS id, nombre_combo AS nombre, nivel_rendimiento AS nivel FROM COMBO WHERE id_combo = ? AND activo = 1",
      [id]
    );
    if (!combo) throw new HttpError(404, "Combo no encontrado");
    const items = (await desglosar([id])).get(id) || [];
    res.json({ ...combo, total: items.reduce((s, i) => s + i.price * i.cantidad, 0), items });
  } catch (err) { next(err); }
});

// RF-03: validar una selección arbitraria de productos
router.post("/compatibilidad", async (req, res, next) => {
  try {
    const ids = [...new Set((req.body?.ids || []).map(Number).filter(Number.isInteger))];
    if (!ids.length) throw new HttpError(400, "Envía ids de productos.");
    const [rows] = await pool.query(
      `SELECT p.nombre_producto AS nombre, c.slug AS categoria, p.socket_cpu, p.tipo_ram
       FROM PRODUCTO p JOIN CATEGORIA c ON c.id_categoria = p.id_categoria WHERE p.id_producto IN (?)`,
      [ids]
    );
    const errores = validarCompatibilidad(rows);
    res.json({ compatible: errores.length === 0, errores });
  } catch (err) { next(err); }
});

export default router;

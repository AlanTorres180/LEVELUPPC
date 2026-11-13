import { Router } from "express";
import { pool, HttpError } from "../db.js";
import { extractSpecs } from "../compat.js";
import { requireRole } from "../auth.js";

const router = Router();

// Solo usuarios con sesión válida (JWT) y rol "Administrador" (RN05).
// requireRole devuelve un arreglo de middlewares, por eso se usa con ...soloAdmin
const soloAdmin = requireRole("Administrador");

const PRODUCT_SELECT = `
  SELECT p.id_producto AS id, p.nombre_producto AS name, p.precio_unitario AS price,
         c.slug AS category, m.slug AS brand, p.imagen_url AS image,
         p.stock_disponible AS stock, p.socket_cpu, p.vatiaje, p.tipo_ram
  FROM PRODUCTO p
  JOIN CATEGORIA c ON c.id_categoria = p.id_categoria
  JOIN MARCA m ON m.id_marca = p.id_marca`;

// ---- Búsqueda y filtrado: categoría, marca, rango de precio y texto (RF-05) ----
router.get("/products", async (req, res, next) => {
  try {
    const { categoria, marca, min, max, q } = req.query;
    const where = ["p.activo = 1"];
    const params = [];
    if (categoria) { where.push("c.slug = ?"); params.push(String(categoria)); }
    if (marca) { where.push("m.slug = ?"); params.push(String(marca).toLowerCase()); }
    if (min !== undefined && min !== "" && !Number.isNaN(Number(min))) { where.push("p.precio_unitario >= ?"); params.push(Number(min)); }
    if (max !== undefined && max !== "" && !Number.isNaN(Number(max))) { where.push("p.precio_unitario <= ?"); params.push(Number(max)); }
    if (q) { where.push("p.nombre_producto LIKE ?"); params.push(`%${String(q).slice(0, 80)}%`); }

    const [products] = await pool.query(`${PRODUCT_SELECT} WHERE ${where.join(" AND ")} ORDER BY p.id_producto`, params);
    const [brands] = await pool.query(
      `SELECT DISTINCT m.nombre_marca AS n FROM MARCA m JOIN PRODUCTO p ON p.id_marca = m.id_marca
       WHERE p.activo = 1 ORDER BY m.nombre_marca`
    );
    res.json({ products, brands: brands.map((b) => b.n) });
  } catch (err) { next(err); }
});

router.get("/products/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${PRODUCT_SELECT} WHERE p.id_producto = ? AND p.activo = 1`, [Number(req.params.id)]);
    if (!rows.length) throw new HttpError(404, "Producto no encontrado");
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ---- Administración (RF-11 / RN05) ----
router.post("/products", ...soloAdmin, async (req, res, next) => {
  try {
    const { name, price, category, brand, image, stock } = req.body || {};
    if (!name || !(Number(price) > 0)) throw new HttpError(400, "Faltan campos obligatorios (name, price > 0).");
    if (!category || !brand) throw new HttpError(400, "category y brand (slugs existentes) son obligatorios.");
    if (stock != null && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) throw new HttpError(400, "Stock inválido");

    const [[cat]] = await pool.query("SELECT id_categoria FROM CATEGORIA WHERE slug = ?", [String(category)]);
    const [[mar]] = await pool.query("SELECT id_marca FROM MARCA WHERE slug = ?", [String(brand).toLowerCase()]);
    if (!cat || !mar) throw new HttpError(400, "Categoría o marca inexistente.");

    const specs = extractSpecs(String(name), String(category));
    const [r] = await pool.query(
      `INSERT INTO PRODUCTO (id_categoria, id_marca, nombre_producto, precio_unitario, socket_cpu, vatiaje, tipo_ram, stock_disponible, imagen_url)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [cat.id_categoria, mar.id_marca, String(name), Number(price), specs.socket_cpu, specs.vatiaje, specs.tipo_ram, Number(stock || 0), image || null]
    );
    const [rows] = await pool.query(`${PRODUCT_SELECT} WHERE p.id_producto = ?`, [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// Actualización de nombre y/o precio. Los fragmentos SQL de "sets" son texto fijo;
// lo que envía el usuario siempre va en "vals" (consulta parametrizada).
router.patch("/products/:id", ...soloAdmin, async (req, res, next) => {
  try {
    const { name, price } = req.body || {};
    const sets = [], vals = [];
    if (name !== undefined) {
      if (!String(name).trim()) throw new HttpError(400, "Nombre vacío");
      sets.push("nombre_producto = ?"); vals.push(String(name).trim().slice(0, 150));
    }
    if (price !== undefined) {
      if (!(Number(price) > 0)) throw new HttpError(400, "Precio inválido");
      sets.push("precio_unitario = ?"); vals.push(Number(price));
    }
    if (!sets.length) throw new HttpError(400, "Nada que actualizar");
    const [r] = await pool.query(
      `UPDATE PRODUCTO SET ${sets.join(", ")} WHERE id_producto = ? AND activo = 1`,
      [...vals, Number(req.params.id)]
    );
    if (!r.affectedRows) throw new HttpError(404, "Producto no encontrado");
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.patch("/products/:id/stock", ...soloAdmin, async (req, res, next) => {
  try {
    const stock = Number(req.body?.stock);
    if (!Number.isInteger(stock) || stock < 0) throw new HttpError(400, "Stock inválido");
    const [r] = await pool.query("UPDATE PRODUCTO SET stock_disponible = ? WHERE id_producto = ?", [stock, Number(req.params.id)]);
    if (!r.affectedRows) throw new HttpError(404, "Producto no encontrado");
    res.json({ id: Number(req.params.id), stock });
  } catch (err) { next(err); }
});

// Borrado LÓGICO: app_cliente no tiene DELETE (trazabilidad de pedidos históricos).
router.delete("/products/:id", ...soloAdmin, async (req, res, next) => {
  try {
    const [r] = await pool.query("UPDATE PRODUCTO SET activo = 0 WHERE id_producto = ?", [Number(req.params.id)]);
    if (!r.affectedRows) throw new HttpError(404, "Producto no encontrado");
    res.json({ id: Number(req.params.id), activo: false });
  } catch (err) { next(err); }
});

export default router;
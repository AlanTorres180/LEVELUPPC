// Carga categorías, marcas, productos y combos desde src/data/products_fixed.json.
// Uso: npm run db:seed   (usa el usuario admin_levelup; es idempotente)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createAdminConnection } from "../server/db.js";
import { extractSpecs } from "../server/compat.js";
import { buildCombos } from "./buildCombos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/data/products_fixed.json"), "utf8"));
const DEFAULT_STOCK = 80; // mismo valor inicial que usaba el frontend

const CATEGORY_NAMES = {
  cases: "Chasis",
  "power-supplies": "Fuentes de Poder",
  memory: "Memorias RAM",
  monitors: "Monitores",
  peripherals: "Periféricos",
  motherboards: "Tarjetas Madre",
  processors: "Procesadores",
  "graphics-cards": "Tarjetas Gráficas",
  storage: "Almacenamiento", // el documento la incluye; aún sin productos en el catálogo
};
const UPPER = new Set(["amd", "msi", "hp", "aoc", "lg", "adata", "nvidia", "asus", "xpg"]);
const brandName = (slug) =>
  UPPER.has(slug) ? slug.toUpperCase() : slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

const conn = await createAdminConnection();
try {
  await conn.beginTransaction();

  const catIds = {};
  for (const slug of new Set([...raw.products.map((p) => p.category), "storage"])) {
    await conn.query(
      "INSERT INTO CATEGORIA (slug, nombre_categoria) VALUES (?, ?) ON DUPLICATE KEY UPDATE nombre_categoria = VALUES(nombre_categoria)",
      [slug, CATEGORY_NAMES[slug] || slug]
    );
    catIds[slug] = (await conn.query("SELECT id_categoria FROM CATEGORIA WHERE slug = ?", [slug]))[0][0].id_categoria;
  }

  const brandIds = {};
  for (const slug of new Set(raw.products.map((p) => String(p.brand).trim().toLowerCase()))) {
    await conn.query(
      "INSERT INTO MARCA (slug, nombre_marca) VALUES (?, ?) ON DUPLICATE KEY UPDATE nombre_marca = VALUES(nombre_marca)",
      [slug, brandName(slug)]
    );
    brandIds[slug] = (await conn.query("SELECT id_marca FROM MARCA WHERE slug = ?", [slug]))[0][0].id_marca;
  }

  const catalog = [];
  for (const p of raw.products) {
    const brand = String(p.brand).trim().toLowerCase();
    const specs = extractSpecs(p.name, p.category);
    // Se conservan los IDs originales para no romper las páginas que usan data-ids.
    await conn.query(
      `INSERT INTO PRODUCTO (id_producto, id_categoria, id_marca, nombre_producto, precio_unitario,
                             socket_cpu, vatiaje, tipo_ram, stock_disponible, imagen_url, activo)
       VALUES (?,?,?,?,?,?,?,?,?,?,1)
       ON DUPLICATE KEY UPDATE id_categoria=VALUES(id_categoria), id_marca=VALUES(id_marca),
         nombre_producto=VALUES(nombre_producto), precio_unitario=VALUES(precio_unitario),
         socket_cpu=VALUES(socket_cpu), vatiaje=VALUES(vatiaje), tipo_ram=VALUES(tipo_ram),
         imagen_url=VALUES(imagen_url)`,
      [p.id, catIds[p.category], brandIds[brand], p.name, p.price, specs.socket_cpu, specs.vatiaje, specs.tipo_ram, DEFAULT_STOCK, p.image || null]
    );
    catalog.push({ id: p.id, nombre: p.name, precio: p.price, categoria: p.category, stock: DEFAULT_STOCK, ...specs });
  }
  console.log(`✅ ${raw.products.length} productos, ${Object.keys(catIds).length} categorías, ${Object.keys(brandIds).length} marcas`);

  const combos = buildCombos(catalog);
  await conn.query("DELETE FROM COMBO"); // COMBO_PRODUCTO cae en cascada
  for (const c of combos) {
    const [r] = await conn.query(
      "INSERT INTO COMBO (nombre_combo, precio_total, nivel_rendimiento) VALUES (?,?,?)",
      [c.nombre, c.total, c.nivel]
    );
    await conn.query("INSERT INTO COMBO_PRODUCTO (id_combo, id_producto, cantidad) VALUES ?", [
      c.items.map((i) => [r.insertId, i.id, i.cantidad]),
    ]);
  }
  console.log(`✅ ${combos.length} combos compatibles creados`);

  await conn.commit();
} catch (err) {
  await conn.rollback();
  console.error("❌ Error en el seed:", err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}

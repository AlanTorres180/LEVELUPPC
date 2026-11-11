// Genera db/levelup_pc_completo.sql (esquema + datos + usuarios) para importar sin Node.
// Uso: node db/export-sql.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { extractSpecs } from "../server/compat.js";
import { buildCombos } from "./buildCombos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/data/products_fixed.json"), "utf8"));
const STOCK = 80;
const CAT = { cases: "Chasis", "power-supplies": "Fuentes de Poder", memory: "Memorias RAM", monitors: "Monitores",
  peripherals: "Periféricos", motherboards: "Tarjetas Madre", processors: "Procesadores", "graphics-cards": "Tarjetas Gráficas", storage: "Almacenamiento" };
const UP = new Set(["amd", "msi", "hp", "aoc", "lg", "adata", "nvidia", "asus", "xpg"]);
const bname = (s) => (UP.has(s) ? s.toUpperCase() : s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "));
const q = (v) => (v == null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`);

const cats = [...new Set([...raw.products.map((p) => p.category), "storage"])];
const brands = [...new Set(raw.products.map((p) => p.brand.trim().toLowerCase()))];
const catIdx = Object.fromEntries(cats.map((c, i) => [c, i + 1]));
const brandIdx = Object.fromEntries(brands.map((b, i) => [b, i + 1]));

const catalog = raw.products.map((p) => ({ id: p.id, nombre: p.name, precio: p.price, categoria: p.category, stock: STOCK, ...extractSpecs(p.name, p.category) }));
const combos = buildCombos(catalog);

let out = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
out += "\n-- =====================================================================\n-- DATOS INICIALES (generado por db/export-sql.js)\n-- =====================================================================\n";
out += `INSERT INTO CATEGORIA (id_categoria, slug, nombre_categoria) VALUES\n${cats.map((c) => `(${catIdx[c]}, ${q(c)}, ${q(CAT[c] || c)})`).join(",\n")};\n\n`;
out += `INSERT INTO MARCA (id_marca, slug, nombre_marca) VALUES\n${brands.map((b) => `(${brandIdx[b]}, ${q(b)}, ${q(bname(b))})`).join(",\n")};\n\n`;
out += `INSERT INTO PRODUCTO (id_producto, id_categoria, id_marca, nombre_producto, precio_unitario, socket_cpu, vatiaje, tipo_ram, stock_disponible, imagen_url, activo) VALUES\n`;
out += raw.products.map((p, i) => {
  const c = catalog[i];
  return `(${p.id}, ${catIdx[p.category]}, ${brandIdx[p.brand.trim().toLowerCase()]}, ${q(p.name)}, ${p.price}, ${q(c.socket_cpu)}, ${c.vatiaje ?? "NULL"}, ${q(c.tipo_ram)}, ${STOCK}, ${q(p.image || null)}, 1)`;
}).join(",\n") + ";\n\n";
out += `INSERT INTO COMBO (id_combo, nombre_combo, precio_total, nivel_rendimiento) VALUES\n${combos.map((c, i) => `(${i + 1}, ${q(c.nombre)}, ${c.total}, ${q(c.nivel)})`).join(",\n")};\n\n`;
out += `INSERT INTO COMBO_PRODUCTO (id_combo, id_producto, cantidad) VALUES\n${combos.flatMap((c, i) => c.items.map((it) => `(${i + 1}, ${it.id}, ${it.cantidad})`)).join(",\n")};\n\n`;

out += "-- =====================================================================\n-- SEGURIDAD (mínimo privilegio). CAMBIA LAS CONTRASEÑAS antes de ejecutar.\n-- =====================================================================\n";
out += fs.readFileSync(path.join(__dirname, "security.sql"), "utf8").split("\n").slice(5).join("\n")
  .replaceAll("{{HOST}}", "'localhost'").replaceAll("{{ADMIN_PASSWORD}}", "'CAMBIAR_clave_admin_2026'").replaceAll("{{APP_PASSWORD}}", "'CAMBIAR_clave_app_2026'");
fs.writeFileSync(path.join(__dirname, "levelup_pc_completo.sql"), out);
console.log(`levelup_pc_completo.sql: ${raw.products.length} productos, ${cats.length} categorías, ${brands.length} marcas, ${combos.length} combos`);

// Arma combos compatibles a partir del catálogo (función pura, sin BD).
import { validarCompatibilidad, ramRequerida } from "../server/compat.js";

const TIERS = [
  { nombre: "Combo Gamer Entrada", nivel: "1080p Entrada (estimado)", q: 0.05, psuMin: 500 },
  { nombre: "Combo Gamer Básico", nivel: "1080p Medio (estimado)", q: 0.2, psuMin: 550 },
  { nombre: "Combo Gamer Medio", nivel: "1080p Alto (estimado)", q: 0.4, psuMin: 650 },
  { nombre: "Combo Gamer Avanzado", nivel: "1440p Alto (estimado)", q: 0.65, psuMin: 750 },
  { nombre: "Combo Entusiasta", nivel: "4K (estimado)", q: 0.9, psuMin: 850 },
];

const byPrice = (a, b) => a.precio - b.precio;
const at = (arr, q) => arr[Math.min(arr.length - 1, Math.floor(arr.length * q))];

/**
 * products: [{ id, nombre, precio, categoria, socket_cpu, tipo_ram, vatiaje, stock }]
 */
export function buildCombos(products) {
  const inStock = products.filter((p) => p.stock > 0);
  const cat = (c) => inStock.filter((p) => p.categoria === c).sort(byPrice);
  const cpus = cat("processors").filter((p) => p.socket_cpu);
  const boards = cat("motherboards");
  const rams = cat("memory");
  const gpus = cat("graphics-cards");
  const psus = cat("power-supplies");
  const cases = cat("cases");

  const combos = [];
  for (const t of TIERS) {
    const cpu = at(cpus, t.q);
    if (!cpu) continue;
    const boardPool = boards.filter((b) => b.socket_cpu === cpu.socket_cpu);
    const board = at(boardPool, t.q * 0.6);
    if (!board) continue;
    const req = ramRequerida(board);
    const ramPool = rams.filter((r) => r.tipo_ram && (!req || r.tipo_ram === req));
    const ram = at(ramPool, t.q);
    const gpu = at(gpus, t.q);
    const psu = psus.find((p) => (p.vatiaje || 0) >= t.psuMin) || at(psus, 0.5);
    const pcase = at(cases, t.q * 0.5);
    const parts = [cpu, board, ram, gpu, psu, pcase];
    if (parts.some((p) => !p)) continue;

    const errores = validarCompatibilidad(
      parts.map((p) => ({ nombre: p.nombre, categoria: p.categoria, socket_cpu: p.socket_cpu, tipo_ram: p.tipo_ram }))
    );
    if (errores.length) continue;

    combos.push({
      nombre: t.nombre,
      nivel: t.nivel,
      total: parts.reduce((s, p) => s + p.precio, 0),
      items: parts.map((p) => ({ id: p.id, cantidad: 1 })),
    });
  }
  return combos;
}

// Motor de compatibilidad (RF-03 / RN02).
// Extrae especificaciones del nombre del producto (best-effort) y valida combinaciones.
// Si un dato es desconocido (null) NO se bloquea: solo se bloquea una incompatibilidad comprobada.

export function extractSpecs(name = "", categorySlug = "") {
  const n = String(name);
  let socket = null;
  let ram = null;
  let watts = null;

  const sock = n.match(/\b(AM[45])\b|LGA\s*-?\s*(\d{3,4})/i);
  if (sock) socket = sock[1] ? sock[1].toUpperCase() : `LGA${sock[2]}`;

  // Ryzen sin socket en el nombre: 1000-5000 => AM4, 7000/8000/9000 => AM5
  if (!socket && categorySlug === "processors") {
    const r = n.match(/\bR(?:yzen)?\s?[3579][\s-]?(\d)\d{3}/i);
    if (r) socket = Number(r[1]) <= 5 ? "AM4" : "AM5";
  }

  const d = n.match(/\bDDR\s?([345])\b/i);
  if (d) ram = `DDR${d[1]}`;

  if (categorySlug === "power-supplies") {
    const w = n.match(/(\d{3,4})\s?W\b/i);
    if (w) watts = Number(w[1]);
  }

  return { socket_cpu: socket, tipo_ram: ram, vatiaje: watts };
}

// Tipo de RAM que exige una placa: el dato explícito o el implícito por socket.
export function ramRequerida(board) {
  if (board.tipo_ram) return board.tipo_ram;
  if (board.socket_cpu === "AM5") return "DDR5";
  if (board.socket_cpu === "AM4") return "DDR4";
  return null;
}

/**
 * items: [{ nombre, categoria (slug), socket_cpu, tipo_ram }]
 * Devuelve [] si es compatible o la lista de motivos de incompatibilidad.
 */
export function validarCompatibilidad(items) {
  const errores = [];
  const cpus = items.filter((i) => i.categoria === "processors" && i.socket_cpu);
  const boards = items.filter((i) => i.categoria === "motherboards");
  const rams = items.filter((i) => i.categoria === "memory" && i.tipo_ram);

  for (const cpu of cpus) {
    for (const mb of boards.filter((b) => b.socket_cpu)) {
      if (cpu.socket_cpu !== mb.socket_cpu) {
        errores.push(`"${cpu.nombre}" (${cpu.socket_cpu}) no es compatible con la placa "${mb.nombre}" (${mb.socket_cpu}).`);
      }
    }
  }
  for (const ram of rams) {
    for (const mb of boards) {
      const req = ramRequerida(mb);
      if (req && ram.tipo_ram !== req) {
        errores.push(`La memoria "${ram.nombre}" (${ram.tipo_ram}) no es compatible con la placa "${mb.nombre}" (requiere ${req}).`);
      }
    }
  }
  return errores;
}

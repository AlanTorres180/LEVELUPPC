// ============================================================
// Funcionalidades del documento: armador por presupuesto, comparador de
// combos, exportar configuración, rastreo de pedidos y modo claro/oscuro.
// Todo el contenido que viene de la API se inserta con textContent (sin innerHTML).
// ============================================================

const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    else el.setAttribute(k, v);
  }
  for (const c of children) el.append(c);
  return el;
}

function makeModal(id: string, title: string, body: HTMLElement) {
  const close = () => {
    modal.classList.remove("show");
    document.body.style.overflow = "";
  };
  const closeBtn = h("button", { class: "modal-close", "data-modal": id, "aria-label": "Cerrar" }, "×");
  const modal = h(
    "div",
    { class: "modal", id },
    h("div", { class: "modal-content lu-modal" }, h("div", { class: "modal-header" }, h("h2", {}, title), closeBtn), body)
  );
  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.body.append(modal);
  return {
    open: () => {
      modal.classList.add("show");
      document.body.style.overflow = "hidden";
    },
    close,
  };
}

const CATEGORY_LABEL: Record<string, string> = {
  processors: "Procesador",
  motherboards: "Placa madre",
  memory: "Memoria RAM",
  "graphics-cards": "Tarjeta gráfica",
  "power-supplies": "Fuente de poder",
  cases: "Chasis",
  monitors: "Monitor",
  peripherals: "Periférico",
};
const CATEGORY_ORDER = ["processors", "motherboards", "memory", "graphics-cards", "power-supplies", "cases", "monitors", "peripherals"];

interface ComboItem { id: number; name: string; brand: string; category: string; cantidad: number; price: number }
interface Combo { id: number; nombre: string; nivel: string; total: number; diferencia: number; compatible: boolean; items: ComboItem[] }

// ------------------------------------------------------------
// 1) Armador por presupuesto + comparador + exportar
// ------------------------------------------------------------
function initArmador() {
  const input = h("input", { type: "number", id: "budgetInput", min: "1", step: "10000", placeholder: "Ej: 5000000" });
  const searchBtn = h("button", { class: "btn-primary", type: "button" }, "Buscar combos");
  const status = h("p", { class: "lu-status", "aria-live": "polite" });
  const results = h("div", { class: "lu-scroll" });
  const body = h(
    "div",
    { class: "modal-body" },
    h("p", {}, "Ingresa cuánto quieres gastar (COP) y te proponemos de 2 a 3 combos compatibles, con un margen máximo del 5 %."),
    h("div", { class: "lu-row" }, input, searchBtn),
    status,
    results
  );
  const modal = makeModal("armadorModal", "Armar PC por presupuesto", body);

  const render = (combos: Combo[]) => {
    results.replaceChildren();
    const table = h("table", { class: "lu-table" });
    const head = h("tr", {}, h("th", {}, ""));
    combos.forEach((c) => head.append(h("th", {}, c.nombre)));
    table.append(h("thead", {}, head));

    const tbody = h("tbody");
    const row = (label: string, cells: string[], cls = "") => {
      const tr = h("tr", cls ? { class: cls } : {}, h("th", {}, label));
      cells.forEach((t) => tr.append(h("td", {}, t)));
      tbody.append(tr);
    };
    row("Precio total", combos.map((c) => fmt(c.total)), "lu-strong");
    row("Frente al presupuesto", combos.map((c) => (c.diferencia === 0 ? "Exacto" : `${c.diferencia > 0 ? "+" : "−"}${fmt(Math.abs(c.diferencia))}`)));
    row("Rendimiento", combos.map((c) => c.nivel));
    row("Compatibilidad", combos.map((c) => (c.compatible ? "✔ Verificada" : "✖ Revisar")));
    for (const cat of CATEGORY_ORDER) {
      if (!combos.some((c) => c.items.some((i) => i.category === cat))) continue;
      row(
        CATEGORY_LABEL[cat] || cat,
        combos.map((c) => {
          const it = c.items.find((i) => i.category === cat);
          return it ? `${it.name} — ${fmt(it.price)}` : "—";
        })
      );
    }
    const actions = h("tr", {}, h("th", {}, ""));
    combos.forEach((c) => {
      const add = h("button", { class: "btn-primary", type: "button" }, "Agregar al carrito");
      add.addEventListener("click", () => {
        window.dispatchEvent(new CustomEvent("levelup:add-combo", { detail: { items: c.items.map((i) => ({ id: i.id, cantidad: i.cantidad })) } }));
        modal.close();
      });
      const exp = h("button", { class: "lu-secondary", type: "button" }, "Exportar");
      exp.addEventListener("click", () => exportCombo(c));
      actions.append(h("td", {}, add, exp));
    });
    tbody.append(actions);
    table.append(tbody);
    results.append(table);
  };

  const search = async () => {
    const value = Number(input.value);
    results.replaceChildren();
    if (!Number.isFinite(value) || value <= 0) {
      status.textContent = "Escribe un presupuesto válido.";
      return;
    }
    status.textContent = "Buscando…";
    try {
      const res = await fetch(`/api/combos/recomendar?presupuesto=${encodeURIComponent(String(value))}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      const combos: Combo[] = data.combos || [];
      if (!combos.length) {
        status.textContent = `No hay combos disponibles hasta ${fmt(data.tope)}. Prueba con un presupuesto mayor.`;
        return;
      }
      status.textContent = `${combos.length} combo(s) hasta ${fmt(data.tope)} (presupuesto + 5 %).`;
      render(combos);
    } catch (err) {
      status.textContent = `No se pudo consultar: ${(err as Error).message}`;
    }
  };
  searchBtn.addEventListener("click", search);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") search();
  });
  return modal;
}

function exportCombo(c: Combo) {
  const lines = [
    `LevelUp PC — ${c.nombre}`,
    `Rendimiento (estimado): ${c.nivel}`,
    "",
    ...c.items.map((i) => `- ${CATEGORY_LABEL[i.category] || i.category}: ${i.name} (${i.brand}) x${i.cantidad} — ${fmt(i.price * i.cantidad)}`),
    "",
    `TOTAL: ${fmt(c.total)}`,
    `Generado: ${new Date().toLocaleString("es-CO")}`,
  ];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
  const a = h("a", { href: url, download: `${c.nombre.replace(/\s+/g, "_")}.txt` });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------
// 2) Rastreo de pedidos
// ------------------------------------------------------------
function initRastreo() {
  const factura = h("input", { type: "text", id: "trackInvoice", placeholder: "FAC-2026-000123", autocomplete: "off" });
  const correo = h("input", { type: "email", id: "trackEmail", placeholder: "correo con el que compraste" });
  const btn = h("button", { class: "btn-primary", type: "button" }, "Consultar");
  const status = h("p", { class: "lu-status", "aria-live": "polite" });
  const out = h("div");
  const body = h(
    "div",
    { class: "modal-body" },
    h("div", { class: "form-group" }, h("label", { for: "trackInvoice" }, "Número de factura"), factura),
    h("div", { class: "form-group" }, h("label", { for: "trackEmail" }, "Correo electrónico"), correo),
    btn,
    status,
    out
  );
  const modal = makeModal("rastreoModal", "Rastrear mi pedido", body);
  const STEPS = ["En preparación", "Enviado", "Entregado"];

  btn.addEventListener("click", async () => {
    out.replaceChildren();
    status.textContent = "Consultando…";
    try {
      const q = new URLSearchParams({ factura: factura.value.trim(), correo: correo.value.trim() });
      const res = await fetch(`/api/pedidos/rastrear?${q}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
      status.textContent = `Pedido #${d.pedido} · ${d.factura} · ${new Date(d.fecha).toLocaleDateString("es-CO")} · ${fmt(d.total)}`;
      const ol = h("ol", { class: "lu-steps" });
      if (d.estado_entrega === "Cancelado") {
        ol.append(h("li", { class: "lu-step cancel" }, "Cancelado"));
      } else {
        const current = STEPS.indexOf(d.estado_entrega);
        STEPS.forEach((s, i) => ol.append(h("li", { class: `lu-step${i <= current ? " done" : ""}` }, s)));
      }
      out.append(ol, h("p", {}, `Pago: ${d.estado_pago}`));
      const ul = h("ul");
      for (const it of d.items as { nombre: string; cantidad: number; precio: number }[]) {
        ul.append(h("li", {}, `${it.cantidad} × ${it.nombre} — ${fmt(it.precio)}`));
      }
      out.append(ul);
    } catch (err) {
      status.textContent = (err as Error).message;
    }
  });
  return modal;
}

// ------------------------------------------------------------
// 3) Modo claro / oscuro
// ------------------------------------------------------------
function applyTheme(theme: string) {
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem("lu-theme", theme); } catch { /* modo privado */ }
}

function initTheme(btn: HTMLButtonElement) {
  let saved = "light";
  try { saved = localStorage.getItem("lu-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch { /* ignore */ }
  applyTheme(saved);
  btn.addEventListener("click", () => applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));
}

// ------------------------------------------------------------
// Montaje en el encabezado
// ------------------------------------------------------------
function mount() {
  const actions = document.querySelector(".header-actions");
  if (!actions || document.getElementById("luArmarBtn")) return;
  const armador = initArmador();
  const rastreo = initRastreo();

  const mk = (id: string, label: string, text: string) => h("button", { class: "lu-action", id, type: "button", title: label, "aria-label": label }, text);
  const armarBtn = mk("luArmarBtn", "Armar PC por presupuesto", "🧩");
  const trackBtn = mk("luTrackBtn", "Rastrear mi pedido", "📦");
  const themeBtn = mk("luThemeBtn", "Cambiar entre modo claro y oscuro", "🌓");
  armarBtn.addEventListener("click", armador.open);
  trackBtn.addEventListener("click", rastreo.open);
  initTheme(themeBtn);

  const cart = actions.querySelector(".cart-btn");
  for (const b of [armarBtn, trackBtn, themeBtn]) (cart ? actions.insertBefore(b, cart) : actions.append(b));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
else mount();

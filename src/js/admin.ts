import "./theme-init";
import { api, sesion, logout } from "./auth";
if (sesion()?.rol !== "Administrador") location.href = "/src/pages/login.html"; // la API valida de nuevo: esto es solo comodidad

const msg = document.getElementById("msg")!, lista = document.getElementById("lista")!;
const aviso = (t: string, error = false) => { msg.textContent = t; msg.className = "form-msg " + (error ? "error" : "ok"); };

async function cargar() {
  const { products } = await api("/products");
  lista.replaceChildren(...products.map((p: any) => {
    const tr = document.createElement("tr");
    const celda = (...hijos: (Node | string)[]) => { const td = document.createElement("td"); td.append(...hijos); return td; };

    const nombre = celda(p.name);                    // texto plano: evita XSS
    nombre.className = "prod-name";
    const precio = document.createElement("input"); precio.type = "number"; precio.min = "1"; precio.value = p.price;
    const stock = document.createElement("input"); stock.type = "number"; stock.min = "0"; stock.value = p.stock;
    const guardar = document.createElement("button"); guardar.textContent = "Guardar"; guardar.className = "btn-primary btn-sm";
    const borrar = document.createElement("button"); borrar.textContent = "Eliminar"; borrar.className = "btn-danger btn-sm";

    guardar.onclick = async () => { try {
      await api(`/products/${p.id}`, { method: "PATCH", body: JSON.stringify({ price: Number(precio.value) }) });
      await api(`/products/${p.id}/stock`, { method: "PATCH", body: JSON.stringify({ stock: Number(stock.value) }) });
      aviso("Producto actualizado"); } catch (e) { aviso((e as Error).message, true); } };
    borrar.onclick = async () => { if (!confirm(`Â¿Eliminar "${p.name}"?`)) return; try {
      await api(`/products/${p.id}`, { method: "DELETE" }); aviso("Producto eliminado"); cargar(); } catch (e) { aviso((e as Error).message, true); } };

    const acciones = document.createElement("div"); acciones.className = "row-actions"; acciones.append(guardar, borrar);
    tr.append(nombre, celda(precio), celda(stock), celda(acciones));   // 4 columnas = 4 encabezados
    return tr;
  }));
}
document.getElementById("nuevo")!.addEventListener("submit", async (e) => {
  e.preventDefault(); const f = e.target as HTMLFormElement;
  try { await api("/products", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(f))) });
    aviso("Producto agregado"); f.reset(); cargar(); } catch (err) { aviso((err as Error).message, true); }
});
document.getElementById("salir")!.onclick = logout;
cargar();
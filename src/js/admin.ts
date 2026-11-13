import { api, sesion, logout } from "./auth";
if (sesion()?.rol !== "Administrador") location.href = "/src/pages/login.html"; // la API valida de nuevo: esto es solo comodidad

const msg = document.getElementById("msg")!, lista = document.getElementById("lista")!;
const aviso = (t: string) => (msg.textContent = t);

async function cargar() {
  const { products } = await api("/products");
  lista.replaceChildren(...products.map((p: any) => {
    const tr = document.createElement("tr");
    const nombre = document.createElement("td"); nombre.textContent = p.name;           // textContent evita XSS
    const precio = document.createElement("input"); precio.type = "number"; precio.value = p.price;
    const stock = document.createElement("input"); stock.type = "number"; stock.value = p.stock;
    const guardar = document.createElement("button"); guardar.textContent = "Guardar";
    const borrar = document.createElement("button"); borrar.textContent = "Eliminar";
    guardar.onclick = async () => { try {
      await api(`/products/${p.id}`, { method: "PATCH", body: JSON.stringify({ price: Number(precio.value) }) });
      await api(`/products/${p.id}/stock`, { method: "PATCH", body: JSON.stringify({ stock: Number(stock.value) }) });
      aviso("Producto actualizado"); } catch (e) { aviso((e as Error).message); } };
    borrar.onclick = async () => { if (!confirm(`¿Eliminar "${p.name}"?`)) return; try {
      await api(`/products/${p.id}`, { method: "DELETE" }); aviso("Producto eliminado"); cargar(); } catch (e) { aviso((e as Error).message); } };
    for (const el of [precio, stock, guardar, borrar]) { const td = document.createElement("td"); td.append(el); tr.append(nombre, td); }
    return tr;
  }));
}
document.getElementById("nuevo")!.addEventListener("submit", async (e) => {
  e.preventDefault(); const f = e.target as HTMLFormElement;
  try { await api("/products", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(f))) });
    aviso("Producto agregado"); f.reset(); cargar(); } catch (err) { aviso((err as Error).message); }
});
document.getElementById("salir")!.onclick = logout;
cargar();
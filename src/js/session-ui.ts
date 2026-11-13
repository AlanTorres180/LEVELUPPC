import { sesion, logout } from "./auth";

// Reemplaza el enlace "Ingresar" de la cabecera por el estado de la sesión.
const s = sesion();
const enlace = document.querySelector<HTMLAnchorElement>('a[href="/src/pages/login.html"]');

if (s && enlace) {
  const esAdmin = s.rol === "Administrador";
  const caja = document.createElement("span");
  caja.style.cssText = "display:inline-flex;gap:12px;align-items:center;flex-wrap:wrap";

  const quien = document.createElement("span");
  quien.textContent = `👤 ${s.correo}${esAdmin ? " (Administrador)" : ""}`; // textContent evita XSS
  caja.append(quien);

  if (esAdmin) {
    const panel = document.createElement("a");
    panel.href = "/src/pages/admin.html";
    panel.textContent = "Panel de administración";
    caja.append(panel);
  }

  const salir = document.createElement("a");
  salir.href = "#";
  salir.textContent = "Cerrar sesión";
  salir.addEventListener("click", (e) => { e.preventDefault(); logout(); });
  caja.append(salir);

  enlace.replaceWith(caja);
}
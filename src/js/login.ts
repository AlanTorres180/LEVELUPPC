import { api, login } from "./auth";
const f = document.getElementById("f") as HTMLFormElement;
const msg = document.getElementById("msg")!, extra = document.getElementById("extra")!;
let registro = false;

document.getElementById("alt")!.addEventListener("click", (e) => {
  e.preventDefault(); registro = !registro;
  extra.hidden = !registro; extra.style.display = registro ? "grid" : "none";
  document.getElementById("titulo")!.textContent = registro ? "Crear cuenta" : "Ingresar";
  (e.target as HTMLElement).textContent = registro ? "Ya tengo cuenta" : "¿No tienes cuenta? Regístrate";
});

f.addEventListener("submit", async (e) => {
  e.preventDefault(); msg.textContent = "";
  const d = Object.fromEntries(new FormData(f)) as Record<string, string>;
  try {
    if (registro) await api("/auth/register", { method: "POST", body: JSON.stringify(d) });
    const s = await login(d.correo, d.clave);
    location.href = s.rol === "Administrador" ? "/src/pages/admin.html" : "/";
  } catch (err) { msg.textContent = (err as Error).message; }
});
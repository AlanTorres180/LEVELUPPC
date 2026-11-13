import "./theme-init";
import { api, login } from "./auth";
const f = document.getElementById("f") as HTMLFormElement;
const msg = document.getElementById("msg")!, extra = document.getElementById("extra")!;
const titulo = document.getElementById("titulo")!, subtitulo = document.getElementById("subtitulo")!;
const enviar = document.getElementById("enviar")!, altTexto = document.getElementById("alt-texto")!;
const alt = document.getElementById("alt")!;
let registro = false;

const mostrar = (t: string, tipo: "error" | "ok" | "" = "") => { msg.textContent = t; msg.className = "form-msg " + tipo; };

alt.addEventListener("click", (e) => {
  e.preventDefault(); registro = !registro;
  extra.hidden = !registro; extra.style.display = registro ? "grid" : "none";
  titulo.textContent = registro ? "Crear cuenta" : "Ingresar";
  subtitulo.textContent = registro ? "Regístrate para comprar y seguir tus pedidos" : "Accede a tu cuenta de LevelUp PC";
  enviar.textContent = registro ? "Crear cuenta" : "Ingresar";
  altTexto.textContent = registro ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?";
  alt.textContent = registro ? "Inicia sesión" : "Regístrate";
  (document.getElementById("clave") as HTMLInputElement).autocomplete = registro ? "new-password" : "current-password";
  mostrar("");
});

f.addEventListener("submit", async (e) => {
  e.preventDefault(); mostrar("");
  const d = Object.fromEntries(new FormData(f)) as Record<string, string>;
  try {
    if (registro) await api("/auth/register", { method: "POST", body: JSON.stringify(d) });
    const s = await login(d.correo, d.clave);
    location.href = s.rol === "Administrador" ? "/src/pages/admin.html" : "/";
  } catch (err) { mostrar((err as Error).message, "error"); }
});
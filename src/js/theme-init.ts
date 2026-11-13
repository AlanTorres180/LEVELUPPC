// Aplica el tema claro/oscuro guardado por el resto del sitio ("lu-theme").
try {
  const t = localStorage.getItem("lu-theme") ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", t);
} catch { /* modo privado */ }
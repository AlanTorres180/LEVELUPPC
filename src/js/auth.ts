export type Sesion = { token: string; rol: string; correo: string };
export const sesion = (): Sesion | null => JSON.parse(sessionStorage.getItem("lu_session") || "null");

export async function api(path: string, opts: RequestInit = {}) {
  const s = sesion();
  const res = await fetch("/api" + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(s ? { Authorization: `Bearer ${s.token}` } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error del servidor");
  return data;
}
export async function login(correo: string, clave: string) {
  const d = await api("/auth/login", { method: "POST", body: JSON.stringify({ correo, clave }) });
  sessionStorage.setItem("lu_session", JSON.stringify(d));
  return d as Sesion;
}
export const logout = () => { sessionStorage.removeItem("lu_session"); location.href = "/"; };
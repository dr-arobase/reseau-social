export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const TOKEN_KEY = "a-propos-token";

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* stockage indisponible : la session ne durera que le temps de la fenêtre */ }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export async function api(path, { body, method = body ? "POST" : "GET", headers = {}, ...options } = {}) {
  const token = getToken();
  const isForm = body instanceof FormData;
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: { ...(body && !isForm && { "Content-Type": "application/json" }), ...(token && { Authorization: `Bearer ${token}` }), ...headers },
      body: body && !isForm ? JSON.stringify(body) : body,
      ...options,
    });
  } catch {
    throw new ApiError("Serveur injoignable. Vérifiez que l'API et la base de données sont lancées.", 0);
  }
  if (response.status === 401 && token) onUnauthorized();
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.error || "La requête a échoué.", response.status);
  }
  return response.status === 204 ? null : response.json();
}

export async function uploadImage(file) {
  const form = new FormData();
  form.append("file", file);
  const { url } = await api("/uploads", { body: form });
  return url;
}

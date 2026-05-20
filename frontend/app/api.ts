export const API_BASE_URL = "http://127.0.0.1:5000";
export const AUTH_TOKEN_KEY = "task_manager_token";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
};

export function getAuthToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

export function setAuthToken(token: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function authHeaders(extraHeaders?: HeadersInit): HeadersInit {
  const token = getAuthToken();
  return {
    ...(extraHeaders || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function apiFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: authHeaders(init?.headers),
  });
}

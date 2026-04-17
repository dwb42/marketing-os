// localStorage-backed client configuration.
// Values are read lazily — safe to import in server components (but effectively
// no-op there since localStorage is undefined).

export const DEFAULT_API_BASE = "https://marketing-os.b42.io";

const KEYS = {
  apiBase: "mos_api_base",
  token: "mos_token",
  workspaceId: "mos_workspace_id",
  productId: "mos_product_id",
} as const;

export function getApiBase(): string {
  if (typeof window === "undefined") return DEFAULT_API_BASE;
  return window.localStorage.getItem(KEYS.apiBase) || DEFAULT_API_BASE;
}

export function setApiBase(v: string): void {
  if (typeof window === "undefined") return;
  if (v) window.localStorage.setItem(KEYS.apiBase, v);
  else window.localStorage.removeItem(KEYS.apiBase);
}

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEYS.token) || "";
}

export function setToken(v: string): void {
  if (typeof window === "undefined") return;
  if (v) window.localStorage.setItem(KEYS.token, v);
  else window.localStorage.removeItem(KEYS.token);
}

export function getWorkspaceId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEYS.workspaceId) || "";
}

export function setWorkspaceId(v: string): void {
  if (typeof window === "undefined") return;
  if (v) window.localStorage.setItem(KEYS.workspaceId, v);
  else window.localStorage.removeItem(KEYS.workspaceId);
}

export function getProductId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(KEYS.productId) || "";
}

export function setProductId(v: string): void {
  if (typeof window === "undefined") return;
  if (v) window.localStorage.setItem(KEYS.productId, v);
  else window.localStorage.removeItem(KEYS.productId);
}

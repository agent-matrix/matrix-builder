// Self-issued HS256 JWT used to authenticate workflow API calls (ADR 0002: Supabase dropped).
//
// The token is read from localStorage ("mb_token") or a build-time env var. The CLI `mb login`
// (Track L2) mints/stores it with the shared MB_JWT_SECRET; the API verifies the same secret.

const STORAGE_KEY = "mb_token";
const USER_KEY = "mb_user";

export type AuthUser = { email?: string | null; name?: string | null; picture?: string | null };

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  }
  return process.env.NEXT_PUBLIC_MB_TOKEN ?? null;
}

export function setAuthToken(token: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, token);
}

export function hasAuthToken(): boolean {
  return Boolean(getAuthToken());
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

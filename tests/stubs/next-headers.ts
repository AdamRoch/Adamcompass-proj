// Vitest stub for `next/headers` so route handlers can be invoked without the Next runtime.
//
// We back cookies()/headers() with module-level stores that tests can populate via the helpers
// below (setMockCookie / clearMockCookies). This is enough for the bearer-/session-flow integration
// tests; we don't need full RequestStore semantics.

interface CookieEntry {
  name: string;
  value: string;
}

const cookieStore = new Map<string, string>();

export function setMockCookie(name: string, value: string) {
  cookieStore.set(name, value);
}

export function clearMockCookies() {
  cookieStore.clear();
}

class FakeCookies {
  get(name: string): CookieEntry | undefined {
    const value = cookieStore.get(name);
    return value === undefined ? undefined : { name, value };
  }
  set(name: string, value: string) {
    cookieStore.set(name, value);
  }
  delete(name: string) {
    cookieStore.delete(name);
  }
  getAll(): CookieEntry[] {
    return Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value }));
  }
}

const cookiesInstance = new FakeCookies();

export async function cookies() {
  return cookiesInstance;
}

export async function headers() {
  return new Headers();
}

export async function draftMode() {
  return { isEnabled: false, enable() {}, disable() {} };
}

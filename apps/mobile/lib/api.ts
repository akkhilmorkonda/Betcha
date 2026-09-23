import { authClient } from "./auth-client";
import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * The ONLY way this app talks to the API.
 *
 * React Native has no dependable cookie jar, so the session cookie must be
 * attached by hand on every non-auth call.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  // getCookie() returns a PROMISE. Without the await this sends the literal
  // string "[object Promise]" and every call is silently unauthenticated.
  const cookie = await authClient.getCookie();

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers ?? {}),
    },
    // Stops RN native cookie handling from clobbering the header above.
    credentials: "omit",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    // The API answers with { error } on every refusal, so surface that rather
    // than a status code. 429 carries a human message worth showing as-is.
    const message =
      (body as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }

  return body as T;
}

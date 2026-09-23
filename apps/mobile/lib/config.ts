/**
 * Where the API lives. EXPO_PUBLIC_ is inlined into the bundle at build time,
 * so this is per-build, not per-run.
 *
 * On a physical device "localhost" is the phone, not your machine, so dev
 * builds need a LAN IP or a tunnel host.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

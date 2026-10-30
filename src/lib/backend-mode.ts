/**
 * Client-side flag for "a real database is connected". Without it, the booking
 * and dashboard screens fall back to demo data kept in browser storage.
 */
export function hasPersistentBackend() {
  return process.env.NEXT_PUBLIC_PERSISTENT_BACKEND === "true";
}

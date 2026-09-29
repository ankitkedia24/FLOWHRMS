/**
 * "Acme Hardware & Co." -> "acme-hardware-co"
 *
 * Its own module because both sides need it: the server derives the stored
 * value, and the create-company form shows that value live as you type. It
 * cannot live in provision.ts — that is `server-only`, and importing it
 * into a client component fails at render time, not at build time
 * (src/tests/server-boundary.test.ts).
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

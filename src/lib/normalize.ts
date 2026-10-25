const SUFFIXES = /\b(inc|llc|llp|ltd|limited|pvt|private|corp|corporation|co|company)\b/g;

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
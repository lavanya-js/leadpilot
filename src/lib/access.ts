import type { Prisma } from "@prisma/client";
import type { SessionUser } from "./auth";

// Used in database queries: which leads can this user see?
export function leadScope(user: SessionUser): Prisma.LeadWhereInput {
  return user.role === "ADMIN" ? {} : { ownerId: user.id };
}

// Used when we already loaded one lead: can this user act on it?
export function canAccessLead(user: SessionUser, lead: { ownerId: string }): boolean {
  return user.role === "ADMIN" || lead.ownerId === user.id;
}
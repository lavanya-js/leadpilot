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

// Tasks a user may see: their own (assigned or created), or on leads they own. Admins see all.
export function taskScope(user: SessionUser): Prisma.TaskWhereInput {
  if (user.role === "ADMIN") return {};
  return {
    OR: [
      { assigneeId: user.id },
      { createdById: user.id },
      { lead: { ownerId: user.id } },
    ],
  };
}

export function canAccessTask(
  user: SessionUser,
  task: { assigneeId: string; createdById: string; lead?: { ownerId: string } | null }
): boolean {
  return (
    user.role === "ADMIN" ||
    task.assigneeId === user.id ||
    task.createdById === user.id ||
    task.lead?.ownerId === user.id
  );
}
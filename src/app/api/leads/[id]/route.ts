import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { withApi, ApiError } from "@/lib/api";
import { canAccessLead } from "@/lib/access";
import { leadUpdateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

const leadInclude = {
  stage: true,
  owner: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} as const;

// Returns the lead only if this user may access it. Otherwise 404 (don't reveal it exists).
async function loadLead(id: string, user: Awaited<ReturnType<typeof requireUser>>) {
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead || !canAccessLead(user, lead)) throw new ApiError(404, "Lead not found");
  return lead;
}

// GET /api/leads/:id  (includes timeline and tasks)
export const GET = withApi(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  await loadLead(id, user);

  const lead = await db.lead.findUnique({
    where: { id },
    include: {
      ...leadInclude,
      contact: true,
      activities: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
      tasks: {
        orderBy: { dueDate: "asc" },
        include: { assignee: { select: { id: true, name: true } } },
      },
    },
  });
  return NextResponse.json({ lead });
});

// PUT /api/leads/:id
export const PUT = withApi(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const existing = await loadLead(id, user);
  if (existing.archivedAt) throw new ApiError(409, "Archived leads cannot be edited");

  const data = leadUpdateSchema.parse(await req.json().catch(() => ({})));

  if (data.ownerId && data.ownerId !== existing.ownerId) {
    if (user.role !== "ADMIN") throw new ApiError(403, "Only admins can reassign leads");
    const owner = await db.user.findUnique({ where: { id: data.ownerId }, select: { id: true } });
    if (!owner) throw new ApiError(422, "Validation failed", { ownerId: ["Owner not found"] });
  }

  if (data.companyId) {
    const company = await db.company.findUnique({ where: { id: data.companyId } });
    if (!company || company.archivedAt) {
      throw new ApiError(422, "Validation failed", { companyId: ["Company not found"] });
    }
  }

  if (data.email) {
    const dup = await db.lead.findFirst({
      where: { email: data.email, archivedAt: null, id: { not: id } },
      select: { id: true },
    });
    if (dup) throw new ApiError(409, "A lead with this email already exists");
  }

  const lead = await db.lead.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      source: data.source,
      value: data.value,
      notes: data.notes,
      companyId: data.companyId,
      ownerId: data.ownerId ?? existing.ownerId,
    },
    include: leadInclude,
  });
  return NextResponse.json({ lead });
});

// DELETE /api/leads/:id  -> archives (soft delete) and logs it on the timeline
export const DELETE = withApi(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const existing = await loadLead(id, user);
  if (existing.archivedAt) return NextResponse.json({ lead: existing });

  const lead = await db.$transaction(async (tx) => {
    const archived = await tx.lead.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    await tx.activity.create({
      data: { type: "NOTE", body: "Lead archived", leadId: id, userId: user.id },
    });
    return archived;
  });
  return NextResponse.json({ lead });
});
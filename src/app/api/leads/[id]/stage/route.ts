import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { withApi, ApiError } from "@/lib/api";
import { canAccessLead } from "@/lib/access";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  stageId: z.string().trim().min(1, "Pick a stage"),
  version: z.coerce.number().int().min(0),
});

// PATCH /api/leads/:id/stage   body: { stageId, version }
export const PATCH = withApi(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const { stageId, version } = schema.parse(await req.json().catch(() => ({})));

  const lead = await db.lead.findUnique({ where: { id }, include: { stage: true } });
  if (!lead || !canAccessLead(user, lead)) throw new ApiError(404, "Lead not found");
  if (lead.archivedAt) throw new ApiError(409, "Archived leads cannot be moved");

  const target = await db.stage.findUnique({ where: { id: stageId } });
  if (!target) throw new ApiError(422, "Validation failed", { stageId: ["Stage not found"] });
  if (target.id === lead.stageId) {
    throw new ApiError(422, "Validation failed", { stageId: ["Lead is already in this stage"] });
  }

  // Business rule: a Won or Lost lead can only be reopened by an Admin.
  if (lead.stage.kind !== "OPEN" && user.role !== "ADMIN") {
    throw new ApiError(403, "Only admins can reopen a Won or Lost lead");
  }

  const updated = await db.$transaction(async (tx) => {
    // Optimistic lock: this only matches if nobody changed the lead since the user loaded it.
    const res = await tx.lead.updateMany({
      where: { id, version, archivedAt: null },
      data: { stageId: target.id, version: { increment: 1 } },
    });
    if (res.count === 0) {
      throw new ApiError(409, "This lead was changed by someone else. Refresh and try again.");
    }
    await tx.activity.create({
      data: {
        type: "STAGE_CHANGE",
        body: `Stage changed from ${lead.stage.name} to ${target.name}`,
        leadId: id,
        userId: user.id,
      },
    });
    return tx.lead.findUniqueOrThrow({
      where: { id },
      include: {
        stage: true,
        owner: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
      },
    });
  });

  return NextResponse.json({ lead: updated });
});
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { withApi, ApiError } from "@/lib/api";
import { canAccessLead } from "@/lib/access";
import { listParams } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

const createSchema = z.object({
  type: z.enum(["CALL", "MEETING", "EMAIL", "NOTE"], {
    message: "Pick a valid activity type",
  }),
  body: z.string().trim().min(2, "Write at least 2 characters").max(2000),
});

async function loadLead(id: string, user: Awaited<ReturnType<typeof requireUser>>) {
  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead || !canAccessLead(user, lead)) throw new ApiError(404, "Lead not found");
  return lead;
}

// GET /api/leads/:id/activities?page=1&pageSize=20  (newest first)
export const GET = withApi(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  await loadLead(id, user);

  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { page, pageSize } = listParams.parse(sp);

  const [items, total] = await Promise.all([
    db.activity.findMany({
      where: { leadId: id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true } } },
    }),
    db.activity.count({ where: { leadId: id } }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});

// POST /api/leads/:id/activities   body: { type, body }
export const POST = withApi(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const lead = await loadLead(id, user);
  if (lead.archivedAt) throw new ApiError(409, "Cannot log activity on an archived lead");

  const data = createSchema.parse(await req.json().catch(() => ({})));

  const activity = await db.activity.create({
    data: { type: data.type, body: data.body, leadId: id, userId: user.id },
    include: { user: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ activity }, { status: 201 });
});
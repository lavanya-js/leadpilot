import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { withApi, ApiError } from "@/lib/api";
import { canAccessLead, taskScope } from "@/lib/access";
import { listParams, taskCreateSchema } from "@/lib/schemas";

const filters = listParams.extend({
  status: z.enum(["all", "overdue", "upcoming", "completed"]).default("all"),
  assigneeId: z.string().optional(),
  leadId: z.string().optional(),
});

const taskInclude = {
  lead: { select: { id: true, name: true, ownerId: true } },
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

// GET /api/tasks?status=overdue|upcoming|completed|all&assigneeId=&leadId=&page=1&pageSize=20
export const GET = withApi(async (req: Request) => {
  const user = await requireUser();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { page, pageSize, q, status, assigneeId, leadId } = filters.parse(sp);
  const now = new Date();

  const statusFilter: Prisma.TaskWhereInput =
    status === "overdue"
      ? { completedAt: null, dueDate: { lt: now } }
      : status === "upcoming"
        ? { completedAt: null, dueDate: { gte: now } }
        : status === "completed"
          ? { completedAt: { not: null } }
          : {};

  const where: Prisma.TaskWhereInput = {
    AND: [
      taskScope(user), // Members only see their own tasks or tasks on their leads
      statusFilter,
      assigneeId ? { assigneeId } : {},
      leadId ? { leadId } : {},
      q ? { title: { contains: q } } : {},
    ],
  };

  const [rows, total] = await Promise.all([
    db.task.findMany({
      where,
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: taskInclude,
    }),
    db.task.count({ where }),
  ]);

  const items = rows.map((t) => ({
    ...t,
    state: t.completedAt ? "completed" : t.dueDate < now ? "overdue" : "upcoming",
  }));

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});

// POST /api/tasks   body: { title, dueDate, leadId?, assigneeId? }
export const POST = withApi(async (req: Request) => {
  const user = await requireUser();
  const data = taskCreateSchema.parse(await req.json().catch(() => ({})));

  if (user.role !== "ADMIN" && data.assigneeId && data.assigneeId !== user.id) {
    throw new ApiError(403, "Only admins can assign tasks to other people");
  }
  const assigneeId = data.assigneeId ?? user.id;

  const assignee = await db.user.findUnique({ where: { id: assigneeId }, select: { id: true } });
  if (!assignee) throw new ApiError(422, "Validation failed", { assigneeId: ["Assignee not found"] });

  if (data.leadId) {
    const lead = await db.lead.findUnique({ where: { id: data.leadId } });
    if (!lead || !canAccessLead(user, lead) || lead.archivedAt) {
      throw new ApiError(422, "Validation failed", { leadId: ["Lead not found"] });
    }
  }

  const task = await db.task.create({
    data: {
      title: data.title,
      dueDate: data.dueDate,
      leadId: data.leadId,
      assigneeId,
      createdById: user.id,
    },
    include: taskInclude,
  });
  return NextResponse.json({ task }, { status: 201 });
});
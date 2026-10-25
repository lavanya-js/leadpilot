import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { withApi, ApiError } from "@/lib/api";
import { canAccessTask } from "@/lib/access";
import { taskUpdateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

const taskInclude = {
  lead: { select: { id: true, name: true, ownerId: true } },
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

async function loadTask(id: string, user: Awaited<ReturnType<typeof requireUser>>) {
  const task = await db.task.findUnique({ where: { id }, include: taskInclude });
  if (!task || !canAccessTask(user, task)) throw new ApiError(404, "Task not found");
  return task;
}

// PATCH /api/tasks/:id   body: { title?, dueDate?, completed? }
export const PATCH = withApi(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const existing = await loadTask(id, user);
  const data = taskUpdateSchema.parse(await req.json().catch(() => ({})));

  const task = await db.task.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      ...(data.completed === true && !existing.completedAt ? { completedAt: new Date() } : {}),
      ...(data.completed === false ? { completedAt: null } : {}),
    },
    include: taskInclude,
  });
  return NextResponse.json({ task });
});

// DELETE /api/tasks/:id   (Admin or the task's creator)
export const DELETE = withApi(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const { id } = await params;
  const existing = await loadTask(id, user);

  if (user.role !== "ADMIN" && existing.createdById !== user.id) {
    throw new ApiError(403, "Only admins or the task creator can delete a task");
  }
  await db.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { withApi } from "@/lib/api";
import { leadScope, taskScope } from "@/lib/access";

// Percentage with one decimal, or null when there is nothing to divide by.
const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);
const DAY = 86_400_000;

// GET /api/dashboard
export const GET = withApi(async () => {
  const user = await requireUser();
  const now = new Date();

  const leadWhere: Prisma.LeadWhereInput = {
    AND: [leadScope(user), { archivedAt: null }],
  };
  const taskWhere = taskScope(user);

  const [stages, byStage, bySource, wonBySource, byOwner, newLast7, newLast30, overdue, dueSoon] =
    await Promise.all([
      db.stage.findMany({ orderBy: { position: "asc" } }),
      db.lead.groupBy({
        by: ["stageId"],
        where: leadWhere,
        _count: { _all: true },
        _sum: { value: true },
      }),
      db.lead.groupBy({ by: ["source"], where: leadWhere, _count: { _all: true } }),
      db.lead.groupBy({
        by: ["source"],
        where: { AND: [leadWhere, { stage: { kind: "WON" } }] },
        _count: { _all: true },
      }),
      db.lead.groupBy({ by: ["ownerId"], where: leadWhere, _count: { _all: true } }),
      db.lead.count({
        where: { AND: [leadWhere, { createdAt: { gte: new Date(now.getTime() - 7 * DAY) } }] },
      }),
      db.lead.count({
        where: { AND: [leadWhere, { createdAt: { gte: new Date(now.getTime() - 30 * DAY) } }] },
      }),
      db.task.count({
        where: { AND: [taskWhere, { completedAt: null, dueDate: { lt: now } }] },
      }),
      db.task.count({
        where: {
          AND: [
            taskWhere,
            { completedAt: null, dueDate: { gte: now, lte: new Date(now.getTime() + 7 * DAY) } },
          ],
        },
      }),
    ]);

  const stageRows = stages.map((s) => {
    const g = byStage.find((x) => x.stageId === s.id);
    return {
      id: s.id,
      name: s.name,
      kind: s.kind,
      count: g?._count._all ?? 0,
      value: g?._sum.value ?? 0,
    };
  });

  const total = stageRows.reduce((a, s) => a + s.count, 0);
  const ofKind = (kind: string) => stageRows.filter((s) => s.kind === kind);
  const won = ofKind("WON").reduce((a, s) => a + s.count, 0);
  const lost = ofKind("LOST").reduce((a, s) => a + s.count, 0);
  const open = ofKind("OPEN").reduce((a, s) => a + s.count, 0);

  const sources = bySource
    .map((s) => {
      const count = s._count._all;
      const wonCount = wonBySource.find((w) => w.source === s.source)?._count._all ?? 0;
      return { source: s.source, count, won: wonCount, conversionRate: pct(wonCount, count) };
    })
    .sort((a, b) => b.count - a.count);

  const owners = await db.user.findMany({
    where: { id: { in: byOwner.map((o) => o.ownerId) } },
    select: { id: true, name: true },
  });
  const ownerRows = byOwner
    .map((o) => ({
      id: o.ownerId,
      name: owners.find((u) => u.id === o.ownerId)?.name ?? "Unknown",
      count: o._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    summary: {
      totalLeads: total,
      openLeads: open,
      wonLeads: won,
      lostLeads: lost,
      newLast7Days: newLast7,
      newLast30Days: newLast30,
      pipelineValue: ofKind("OPEN").reduce((a, s) => a + s.value, 0),
      wonValue: ofKind("WON").reduce((a, s) => a + s.value, 0),
      winRate: pct(won, won + lost),
      conversionRate: pct(won, total),
    },
    stages: stageRows,
    sources,
    owners: ownerRows,
    tasks: { overdue, dueNext7Days: dueSoon },
  });
});
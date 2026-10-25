import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { withApi } from "@/lib/api";
import { leadScope } from "@/lib/access";

const filters = z.object({
  q: z.string().trim().max(100).optional(),
  stageId: z.string().optional(),
  source: z.string().optional(),
  ownerId: z.string().optional(),
});

const MAX_ROWS = 5000;

// Escapes quotes/commas/newlines and neutralises spreadsheet formulas.
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^\+?[\d\s\-()]+$/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/leads/export?q=&stageId=&source=&ownerId=
export const GET = withApi(async (req: Request) => {
  const user = await requireUser();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { q, stageId, source, ownerId } = filters.parse(sp);

  const where: Prisma.LeadWhereInput = {
    AND: [
      leadScope(user),
      sp.includeArchived === "true" ? {} : { archivedAt: null },
      stageId ? { stageId } : {},
      source ? { source } : {},
      ownerId ? { ownerId } : {},
      q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q } },
              { company: { name: { contains: q } } },
            ],
          }
        : {},
    ],
  };

  const leads = await db.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    include: {
      stage: { select: { name: true } },
      owner: { select: { name: true } },
      company: { select: { name: true } },
    },
  });

  const header = ["Name", "Email", "Phone", "Company", "Source", "Stage", "Owner", "Value (INR)", "Created", "Notes"];
  const rows = leads.map((l) => [
    l.name, l.email, l.phone, l.company?.name, l.source, l.stage.name,
    l.owner.name, l.value, l.createdAt, l.notes,
  ]);
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

  const date = new Date().toISOString().slice(0, 10);
  return new Response("\ufeff" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leadpilot-leads-${date}.csv"`,
    },
  });
});
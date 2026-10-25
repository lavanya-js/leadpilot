import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth";
import { withApi, ApiError } from "@/lib/api";
import { normalizeCompanyName } from "@/lib/normalize";
import { companyCreateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/companies/:id
export const GET = withApi(async (_req: Request, { params }: Ctx) => {
  await requireUser();
  const { id } = await params;
  const company = await db.company.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: { name: "asc" } },
      leads: {
        where: { archivedAt: null },
        orderBy: { createdAt: "desc" },
        include: { stage: true, owner: { select: { id: true, name: true } } },
      },
    },
  });
  if (!company) throw new ApiError(404, "Company not found");
  return NextResponse.json({ company });
});

// PUT /api/companies/:id  (replaces all editable fields)
export const PUT = withApi(async (req: Request, { params }: Ctx) => {
  await requireUser();
  const { id } = await params;
  const data = companyCreateSchema.parse(await req.json().catch(() => ({})));

  const existing = await db.company.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Company not found");

  const nameKey = normalizeCompanyName(data.name);
  if (!nameKey) {
    throw new ApiError(422, "Validation failed", { name: ["Enter a real company name"] });
  }

  // Same duplicate rule as create, ignoring this company itself.
  const dup = await db.company.findFirst({
    where: {
      id: { not: id },
      OR: [{ nameKey }, ...(data.domain ? [{ domain: data.domain }] : [])],
    },
    select: { id: true, name: true },
  });
  if (dup) {
    throw new ApiError(409, `A company "${dup.name}" already exists`, { existingId: dup.id });
  }

  try {
    const company = await db.company.update({ where: { id }, data: { ...data, nameKey } });
    return NextResponse.json({ company });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "This company already exists");
    }
    throw e;
  }
});

// DELETE /api/companies/:id  -> archives (soft delete). Admin only.
export const DELETE = withApi(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  const existing = await db.company.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Company not found");
  if (existing.archivedAt) return NextResponse.json({ company: existing }); // already archived

  const company = await db.company.update({ where: { id }, data: { archivedAt: new Date() } });
  return NextResponse.json({ company });
});
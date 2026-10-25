import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { withApi, ApiError } from "@/lib/api";
import { normalizeCompanyName } from "@/lib/normalize";
import { companyCreateSchema, listParams } from "@/lib/schemas";

// GET /api/companies?q=acme&page=1&pageSize=20&includeArchived=true
export const GET = withApi(async (req: Request) => {
  await requireUser();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { page, pageSize, q } = listParams.parse(sp);
  const includeArchived = sp.includeArchived === "true";

  const where: Prisma.CompanyWhereInput = {
    ...(includeArchived ? {} : { archivedAt: null }),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { domain: { contains: q } },
            { industry: { contains: q } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.company.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { leads: true, contacts: true } } },
    }),
    db.company.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});

// POST /api/companies
export const POST = withApi(async (req: Request) => {
  await requireUser();
  const data = companyCreateSchema.parse(await req.json().catch(() => ({})));

  const nameKey = normalizeCompanyName(data.name);
  if (!nameKey) {
    throw new ApiError(422, "Validation failed", { name: ["Enter a real company name"] });
  }

  // Duplicate rule: same normalized name OR same domain.
  const dup = await db.company.findFirst({
    where: { OR: [{ nameKey }, ...(data.domain ? [{ domain: data.domain }] : [])] },
    select: { id: true, name: true, archivedAt: true },
  });
  if (dup) {
    throw new ApiError(
      409,
      `A company "${dup.name}" already exists${dup.archivedAt ? " (archived)" : ""}`,
      { existingId: dup.id }
    );
  }

  try {
    const company = await db.company.create({ data: { ...data, nameKey } });
    return NextResponse.json({ company }, { status: 201 });
  } catch (e) {
    // Two requests can pass the check at the same time; the database's unique index catches that.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "This company already exists");
    }
    throw e;
  }
});
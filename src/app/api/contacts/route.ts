import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { withApi, ApiError } from "@/lib/api";
import { contactCreateSchema, listParams } from "@/lib/schemas";

const filters = listParams.extend({
  companyId: z.string().optional(),
});

const contactInclude = {
  company: { select: { id: true, name: true } },
} satisfies Prisma.ContactInclude;

// GET /api/contacts?q=&companyId=&page=1&pageSize=20
export const GET = withApi(async (req: Request) => {
  await requireUser();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { page, pageSize, q, companyId } = filters.parse(sp);

  const where: Prisma.ContactWhereInput = {
    AND: [
      companyId ? { companyId } : {},
      q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q } },
              { title: { contains: q } },
              { company: { name: { contains: q } } },
            ],
          }
        : {},
    ],
  };

  const [items, total] = await Promise.all([
    db.contact.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: contactInclude,
    }),
    db.contact.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});

// POST /api/contacts
export const POST = withApi(async (req: Request) => {
  await requireUser();
  const data = contactCreateSchema.parse(await req.json().catch(() => ({})));

  if (data.companyId) {
    const company = await db.company.findUnique({ where: { id: data.companyId } });
    if (!company || company.archivedAt) {
      throw new ApiError(422, "Validation failed", { companyId: ["Company not found"] });
    }
  }

  // Duplicate rule: one contact per email address.
  if (data.email) {
    const dup = await db.contact.findUnique({
      where: { email: data.email },
      select: { id: true, name: true },
    });
    if (dup) {
      throw new ApiError(409, `A contact "${dup.name}" with this email already exists`, {
        existingId: dup.id,
      });
    }
  }

  try {
    const contact = await db.contact.create({ data, include: contactInclude });
    return NextResponse.json({ contact }, { status: 201 });
  } catch (e) {
    // Two requests can pass the check at the same time; the unique index catches that.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "A contact with this email already exists");
    }
    throw e;
  }
});
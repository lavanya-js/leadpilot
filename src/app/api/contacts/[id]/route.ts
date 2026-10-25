import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth";
import { withApi, ApiError } from "@/lib/api";
import { contactCreateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ id: string }> };

const contactInclude = {
  company: { select: { id: true, name: true } },
} satisfies Prisma.ContactInclude;

// GET /api/contacts/:id
export const GET = withApi(async (_req: Request, { params }: Ctx) => {
  await requireUser();
  const { id } = await params;
  const contact = await db.contact.findUnique({ where: { id }, include: contactInclude });
  if (!contact) throw new ApiError(404, "Contact not found");
  return NextResponse.json({ contact });
});

// PUT /api/contacts/:id
export const PUT = withApi(async (req: Request, { params }: Ctx) => {
  await requireUser();
  const { id } = await params;
  const data = contactCreateSchema.parse(await req.json().catch(() => ({})));

  const existing = await db.contact.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Contact not found");

  if (data.companyId) {
    const company = await db.company.findUnique({ where: { id: data.companyId } });
    if (!company || company.archivedAt) {
      throw new ApiError(422, "Validation failed", { companyId: ["Company not found"] });
    }
  }

  if (data.email) {
    const dup = await db.contact.findFirst({
      where: { email: data.email, id: { not: id } },
      select: { id: true, name: true },
    });
    if (dup) {
      throw new ApiError(409, `A contact "${dup.name}" with this email already exists`, {
        existingId: dup.id,
      });
    }
  }

  try {
    const contact = await db.contact.update({ where: { id }, data, include: contactInclude });
    return NextResponse.json({ contact });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ApiError(409, "A contact with this email already exists");
    }
    throw e;
  }
});

// DELETE /api/contacts/:id  (Admin only; linked leads are kept)
export const DELETE = withApi(async (_req: Request, { params }: Ctx) => {
  await requireAdmin();
  const { id } = await params;
  const existing = await db.contact.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "Contact not found");

  await db.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
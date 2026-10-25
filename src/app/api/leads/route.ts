import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { withApi, ApiError } from "@/lib/api";
import { leadScope } from "@/lib/access";
import { leadCreateSchema, listParams } from "@/lib/schemas";

const filters = listParams.extend({
  stageId: z.string().optional(),
  source: z.string().optional(),
  ownerId: z.string().optional(),
});

const leadInclude = {
  stage: true,
  owner: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
} satisfies Prisma.LeadInclude;

// GET /api/leads?q=&stageId=&source=&ownerId=&page=1&pageSize=20&includeArchived=true
export const GET = withApi(async (req: Request) => {
  const user = await requireUser();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { page, pageSize, q, stageId, source, ownerId } = filters.parse(sp);

  const where: Prisma.LeadWhereInput = {
    AND: [
      leadScope(user), // Members only ever see their own leads
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

  const [items, total] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: leadInclude,
    }),
    db.lead.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});

// POST /api/leads   (optional header: Idempotency-Key)
export const POST = withApi(async (req: Request) => {
  const user = await requireUser();
  const data = leadCreateSchema.parse(await req.json().catch(() => ({})));

  if (user.role !== "ADMIN" && data.ownerId && data.ownerId !== user.id) {
    throw new ApiError(403, "Only admins can assign leads to other people");
  }
  const ownerId = data.ownerId ?? user.id;

  const [owner, stage, company] = await Promise.all([
    db.user.findUnique({ where: { id: ownerId }, select: { id: true } }),
    data.stageId
      ? db.stage.findUnique({ where: { id: data.stageId } })
      : db.stage.findFirst({ orderBy: { position: "asc" } }),
    data.companyId ? db.company.findUnique({ where: { id: data.companyId } }) : null,
  ]);
  if (!owner) throw new ApiError(422, "Validation failed", { ownerId: ["Owner not found"] });
  if (!stage) throw new ApiError(422, "Validation failed", { stageId: ["Stage not found"] });
  if (data.companyId && (!company || company.archivedAt)) {
    throw new ApiError(422, "Validation failed", { companyId: ["Company not found"] });
  }

  // Duplicate rule: one active lead per email address (archived leads don't count).
  if (data.email) {
    const dup = await db.lead.findFirst({
      where: { email: data.email, archivedAt: null },
      select: { id: true },
    });
    if (dup) throw new ApiError(409, "A lead with this email already exists");
  }

  const idemHeader = req.headers.get("idempotency-key");

  const lead = await db.$transaction(async (tx) => {
    if (idemHeader) {
      try {
        await tx.idempotencyKey.create({
          data: { key: `${user.id}:${idemHeader}`, userId: user.id },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new ApiError(409, "Duplicate submission ignored");
        }
        throw e;
      }
    }
    const created = await tx.lead.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        source: data.source,
        value: data.value,
        notes: data.notes,
        companyId: data.companyId,
        ownerId,
        stageId: stage.id,
      },
      include: leadInclude,
    });
    await tx.activity.create({
      data: { type: "NOTE", body: "Lead created", leadId: created.id, userId: user.id },
    });
    return created;
  });

  return NextResponse.json({ lead }, { status: 201 });
});
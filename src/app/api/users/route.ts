import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { withApi } from "@/lib/api";

// GET /api/users -> people a lead can be assigned to (admins: everyone, members: only themselves)
export const GET = withApi(async () => {
  const user = await requireUser();
  const users = await db.user.findMany({
    where: user.role === "ADMIN" ? {} : { id: user.id },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ users });
});
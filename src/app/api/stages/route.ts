import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { withApi } from "@/lib/api";

// GET /api/stages  -> pipeline stages in order
export const GET = withApi(async () => {
  await requireUser();
  const stages = await db.stage.findMany({ orderBy: { position: "asc" } });
  return NextResponse.json({ stages });
});
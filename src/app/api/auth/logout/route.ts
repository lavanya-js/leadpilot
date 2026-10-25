import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { withApi } from "@/lib/api";

export const POST = withApi(async () => {
  await destroySession();
  return NextResponse.json({ ok: true });
});
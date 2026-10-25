import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { withApi } from "@/lib/api";

export const GET = withApi(async () => {
  const user = await requireUser();
  return NextResponse.json({ user });
});
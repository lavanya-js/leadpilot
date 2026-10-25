import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { withApi, ApiError } from "@/lib/api";
import { normalizeEmail } from "@/lib/normalize";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// Simple in-memory throttle: 5 failures per email per 10 minutes.
// Known limitation: resets on server restart and isn't shared across instances.
const attempts = new Map<string, { count: number; reset: number }>();
const DUMMY_HASH = bcrypt.hashSync("dummy-password", 10); // keeps timing similar for unknown emails

export const POST = withApi(async (req: Request) => {
  const body = schema.parse(await req.json().catch(() => ({})));
  const email = normalizeEmail(body.email);
  const now = Date.now();

  const prev = attempts.get(email);
  const active = prev && prev.reset > now ? prev : undefined;
  if (active && active.count >= 5) {
    throw new ApiError(429, "Too many attempts. Try again in a few minutes.");
  }

  const user = await db.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(body.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok) {
    attempts.set(email, {
      count: (active?.count ?? 0) + 1,
      reset: active?.reset ?? now + 10 * 60_000,
    });
    throw new ApiError(401, "Invalid email or password");
  }

  attempts.delete(email);
  await createSession(user.id);
  return NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});
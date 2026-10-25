import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

// Wraps a route handler so every error becomes a consistent JSON response.
export function withApi<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json(
          { error: { message: e.message, details: e.details } },
          { status: e.status }
        );
      }
      if (e instanceof ZodError) {
        return NextResponse.json(
          { error: { message: "Validation failed", details: z.flattenError(e).fieldErrors } },
          { status: 422 }
        );
      }
      console.error(e);
      return NextResponse.json({ error: { message: "Internal server error" } }, { status: 500 });
    }
  };
}
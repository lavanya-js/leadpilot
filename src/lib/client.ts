export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, string[]>
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
      location.href = "/login";
    }
    throw new ApiClientError(res.status, data?.error?.message ?? "Something went wrong", data?.error?.details);
  }
  return data as T;
}

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const shortDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
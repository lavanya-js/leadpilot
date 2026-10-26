"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client";

type Me = { id: string; name: string; email: string; role: string };

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/tasks", label: "Tasks" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<{ user: Me }>("/api/auth/me")
      .then((r) => setMe(r.user))
      .catch(() => {});
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initials = me?.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen md:flex">
      <aside className="flex flex-col bg-ink text-white md:min-h-screen md:w-60 md:shrink-0">
        <div className="flex items-center justify-between px-5 py-4 md:block md:py-6">
          <p className="text-xl font-semibold">LeadPilot</p>
          <button
            onClick={logout}
            className="text-sm text-white/70 hover:text-white md:hidden"
          >
            Sign out
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden border-t border-white/10 p-4 md:block">
          {me ? (
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-harbor text-sm font-semibold">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{me.name}</p>
                <p className="text-xs text-white/60">
                  {me.role === "ADMIN" ? "Admin" : "Sales member"}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-9 animate-pulse rounded-lg bg-white/10" />
          )}
          <button
            onClick={logout}
            className="mt-3 w-full rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
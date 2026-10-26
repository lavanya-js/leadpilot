"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";

const STAGES = ["New", "Contacted", "Qualified", "Proposal", "Won"];

const DEMO = [
  { label: "Admin", email: "admin@leadpilot.test" },
  { label: "Sales member", email: "priya@leadpilot.test" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not sign in");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <section className="hidden flex-col justify-between bg-ink p-12 text-white lg:flex">
        <p className="font-display text-xl font-semibold">LeadPilot</p>

        <div>
          <h1 className="max-w-md font-display text-4xl font-semibold leading-tight">
            Every lead, one clear path to won.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Track leads, log conversations and follow up on time, with your whole pipeline in one place.
          </p>

          <ol className="mt-12 flex max-w-lg items-start">
            {STAGES.map((stage, i) => {
              const last = i === STAGES.length - 1;
              return (
                <li key={stage} className={last ? "" : "flex-1"}>
                  <div className="flex items-center">
                    <span
                      className={
                        last
                          ? "h-3 w-3 rounded-full bg-signal"
                          : "h-3 w-3 rounded-full bg-harbor ring-4 ring-harbor/30"
                      }
                    />
                    {!last && <span className="h-px flex-1 bg-white/25" />}
                  </div>
                  <span className="mt-3 block text-sm text-white/70">{stage}</span>
                </li>
              );
            })}
          </ol>
        </div>

        <p className="text-sm text-white/50">Sales pipeline management for small teams.</p>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center bg-white p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <p className="font-display text-xl font-semibold text-ink lg:hidden">LeadPilot</p>

          <div>
            <h2 className="font-display text-3xl font-semibold text-ink">Sign in</h2>
            <p className="mt-1 text-muted">Use your work email to continue.</p>
          </div>

          {error && (
            <p role="alert" className="border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <label className="block text-sm font-medium text-ink">
            Email
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-ink placeholder:text-muted/60"
              placeholder="you@company.com"
            />
          </label>

          <label className="block text-sm font-medium text-ink">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-ink"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-harbor px-4 py-2.5 font-medium text-white transition-colors hover:bg-harbor-dark disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>

          <div className="border-t border-line pt-4">
            <p className="text-sm text-muted">Demo accounts (password: Password123!)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword("Password123!");
                  }}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-mist"
                >
                  Use {d.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/client";

type Company = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  phone: string | null;
  _count: { leads: number; contacts: number };
};
type Res = { items: Company[]; total: number; page: number; pageSize: number; totalPages: number };

const PAGE_SIZE = 10;
const control = "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink";
const input = "mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink";
const EMPTY_FORM = { name: "", domain: "", industry: "", phone: "" };

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Res | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ user: { role: string } }>("/api/auth/me")
      .then((r) => setIsAdmin(r.user.role === "ADMIN"))
      .catch(() => {});
  }, []);

  // Wait a moment after typing before searching.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      setRes(await api<Res>(`/api/companies?${params}`));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load companies");
    }
  }, [q, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setActionError("");
    setFieldErrors({});
    setBusy(true);
    try {
      await api("/api/companies", { method: "POST", body: JSON.stringify(form) });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setActionError(err.status === 422 ? "Check the highlighted fields and try again." : err.message);
        setFieldErrors(err.details ?? {});
      } else {
        setActionError("Could not save the company. Try again.");
      }
    }
    setBusy(false);
  }

  async function archive(c: Company) {
    if (!confirm(`Archive ${c.name}? It will be hidden from this list, but its leads and history are kept.`)) return;
    setActionError("");
    setBusy(true);
    try {
      await api(`/api/companies/${c.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not archive the company");
    }
    setBusy(false);
  }

  const fe = (k: string) => fieldErrors[k]?.[0];
  const set = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const first = res && res.items.length > 0 ? (res.page - 1) * res.pageSize + 1 : 0;
  const last = res ? first + res.items.length - (res.items.length > 0 ? 1 : 0) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
          <p className="mt-1 text-muted">The organisations behind your leads and contacts.</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-harbor px-4 py-2 text-sm font-medium text-white hover:bg-harbor-dark"
        >
          {showForm ? "Close form" : "Add company"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="space-y-4 rounded-xl border border-line bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Company name
              <input required value={form.name} onChange={set("name")} className={input} />
              {fe("name") && <span className="mt-1 block text-sm font-normal text-red-700">{fe("name")}</span>}
            </label>
            <label className="block text-sm font-medium">
              Website domain
              <input value={form.domain} onChange={set("domain")} placeholder="acme.com" className={input} />
              {fe("domain") && <span className="mt-1 block text-sm font-normal text-red-700">{fe("domain")}</span>}
            </label>
            <label className="block text-sm font-medium">
              Industry
              <input value={form.industry} onChange={set("industry")} className={input} />
            </label>
            <label className="block text-sm font-medium">
              Phone
              <input value={form.phone} onChange={set("phone")} className={input} />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-harbor px-5 py-2 text-sm font-medium text-white hover:bg-harbor-dark disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save company"}
          </button>
        </form>
      )}

      {actionError && (
        <p role="alert" className="rounded-lg border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </p>
      )}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, domain or industry"
        aria-label="Search companies"
        className={control + " w-full sm:w-80"}
      />

      {error ? (
        <p role="alert" className="rounded-lg border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}. Refresh the page to try again.
        </p>
      ) : !res ? (
        <div className="h-64 animate-pulse rounded-xl bg-line" aria-busy="true" />
      ) : res.items.length === 0 ? (
        <div className="rounded-xl border border-line bg-white p-10 text-center">
          <p className="font-medium">{q ? "No companies match your search" : "No companies yet"}</p>
          <p className="mt-1 text-sm text-muted">
            {q ? "Try a different search." : "Add your first company to link leads and contacts to it."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-mist/60 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Industry</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 text-right font-medium">Contacts</th>
                  <th className="px-4 py-3 text-right font-medium">Leads</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {res.items.map((c) => (
                  <tr key={c.id} className="hover:bg-mist/40">
                    <td className="px-4 py-3">
                      <Link href={`/companies/${c.id}`} className="font-medium hover:text-harbor hover:underline">
                        {c.name}
                      </Link>
                      {c.domain && <p className="text-xs text-muted">{c.domain}</p>}
                    </td>
                    <td className="px-4 py-3">{c.industry ?? "-"}</td>
                    <td className="px-4 py-3">{c.phone ?? "-"}</td>
                    <td className="px-4 py-3 text-right">{c._count.contacts}</td>
                    <td className="px-4 py-3 text-right">{c._count.leads}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => archive(c)}
                          disabled={busy}
                          className="text-sm font-medium text-red-700 hover:underline disabled:opacity-50"
                        >
                          Archive
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            <p className="text-muted">
              Showing {first}-{last} of {res.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={res.page <= 1}
                className="rounded-lg border border-line px-3 py-1.5 font-medium hover:bg-mist disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={res.page >= res.totalPages}
                className="rounded-lg border border-line px-3 py-1.5 font-medium hover:bg-mist disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
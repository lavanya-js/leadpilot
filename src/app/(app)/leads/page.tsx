"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, inr, shortDate } from "@/lib/client";

type Lead = {
  id: string;
  name: string;
  email: string | null;
  source: string;
  value: number;
  createdAt: string;
  stage: { id: string; name: string; kind: string };
  owner: { id: string; name: string };
  company: { id: string; name: string } | null;
};
type Stage = { id: string; name: string; kind: string };
type Res = { items: Lead[]; total: number; page: number; pageSize: number; totalPages: number };

const SOURCES = ["Website", "Referral", "LinkedIn", "Cold Call", "Event"];
const PAGE_SIZE = 10;

const BADGE: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700",
  WON: "bg-green-50 text-green-700",
  LOST: "bg-slate-100 text-slate-600",
};

const control =
  "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-muted/70";

export default function LeadsPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [stageId, setStageId] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Res | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ stages: Stage[] }>("/api/stages")
      .then((r) => setStages(r.stages))
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

  const filters = new URLSearchParams();
  if (q) filters.set("q", q);
  if (stageId) filters.set("stageId", stageId);
  if (source) filters.set("source", source);
  const filterQuery = filters.toString();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams(filterQuery);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    api<Res>(`/api/leads?${params}`)
      .then((r) => {
        if (!cancelled) {
          setRes(r);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message ?? "Could not load leads");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filterQuery, page]);

  const hasFilters = Boolean(q || stageId || source);

  function clearFilters() {
    setSearch("");
    setQ("");
    setStageId("");
    setSource("");
    setPage(1);
  }

  const first = res && res.items.length > 0 ? (res.page - 1) * res.pageSize + 1 : 0;
  const last = res ? first + res.items.length - (res.items.length > 0 ? 1 : 0) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="mt-1 text-muted">Search, filter and manage everyone in your pipeline.</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/leads/export${filterQuery ? "?" + filterQuery : ""}`}
            className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-mist"
          >
            Export CSV
          </a>
          <Link
            href="/leads/new"
            className="rounded-lg bg-harbor px-4 py-2 text-sm font-medium text-white hover:bg-harbor-dark"
          >
            Add lead
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, phone or company"
          aria-label="Search leads"
          className={control + " w-full sm:w-80"}
        />
        <select
          value={stageId}
          onChange={(e) => {
            setStageId(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by stage"
          className={control}
        >
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by source"
          className={control}
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-sm font-medium text-harbor hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}. Refresh the page to try again.
        </p>
      ) : !res ? (
        <div className="h-72 animate-pulse rounded-xl bg-line" aria-busy="true" />
      ) : res.items.length === 0 ? (
        <div className="rounded-xl border border-line bg-white p-10 text-center">
          <p className="font-medium">{hasFilters ? "No leads match your filters" : "No leads yet"}</p>
          <p className="mt-1 text-sm text-muted">
            {hasFilters ? "Try a different search or clear the filters." : "Add your first lead to start the pipeline."}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-4 text-sm font-medium text-harbor hover:underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div
          className={
            "overflow-hidden rounded-xl border border-line bg-white transition-opacity " +
            (loading ? "opacity-60" : "")
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-mist/60 text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Stage</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {res.items.map((l) => (
                  <tr key={l.id} className="hover:bg-mist/40">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${l.id}`} className="font-medium text-ink hover:text-harbor hover:underline">
                        {l.name}
                      </Link>
                      {l.email && <p className="text-xs text-muted">{l.email}</p>}
                    </td>
                    <td className="px-4 py-3">{l.company?.name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className={"rounded-full px-2.5 py-1 text-xs font-medium " + (BADGE[l.stage.kind] ?? BADGE.OPEN)}>
                        {l.stage.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">{l.source}</td>
                    <td className="px-4 py-3 text-right">{inr(l.value)}</td>
                    <td className="px-4 py-3">{l.owner.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{shortDate(l.createdAt)}</td>
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
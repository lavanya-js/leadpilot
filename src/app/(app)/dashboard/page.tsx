"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, inr } from "@/lib/client";

type Dash = {
  summary: {
    totalLeads: number;
    openLeads: number;
    wonLeads: number;
    lostLeads: number;
    newLast7Days: number;
    newLast30Days: number;
    pipelineValue: number;
    wonValue: number;
    winRate: number | null;
    conversionRate: number | null;
  };
  stages: { id: string; name: string; kind: string; count: number; value: number }[];
  sources: { source: string; count: number; won: number; conversionRate: number | null }[];
  owners: { id: string; name: string; count: number }[];
  tasks: { overdue: number; dueNext7Days: number };
};

const pct = (v: number | null) => (v === null ? "-" : `${v}%`);

const BAR: Record<string, string> = {
  OPEN: "bg-harbor",
  WON: "bg-signal",
  LOST: "bg-slate-400",
};

export default function DashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dash>("/api/dashboard")
      .then(setData)
      .catch((e) => setError(e.message ?? "Could not load the dashboard"));
  }, []);

  if (error) {
    return (
      <p role="alert" className="rounded-lg border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}. Refresh the page to try again.
      </p>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded bg-line" />
        <div className="h-28 animate-pulse rounded-xl bg-line" />
        <div className="h-64 animate-pulse rounded-xl bg-line" />
      </div>
    );
  }

  const { summary, stages, sources, owners, tasks } = data;
  const maxCount = Math.max(1, ...stages.map((s) => s.count));

  const kpis = [
    { label: "Total leads", value: String(summary.totalLeads), note: `${summary.newLast7Days} new in the last 7 days` },
    { label: "Open pipeline", value: inr(summary.pipelineValue), note: `${summary.openLeads} open leads` },
    { label: "Won revenue", value: inr(summary.wonValue), note: `${summary.wonLeads} deals won` },
    { label: "Win rate", value: pct(summary.winRate), note: "Won out of closed deals" },
    { label: "Conversion rate", value: pct(summary.conversionRate), note: "Won out of all leads" },
  ];

  const panel = "rounded-xl border border-line bg-white p-5";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-muted">Where your pipeline stands today.</p>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white p-5">
            <p className="text-sm text-muted">{k.label}</p>
            <p className="mt-1 text-2xl font-semibold">{k.value}</p>
            <p className="mt-1 text-xs text-muted">{k.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className={panel + " lg:col-span-2"}>
          <h2 className="text-base font-semibold">Pipeline by stage</h2>
          <ul className="mt-4 space-y-3">
            {stages.map((s) => (
              <li key={s.id} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm">
                <span className="font-medium">{s.name}</span>
                <div className="h-2.5 rounded-full bg-mist" role="img" aria-label={`${s.count} leads in ${s.name}`}>
                  <div
                    className={"h-2.5 rounded-full " + (BAR[s.kind] ?? "bg-harbor")}
                    style={{ width: `${(s.count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-right text-muted">
                  <span className="font-medium text-ink">{s.count}</span> / {inr(s.value)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section className={panel}>
            <h2 className="text-base font-semibold">Follow-ups</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Link href="/tasks?status=overdue" className="block rounded-lg p-2 hover:bg-mist">
                <p className={"text-3xl font-semibold " + (tasks.overdue > 0 ? "text-red-600" : "")}>
                  {tasks.overdue}
                </p>
                <p className="text-sm text-muted">Overdue</p>
              </Link>
              <Link href="/tasks?status=upcoming" className="block rounded-lg p-2 hover:bg-mist">
                <p className="text-3xl font-semibold">{tasks.dueNext7Days}</p>
                <p className="text-sm text-muted">Due in 7 days</p>
              </Link>
            </div>
          </section>

          {owners.length > 1 && (
            <section className={panel}>
              <h2 className="text-base font-semibold">Leads by owner</h2>
              <ul className="mt-3 divide-y divide-line text-sm">
                {owners.map((o) => (
                  <li key={o.id} className="flex justify-between py-2">
                    <span>{o.name}</span>
                    <span className="font-medium">{o.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <section className={panel}>
        <h2 className="text-base font-semibold">Leads by source</h2>
        {sources.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No leads yet. Add your first lead to see sources here.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 font-medium">Source</th>
                  <th className="py-2 text-right font-medium">Leads</th>
                  <th className="py-2 text-right font-medium">Won</th>
                  <th className="py-2 text-right font-medium">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sources.map((s) => (
                  <tr key={s.source}>
                    <td className="py-2.5 font-medium">{s.source}</td>
                    <td className="py-2.5 text-right">{s.count}</td>
                    <td className="py-2.5 text-right">{s.won}</td>
                    <td className="py-2.5 text-right">{pct(s.conversionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError, inr } from "@/lib/client";

type Stage = { id: string; name: string; kind: string; position: number };
type Lead = {
  id: string;
  name: string;
  value: number;
  version: number;
  stageId: string;
  stage: Stage;
  owner: { id: string; name: string };
  company: { id: string; name: string } | null;
};

const TOP: Record<string, string> = {
  OPEN: "border-t-harbor",
  WON: "border-t-signal",
  LOST: "border-t-slate-400",
};

export default function PipelinePage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([
        api<{ stages: Stage[] }>("/api/stages"),
        api<{ items: Lead[]; total: number }>("/api/leads?pageSize=100"),
      ]);
      setStages(s.stages);
      setLeads(l.items);
      setTotal(l.total);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the pipeline");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function move(lead: Lead, stageId: string) {
    if (stageId === lead.stageId) return;
    const target = stages.find((s) => s.id === stageId);
    if (!target) return;
    setActionError("");

    // Show the move straight away, then confirm it with the server.
    setLeads((cur) => cur && cur.map((l) => (l.id === lead.id ? { ...l, stageId, stage: target } : l)));
    try {
      const r = await api<{ lead: Lead }>(`/api/leads/${lead.id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stageId, version: lead.version }),
      });
      setLeads((cur) => cur && cur.map((l) => (l.id === lead.id ? r.lead : l)));
    } catch (e) {
      setActionError(e instanceof ApiClientError ? e.message : "Could not move the lead");
      await load(); // put the board back in line with the server
    }
  }

  if (error) {
    return (
      <p role="alert" className="rounded-lg border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}. Refresh the page to try again.
      </p>
    );
  }

  if (!leads) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-48 animate-pulse rounded bg-line" />
        <div className="h-96 animate-pulse rounded-xl bg-line" />
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const visible = leads.filter(
    (l) => !q || l.name.toLowerCase().includes(q) || (l.company?.name ?? "").toLowerCase().includes(q)
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pipeline</h1>
          <p className="mt-1 text-muted">Drag a card to another column, or use its Move to menu.</p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by lead or company"
          aria-label="Filter the board"
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm sm:w-72"
        />
      </div>

      {actionError && (
        <p role="alert" className="rounded-lg border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </p>
      )}

      {total > leads.length && (
        <p className="text-sm text-muted">
          Showing the first {leads.length} of {total} leads. Use the Leads page to see all of them.
        </p>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((s) => {
          const cards = visible.filter((l) => l.stageId === s.id);
          const sum = cards.reduce((a, l) => a + l.value, 0);
          return (
            <section
              key={s.id}
              aria-label={`${s.name} stage`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverId(s.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const lead = leads.find((l) => l.id === e.dataTransfer.getData("text/plain"));
                setOverId(null);
                setDragId(null);
                if (lead) move(lead, s.id);
              }}
              className={
                "w-72 shrink-0 rounded-xl border border-t-4 bg-white " +
                (TOP[s.kind] ?? "border-t-harbor") +
                (overId === s.id && dragId ? " border-harbor ring-2 ring-harbor/30" : " border-line")
              }
            >
              <header className="border-b border-line px-4 py-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{s.name}</h2>
                  <span className="rounded-full bg-mist px-2.5 py-0.5 text-xs font-medium">{cards.length}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">{inr(sum)}</p>
              </header>

              <ul className="min-h-24 space-y-3 p-3">
                {cards.length === 0 && (
                  <li className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
                    No leads here
                  </li>
                )}
                {cards.map((l) => (
                  <li
                    key={l.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(l.id);
                      e.dataTransfer.setData("text/plain", l.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                    className={
                      "cursor-grab rounded-lg border border-line bg-white p-3 shadow-sm active:cursor-grabbing " +
                      (dragId === l.id ? "opacity-40" : "")
                    }
                  >
                    <Link href={`/leads/${l.id}`} className="font-medium hover:text-harbor hover:underline">
                      {l.name}
                    </Link>
                    <p className="text-xs text-muted">{l.company?.name ?? "No company"}</p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-semibold">{inr(l.value)}</span>
                      <span className="text-muted">{l.owner.name}</span>
                    </div>
                    <select
                      value={l.stageId}
                      onChange={(e) => move(l, e.target.value)}
                      aria-label={`Move ${l.name} to another stage`}
                      className="mt-2 w-full rounded-md border border-line bg-white px-2 py-1 text-xs"
                    >
                      {stages.map((st) => (
                        <option key={st.id} value={st.id}>
                          Move to: {st.name}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
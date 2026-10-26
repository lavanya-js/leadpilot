"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, ApiClientError, inr, shortDate } from "@/lib/client";

type Stage = { id: string; name: string; kind: string; position: number };
type Activity = {
  id: string;
  type: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string };
};
type Task = {
  id: string;
  title: string;
  dueDate: string;
  completedAt: string | null;
  assignee: { id: string; name: string };
};
type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  value: number;
  notes: string | null;
  version: number;
  archivedAt: string | null;
  createdAt: string;
  stageId: string;
  stage: Stage;
  owner: { id: string; name: string };
  company: { id: string; name: string } | null;
  activities: Activity[];
  tasks: Task[];
};

const TYPE_LABEL: Record<string, string> = {
  CALL: "Call",
  MEETING: "Meeting",
  EMAIL: "Email",
  NOTE: "Note",
  STAGE_CHANGE: "Stage change",
};

const when = (d: string) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const panel = "rounded-xl border border-line bg-white p-5";
const control = "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink";

function errText(e: unknown) {
  if (e instanceof ApiClientError && e.details) {
    const msgs = Object.values(e.details).flat();
    if (msgs.length) return msgs.join(" ");
  }
  return e instanceof Error ? e.message : "Something went wrong";
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actType, setActType] = useState("NOTE");
  const [actBody, setActBody] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api<{ lead: Lead }>(`/api/leads/${id}`);
      setLead(r.lead);
      setError("");
    } catch (e) {
      setError(errText(e));
    }
  }, [id]);

  useEffect(() => {
    load();
    api<{ stages: Stage[] }>("/api/stages")
      .then((r) => setStages(r.stages))
      .catch(() => {});
  }, [load]);

  // Runs an action, shows any error, then always refreshes so the screen matches the server.
  async function run(fn: () => Promise<unknown>) {
    setActionError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setActionError(errText(e));
    }
    await load();
    setBusy(false);
  }

  const moveTo = (stageId: string) =>
    run(() =>
      api(`/api/leads/${id}/stage`, {
        method: "PATCH",
        body: JSON.stringify({ stageId, version: lead!.version }),
      })
    );

  function logActivity(e: React.FormEvent) {
    e.preventDefault();
    return run(async () => {
      await api(`/api/leads/${id}/activities`, {
        method: "POST",
        body: JSON.stringify({ type: actType, body: actBody }),
      });
      setActBody("");
    });
  }

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    return run(async () => {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title: taskTitle, dueDate: taskDue, leadId: id }),
      });
      setTaskTitle("");
      setTaskDue("");
    });
  }

  const toggleTask = (t: Task) =>
    run(() =>
      api(`/api/tasks/${t.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !t.completedAt }),
      })
    );

  async function archive() {
    if (!confirm("Archive this lead? It will be hidden from lists, but its history is kept.")) return;
    setBusy(true);
    setActionError("");
    try {
      await api(`/api/leads/${id}`, { method: "DELETE" });
      router.push("/leads");
    } catch (e) {
      setActionError(errText(e));
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-lg border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
        <Link href="/leads" className="text-sm font-medium text-harbor hover:underline">
          Back to leads
        </Link>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded bg-line" />
        <div className="h-16 animate-pulse rounded-xl bg-line" />
        <div className="h-80 animate-pulse rounded-xl bg-line" />
      </div>
    );
  }

  const archived = Boolean(lead.archivedAt);
  const now = Date.now();

  const details: [string, string][] = [
    ["Email", lead.email ?? "-"],
    ["Phone", lead.phone ?? "-"],
    ["Source", lead.source],
    ["Deal value", inr(lead.value)],
    ["Owner", lead.owner.name],
    ["Company", lead.company?.name ?? "-"],
    ["Added", shortDate(lead.createdAt)],
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/leads" className="text-sm font-medium text-harbor hover:underline">
          Back to leads
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{lead.name}</h1>
            <p className="mt-1 text-muted">
              {lead.company ? `Lead at ${lead.company.name}` : "No company linked"}
            </p>
          </div>
          {!archived && (
            <button
              onClick={archive}
              disabled={busy}
              className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-mist disabled:opacity-50"
            >
              Archive lead
            </button>
          )}
        </div>
      </div>

      {archived && (
        <p className="rounded-lg border-l-4 border-slate-400 bg-slate-100 px-4 py-3 text-sm text-slate-700">
          This lead is archived. It is read-only and hidden from the main lists.
        </p>
      )}

      {actionError && (
        <p role="alert" className="rounded-lg border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </p>
      )}

      <section className={panel}>
        <h2 className="text-base font-semibold">Pipeline stage</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {stages.map((s) => {
            const current = s.id === lead.stageId;
            return (
              <button
                key={s.id}
                onClick={() => moveTo(s.id)}
                disabled={busy || archived || current}
                aria-pressed={current}
                className={
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors " +
                  (current
                    ? "border-harbor bg-harbor text-white"
                    : "border-line bg-white hover:bg-mist disabled:opacity-50")
                }
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className={panel + " lg:col-span-2"}>
          <h2 className="text-base font-semibold">Activity timeline</h2>

          {!archived && (
            <form onSubmit={logActivity} className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <select
                  value={actType}
                  onChange={(e) => setActType(e.target.value)}
                  aria-label="Activity type"
                  className={control}
                >
                  <option value="NOTE">Note</option>
                  <option value="CALL">Call</option>
                  <option value="MEETING">Meeting</option>
                  <option value="EMAIL">Email</option>
                </select>
                <input
                  value={actBody}
                  onChange={(e) => setActBody(e.target.value)}
                  placeholder="What happened?"
                  aria-label="Activity details"
                  className={control + " min-w-0 flex-1"}
                />
                <button
                  type="submit"
                  disabled={busy || actBody.trim().length < 2}
                  className="rounded-lg bg-harbor px-4 py-2 text-sm font-medium text-white hover:bg-harbor-dark disabled:opacity-50"
                >
                  Log activity
                </button>
              </div>
            </form>
          )}

          {lead.activities.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nothing logged yet. Log your first call or note above.</p>
          ) : (
            <ol className="mt-5 space-y-5 border-l border-line pl-5">
              {lead.activities.map((a) => (
                <li key={a.id} className="relative">
                  <span
                    className={
                      "absolute -left-[1.62rem] top-1.5 h-2.5 w-2.5 rounded-full " +
                      (a.type === "STAGE_CHANGE" ? "bg-signal" : "bg-harbor")
                    }
                  />
                  <p className="text-sm">
                    <span className="font-semibold">{TYPE_LABEL[a.type] ?? a.type}</span>
                    <span className="text-muted">
                      {" "}
                      by {a.user.name}, {when(a.createdAt)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm">{a.body}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="space-y-6">
          <section className={panel}>
            <h2 className="text-base font-semibold">Details</h2>
            <dl className="mt-3 divide-y divide-line text-sm">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2">
                  <dt className="text-muted">{k}</dt>
                  <dd className="break-all text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {lead.notes && <p className="mt-3 rounded-lg bg-mist p-3 text-sm">{lead.notes}</p>}
          </section>

          <section className={panel}>
            <h2 className="text-base font-semibold">Follow-up tasks</h2>

            {!archived && (
              <form onSubmit={addTask} className="mt-3 space-y-2">
                <input
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Send proposal"
                  aria-label="Task title"
                  className={control + " w-full"}
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)}
                    aria-label="Due date"
                    className={control + " min-w-0 flex-1"}
                  />
                  <button
                    type="submit"
                    disabled={busy || taskTitle.trim().length < 2 || !taskDue}
                    className="rounded-lg bg-harbor px-4 py-2 text-sm font-medium text-white hover:bg-harbor-dark disabled:opacity-50"
                  >
                    Add task
                  </button>
                </div>
              </form>
            )}

            {lead.tasks.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No follow-ups yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {lead.tasks.map((t) => {
                  const overdue = !t.completedAt && new Date(t.dueDate).getTime() < now;
                  return (
                    <li key={t.id} className="flex items-start gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(t.completedAt)}
                        onChange={() => toggleTask(t)}
                        disabled={busy || archived}
                        aria-label={`Mark "${t.title}" as done`}
                        className="mt-1 h-4 w-4 accent-[#2563eb]"
                      />
                      <div>
                        <p className={t.completedAt ? "text-muted line-through" : "font-medium"}>{t.title}</p>
                        <p className={"text-xs " + (overdue ? "font-medium text-red-600" : "text-muted")}>
                          {t.completedAt ? "Done" : overdue ? "Overdue, due " : "Due "}
                          {!t.completedAt && shortDate(t.dueDate)}
                          {" "}for {t.assignee.name}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
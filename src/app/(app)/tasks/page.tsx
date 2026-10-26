"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiClientError, shortDate } from "@/lib/client";

type Task = {
  id: string;
  title: string;
  dueDate: string;
  completedAt: string | null;
  state: "overdue" | "upcoming" | "completed";
  lead: { id: string; name: string } | null;
  assignee: { id: string; name: string };
};
type Res = { items: Task[]; total: number; page: number; pageSize: number; totalPages: number };
type UserRow = { id: string; name: string };

const TABS = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

const EMPTY: Record<string, string> = {
  all: "No tasks yet. Add your first follow-up above.",
  overdue: "Nothing overdue. You are all caught up.",
  upcoming: "No upcoming tasks.",
  completed: "No completed tasks yet.",
};

const BADGE: Record<string, string> = {
  overdue: "bg-red-50 text-red-700",
  upcoming: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
};
const BADGE_LABEL: Record<string, string> = {
  overdue: "Overdue",
  upcoming: "Upcoming",
  completed: "Done",
};

const PAGE_SIZE = 10;
const control = "rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink";

function errText(e: unknown) {
  if (e instanceof ApiClientError && e.details) {
    const msgs = Object.values(e.details).flat();
    if (msgs.length) return msgs.join(" ");
  }
  return e instanceof Error ? e.message : "Something went wrong";
}

export default function TasksPage() {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Res | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  // Open the tab named in the link (for example from the dashboard's Overdue box).
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("status");
    if (s && TABS.some((t) => t.key === s)) setStatus(s);
    setReady(true);
  }, []);

  useEffect(() => {
    api<{ users: UserRow[] }>("/api/users")
      .then((r) => setUsers(r.users))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api<Res>(`/api/tasks?status=${status}&page=${page}&pageSize=${PAGE_SIZE}`);
      setRes(r);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load tasks");
    }
  }, [status, page]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  function changeTab(key: string) {
    if (key === status) return;
    setStatus(key);
    setPage(1);
    setRes(null);
  }

  async function toggle(t: Task) {
    setActionError("");
    setBusy(true);
    try {
      await api(`/api/tasks/${t.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !t.completedAt }),
      });
    } catch (e) {
      setActionError(errText(e));
    }
    await load();
    setBusy(false);
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setActionError("");
    setBusy(true);
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ title, dueDate: due, ...(assigneeId ? { assigneeId } : {}) }),
      });
      setTitle("");
      setDue("");
      await load();
    } catch (err) {
      setActionError(errText(err));
    }
    setBusy(false);
  }

  const first = res && res.items.length > 0 ? (res.page - 1) * res.pageSize + 1 : 0;
  const last = res ? first + res.items.length - (res.items.length > 0 ? 1 : 0) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="mt-1 text-muted">Follow-ups for you and your team, in due-date order.</p>
      </div>

      <form onSubmit={addTask} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task, e.g. Send proposal"
          aria-label="Task title"
          className={control + " min-w-0 flex-1 basis-56"}
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          aria-label="Due date"
          className={control}
        />
        {users.length > 1 && (
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            aria-label="Assign to"
            className={control}
          >
            <option value="">Assign to me</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={busy || title.trim().length < 2 || !due}
          className="rounded-lg bg-harbor px-4 py-2 text-sm font-medium text-white hover:bg-harbor-dark disabled:opacity-50"
        >
          Add task
        </button>
      </form>

      {actionError && (
        <p role="alert" className="rounded-lg border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </p>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter tasks">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => changeTab(t.key)}
            aria-pressed={status === t.key}
            className={
              "rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors " +
              (status === t.key
                ? "border-harbor bg-harbor text-white"
                : "border-line bg-white hover:bg-mist")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}. Refresh the page to try again.
        </p>
      ) : !res ? (
        <div className="h-64 animate-pulse rounded-xl bg-line" aria-busy="true" />
      ) : res.items.length === 0 ? (
        <div className="rounded-xl border border-line bg-white p-10 text-center text-sm text-muted">
          {EMPTY[status]}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-mist/60 text-muted">
                <tr>
                  <th className="w-10 px-4 py-3" />
                  <th className="px-4 py-3 font-medium">Task</th>
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Assigned to</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {res.items.map((t) => (
                  <tr key={t.id} className="hover:bg-mist/40">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(t.completedAt)}
                        onChange={() => toggle(t)}
                        disabled={busy}
                        aria-label={`Mark "${t.title}" as done`}
                        className="h-4 w-4 accent-[#2563eb]"
                      />
                    </td>
                    <td className={"px-4 py-3 font-medium " + (t.completedAt ? "text-muted line-through" : "")}>
                      {t.title}
                    </td>
                    <td className="px-4 py-3">
                      {t.lead ? (
                        <Link href={`/leads/${t.lead.id}`} className="hover:text-harbor hover:underline">
                          {t.lead.name}
                        </Link>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{t.assignee.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">{shortDate(t.dueDate)}</td>
                    <td className="px-4 py-3">
                      <span className={"rounded-full px-2.5 py-1 text-xs font-medium " + BADGE[t.state]}>
                        {BADGE_LABEL[t.state]}
                      </span>
                    </td>
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
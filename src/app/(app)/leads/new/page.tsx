"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client";

const SOURCES = ["Website", "Referral", "LinkedIn", "Cold Call", "Event"];

type Company = { id: string; name: string };
type UserRow = { id: string; name: string };

const input = "mt-1.5 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-ink";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      {children}
      {error && <span className="mt-1 block text-sm font-normal text-red-700">{error}</span>}
    </label>
  );
}

export default function NewLeadPage() {
  const router = useRouter();
  const idemKey = useRef(crypto.randomUUID());
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    source: "Website",
    value: "",
    companyId: "",
    ownerId: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ items: Company[] }>("/api/companies?pageSize=100")
      .then((r) => setCompanies(r.items))
      .catch(() => {});
    api<{ users: UserRow[] }>("/api/users")
      .then((r) => setUsers(r.users))
      .catch(() => {});
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setBusy(true);
    try {
      const body = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        source: form.source,
        value: Number(form.value || 0),
        notes: form.notes,
        companyId: form.companyId || null,
        ...(form.ownerId ? { ownerId: form.ownerId } : {}),
      };
      const r = await api<{ lead: { id: string } }>("/api/leads", {
        method: "POST",
        headers: { "Idempotency-Key": idemKey.current },
        body: JSON.stringify(body),
      });
      router.push(`/leads/${r.lead.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.status === 422 ? "Check the highlighted fields and try again." : err.message);
        setFieldErrors(err.details ?? {});
      } else {
        setError("Could not save the lead. Try again.");
      }
      setBusy(false);
    }
  }

  const fe = (k: string) => fieldErrors[k]?.[0];

  return (
    <div className="max-w-2xl">
      <Link href="/leads" className="text-sm font-medium text-harbor hover:underline">
        Back to leads
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Add lead</h1>
      <p className="mt-1 text-muted">Add someone new to the pipeline. They start in the New stage.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-5 rounded-xl border border-line bg-white p-6">
        {error && (
          <p role="alert" className="border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <Field label="Name" error={fe("name")}>
          <input required value={form.name} onChange={set("name")} className={input} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" error={fe("email")}>
            <input type="email" value={form.email} onChange={set("email")} className={input} />
          </Field>
          <Field label="Phone" error={fe("phone")}>
            <input value={form.phone} onChange={set("phone")} className={input} placeholder="+91 98765 43210" />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Source" error={fe("source")}>
            <select value={form.source} onChange={set("source")} className={input}>
              {SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Deal value (INR)" error={fe("value")}>
            <input type="number" min={0} value={form.value} onChange={set("value")} className={input} />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Company" error={fe("companyId")}>
            <select value={form.companyId} onChange={set("companyId")} className={input}>
              <option value="">No company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          {users.length > 1 && (
            <Field label="Owner" error={fe("ownerId")}>
              <select value={form.ownerId} onChange={set("ownerId")} className={input}>
                <option value="">Me (default)</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <Field label="Notes" error={fe("notes")}>
          <textarea rows={3} value={form.notes} onChange={set("notes")} className={input} />
        </Field>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-harbor px-5 py-2.5 text-sm font-medium text-white hover:bg-harbor-dark disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save lead"}
          </button>
          <Link
            href="/leads"
            className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium hover:bg-mist"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
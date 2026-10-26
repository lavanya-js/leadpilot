"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, ApiClientError, inr } from "@/lib/client";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
};
type LeadRow = {
  id: string;
  name: string;
  value: number;
  stage: { name: string; kind: string };
  owner: { name: string };
};
type Company = {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  phone: string | null;
  notes: string | null;
  archivedAt: string | null;
  contacts: Contact[];
  leads: LeadRow[];
};

const BADGE: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700",
  WON: "bg-green-50 text-green-700",
  LOST: "bg-slate-100 text-slate-600",
};

const panel = "rounded-xl border border-line bg-white p-5";
const input = "mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink";
const EMPTY_CONTACT = { name: "", email: "", phone: "", title: "" };

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
      {error && <span className="mt-1 block text-sm font-normal text-red-700">{error}</span>}
    </label>
  );
}

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const [editCo, setEditCo] = useState(false);
  const [coForm, setCoForm] = useState({ name: "", domain: "", industry: "", phone: "", notes: "" });
  const [coErrors, setCoErrors] = useState<Record<string, string[]>>({});

  const [showContact, setShowContact] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cForm, setCForm] = useState(EMPTY_CONTACT);
  const [cErrors, setCErrors] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    try {
      const r = await api<{ company: Company }>(`/api/companies/${id}`);
      setCompany(r.company);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the company");
    }
  }, [id]);

  useEffect(() => {
    load();
    api<{ user: { role: string } }>("/api/auth/me")
      .then((r) => setIsAdmin(r.user.role === "ADMIN"))
      .catch(() => {});
  }, [load]);

  function openCompanyEdit() {
    if (!company) return;
    setCoForm({
      name: company.name,
      domain: company.domain ?? "",
      industry: company.industry ?? "",
      phone: company.phone ?? "",
      notes: company.notes ?? "",
    });
    setCoErrors({});
    setActionError("");
    setEditCo(true);
  }

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    setActionError("");
    setCoErrors({});
    setBusy(true);
    try {
      await api(`/api/companies/${id}`, { method: "PUT", body: JSON.stringify(coForm) });
      setEditCo(false);
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setActionError(err.status === 422 ? "Check the highlighted fields and try again." : err.message);
        setCoErrors(err.details ?? {});
      } else {
        setActionError("Could not save the company. Try again.");
      }
    }
    setBusy(false);
  }

  function openContactForm(c?: Contact) {
    setCErrors({});
    setActionError("");
    setEditingId(c?.id ?? null);
    setCForm(
      c ? { name: c.name, email: c.email ?? "", phone: c.phone ?? "", title: c.title ?? "" } : EMPTY_CONTACT
    );
    setShowContact(true);
  }

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    setActionError("");
    setCErrors({});
    setBusy(true);
    try {
      const body = JSON.stringify({ ...cForm, companyId: id });
      if (editingId) await api(`/api/contacts/${editingId}`, { method: "PUT", body });
      else await api("/api/contacts", { method: "POST", body });
      setShowContact(false);
      setEditingId(null);
      setCForm(EMPTY_CONTACT);
      await load();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setActionError(err.status === 422 ? "Check the highlighted fields and try again." : err.message);
        setCErrors(err.details ?? {});
      } else {
        setActionError("Could not save the contact. Try again.");
      }
    }
    setBusy(false);
  }

  async function deleteContact(c: Contact) {
    if (!confirm(`Delete ${c.name}? Leads linked to this contact are kept.`)) return;
    setActionError("");
    setBusy(true);
    try {
      await api(`/api/contacts/${c.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete the contact");
    }
    setBusy(false);
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-lg border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
        <Link href="/companies" className="text-sm font-medium text-harbor hover:underline">
          Back to companies
        </Link>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded bg-line" />
        <div className="h-72 animate-pulse rounded-xl bg-line" />
      </div>
    );
  }

  const ce = (k: string) => coErrors[k]?.[0];
  const ke = (k: string) => cErrors[k]?.[0];
  const setCo = (k: keyof typeof coForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCoForm((f) => ({ ...f, [k]: e.target.value }));
  const setC = (k: keyof typeof EMPTY_CONTACT) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/companies" className="text-sm font-medium text-harbor hover:underline">
          Back to companies
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{company.name}</h1>
            <p className="mt-1 text-muted">
              {[company.industry, company.domain].filter(Boolean).join(", ") || "No details added yet"}
            </p>
          </div>
          {!editCo && (
            <button
              onClick={openCompanyEdit}
              className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-mist"
            >
              Edit company
            </button>
          )}
        </div>
      </div>

      {company.archivedAt && (
        <p className="rounded-lg border-l-4 border-slate-400 bg-slate-100 px-4 py-3 text-sm text-slate-700">
          This company is archived and hidden from the main list.
        </p>
      )}

      {actionError && (
        <p role="alert" className="rounded-lg border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </p>
      )}

      {editCo && (
        <form onSubmit={saveCompany} className={panel + " space-y-4"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" error={ce("name")}>
              <input required value={coForm.name} onChange={setCo("name")} className={input} />
            </Field>
            <Field label="Website domain" error={ce("domain")}>
              <input value={coForm.domain} onChange={setCo("domain")} className={input} />
            </Field>
            <Field label="Industry" error={ce("industry")}>
              <input value={coForm.industry} onChange={setCo("industry")} className={input} />
            </Field>
            <Field label="Phone" error={ce("phone")}>
              <input value={coForm.phone} onChange={setCo("phone")} className={input} />
            </Field>
          </div>
          <Field label="Notes" error={ce("notes")}>
            <textarea rows={3} value={coForm.notes} onChange={setCo("notes")} className={input} />
          </Field>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-harbor px-5 py-2 text-sm font-medium text-white hover:bg-harbor-dark disabled:opacity-60"
            >
              {busy ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditCo(false)}
              className="rounded-lg border border-line px-5 py-2 text-sm font-medium hover:bg-mist"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {company.notes && !editCo && <p className="rounded-xl border border-line bg-white p-4 text-sm">{company.notes}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={panel}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Contacts ({company.contacts.length})</h2>
            {!showContact && (
              <button onClick={() => openContactForm()} className="text-sm font-medium text-harbor hover:underline">
                Add contact
              </button>
            )}
          </div>

          {showContact && (
            <form onSubmit={saveContact} className="mt-4 space-y-3 rounded-lg bg-mist/60 p-4">
              <Field label="Name" error={ke("name")}>
                <input required value={cForm.name} onChange={setC("name")} className={input} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Email" error={ke("email")}>
                  <input type="email" value={cForm.email} onChange={setC("email")} className={input} />
                </Field>
                <Field label="Phone" error={ke("phone")}>
                  <input value={cForm.phone} onChange={setC("phone")} className={input} />
                </Field>
              </div>
              <Field label="Job title" error={ke("title")}>
                <input value={cForm.title} onChange={setC("title")} className={input} />
              </Field>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-harbor px-4 py-2 text-sm font-medium text-white hover:bg-harbor-dark disabled:opacity-60"
                >
                  {busy ? "Saving..." : editingId ? "Save contact" : "Add contact"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowContact(false);
                    setEditingId(null);
                  }}
                  className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-mist"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {company.contacts.length === 0 && !showContact ? (
            <p className="mt-4 text-sm text-muted">No contacts yet. Add the people you talk to at this company.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {company.contacts.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    {c.title && <p className="text-muted">{c.title}</p>}
                    <p className="break-all text-muted">{[c.email, c.phone].filter(Boolean).join(", ")}</p>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    <button onClick={() => openContactForm(c)} className="font-medium text-harbor hover:underline">
                      Edit
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => deleteContact(c)}
                        disabled={busy}
                        className="font-medium text-red-700 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={panel}>
          <h2 className="text-base font-semibold">Leads ({company.leads.length})</h2>
          {company.leads.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No leads linked to this company yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {company.leads.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/leads/${l.id}`} className="font-medium hover:text-harbor hover:underline">
                      {l.name}
                    </Link>
                    <p className="text-muted">
                      {inr(l.value)}, owned by {l.owner.name}
                    </p>
                  </div>
                  <span
                    className={"shrink-0 rounded-full px-2.5 py-1 text-xs font-medium " + (BADGE[l.stage.kind] ?? BADGE.OPEN)}
                  >
                    {l.stage.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";

import type { NormalizedAdminDocket } from "@/lib/admin/types";

type Props = {
  initialDockets: NormalizedAdminDocket[];
};

type StatusFilter = "all" | "needs_attention" | "active" | "approved" | "paused" | "cleared" | "lost";

type PatchPayload = {
  status?: string | null;
  admin_notes?: string | null;
  is_flagged?: boolean | null;
  is_paused?: boolean | null;
  paused_until?: string | null;
  lost_reason?: string | null;
  estimated_deal_value?: number | null;
};

const STATUS_ORDER = [
  "new",
  "questions_sent",
  "answers_received",
  "research_in_progress",
  "report_sent",
  "decision_made",
  "paused",
  "cleared",
  "lost",
];

const LOST_REASONS = [
  "Price too high",
  "Customer went elsewhere",
  "Could not source vehicle",
  "Customer went silent",
  "Other",
];

const STATUS_BADGE_STYLES: Record<string, string> = {
  new: "bg-orange-400/20 text-orange-300 ring-1 ring-orange-400/40",
  questions_sent: "bg-blue-400/20 text-blue-300 ring-1 ring-blue-400/40",
  answers_received: "bg-orange-400/20 text-orange-300 ring-1 ring-orange-400/40",
  research_in_progress: "bg-blue-400/20 text-blue-300 ring-1 ring-blue-400/40",
  report_sent: "bg-blue-400/20 text-blue-300 ring-1 ring-blue-400/40",
  decision_made: "bg-green-400/20 text-green-300 ring-1 ring-green-400/40",
  cleared: "bg-zinc-400/20 text-zinc-300 ring-1 ring-zinc-400/40",
  lost: "bg-red-950/60 text-red-300 ring-1 ring-red-900",
  paused: "bg-zinc-500/20 text-zinc-300 ring-1 ring-zinc-500/40 italic",
};

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

function formatSimpleDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString();
}

function formatCurrencyCad(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getCustomerName(docket: NormalizedAdminDocket) {
  return `${docket.customer_first_name ?? ""} ${docket.customer_last_name ?? ""}`.trim() || "Unnamed Customer";
}

function getVehicleLabel(docket: NormalizedAdminDocket) {
  return [docket.vehicle_year, docket.vehicle_make, docket.vehicle_model].filter(Boolean).join(" ") || "N/A";
}

function isPaused(docket: NormalizedAdminDocket) {
  return docket.is_paused || docket.status === "paused";
}

function isNeedsAttention(docket: NormalizedAdminDocket) {
  if (isPaused(docket)) {
    return false;
  }

  return docket.is_flagged || docket.status === "new" || docket.status === "answers_received";
}

function isActive(docket: NormalizedAdminDocket) {
  return !isPaused(docket) && docket.status !== "cleared" && docket.status !== "lost";
}

function getDaysInStatus(docket: NormalizedAdminDocket) {
  const since = docket.docket_status_history[0]?.created_at ?? docket.created_at;
  const days = Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24));
  return Number.isFinite(days) && days >= 0 ? days : 0;
}

function getMarcusStatus(docket: NormalizedAdminDocket) {
  if (docket.status === "new" || docket.status === "answers_received") {
    return "Needs Marcus";
  }
  if (docket.status === "cleared" || docket.status === "lost") {
    return "Complete";
  }
  if (isPaused(docket)) {
    return "Paused";
  }
  return "In Progress";
}

export default function AdminDashboardClient({ initialDockets }: Props) {
  const [dockets, setDockets] = useState<NormalizedAdminDocket[]>(initialDockets);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const [selectedDocketId, setSelectedDocketId] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  const [statusDraft, setStatusDraft] = useState("new");
  const [lostReasonDraft, setLostReasonDraft] = useState("");
  const [estimatedDealValueDraft, setEstimatedDealValueDraft] = useState("");
  const [adminNotesDraft, setAdminNotesDraft] = useState("");
  const [pauseDraft, setPauseDraft] = useState(false);
  const [pausedUntilDraft, setPausedUntilDraft] = useState("");
  const [notesSavedState, setNotesSavedState] = useState<"idle" | "saving" | "saved">("idle");

  const selectedDocket = useMemo(
    () => dockets.find((docket) => docket.id === selectedDocketId) ?? null,
    [dockets, selectedDocketId]
  );

  useEffect(() => {
    if (!selectedDocket) {
      return;
    }

    setStatusDraft(selectedDocket.status ?? "new");
    setLostReasonDraft(selectedDocket.lost_reason ?? "");
    setEstimatedDealValueDraft(
      typeof selectedDocket.estimated_deal_value === "number" ? String(selectedDocket.estimated_deal_value) : ""
    );
    setAdminNotesDraft(selectedDocket.admin_notes ?? "");
    setPauseDraft(Boolean(selectedDocket.is_paused || selectedDocket.status === "paused"));
    setPausedUntilDraft(selectedDocket.paused_until ? selectedDocket.paused_until.slice(0, 10) : "");
    setNotesSavedState("idle");
  }, [selectedDocket]);

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedDocketId(null);
      }
    }

    if (selectedDocketId) {
      window.addEventListener("keydown", onEscape);
    }

    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [selectedDocketId]);

  async function refreshDockets() {
    setLoading(true);
    setError(null);

    const response = await fetch("/api/admin/dockets", { method: "GET" });
    const result = (await response.json()) as {
      success: boolean;
      error?: string;
      dockets?: NormalizedAdminDocket[];
    };

    if (!response.ok || !result.success || !result.dockets) {
      setError(result.error ?? "Failed to load dockets");
      setLoading(false);
      return;
    }

    setDockets(result.dockets);
    setLoading(false);
  }

  async function patchDocket(id: string, payload: PatchPayload) {
    const response = await fetch(`/api/admin/dockets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as { success: boolean; error?: string };

    if (!response.ok || !result.success) {
      throw new Error(result.error ?? "Failed to update docket");
    }

    await refreshDockets();
  }

  async function handleToggleFlag(id: string, currentValue: boolean | null) {
    try {
      await patchDocket(id, { is_flagged: !currentValue });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to toggle flag");
    }
  }

  async function handleSendReminder(id: string) {
    setSendingReminderId(id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/remind/${id}`, { method: "POST" });
      const result = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Failed to send reminder");
      }

      await refreshDockets();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send reminder");
    }

    setSendingReminderId(null);
  }

  async function saveStatus() {
    if (!selectedDocket) {
      return;
    }

    try {
      await patchDocket(selectedDocket.id, { status: statusDraft });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to save status");
    }
  }

  async function saveEstimatedDealValue() {
    if (!selectedDocket) {
      return;
    }

    const value = estimatedDealValueDraft.trim();
    const parsed = value.length === 0 ? null : Number(value);

    if (value.length > 0 && Number.isNaN(parsed)) {
      setError("Estimated deal value must be a number");
      return;
    }

    try {
      await patchDocket(selectedDocket.id, { estimated_deal_value: parsed });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to save estimated deal value");
    }
  }

  async function savePauseSettings() {
    if (!selectedDocket) {
      return;
    }

    try {
      await patchDocket(selectedDocket.id, {
        is_paused: pauseDraft,
        paused_until: pauseDraft && pausedUntilDraft ? `${pausedUntilDraft}T00:00:00.000Z` : null,
        status: pauseDraft ? "paused" : statusDraft === "paused" ? "new" : statusDraft,
      });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to save pause settings");
    }
  }

  async function saveLostReason() {
    if (!selectedDocket) {
      return;
    }

    try {
      await patchDocket(selectedDocket.id, { lost_reason: lostReasonDraft || null });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to save lost reason");
    }
  }

  async function saveAdminNotes() {
    if (!selectedDocket) {
      return;
    }

    if ((selectedDocket.admin_notes ?? "") === adminNotesDraft) {
      return;
    }

    setNotesSavedState("saving");

    try {
      await patchDocket(selectedDocket.id, { admin_notes: adminNotesDraft || null });
      setNotesSavedState("saved");
    } catch (updateError) {
      setNotesSavedState("idle");
      setError(updateError instanceof Error ? updateError.message : "Failed to save admin notes");
    }
  }

  const metrics = useMemo(() => {
    const active = dockets.filter(isActive).length;
    const needsAttention = dockets.filter(isNeedsAttention).length;
    const approvedPending = dockets.filter((docket) => docket.status === "decision_made").length;
    const totalPipelineValue = dockets.reduce(
      (sum, docket) => sum + (typeof docket.estimated_deal_value === "number" ? docket.estimated_deal_value : 0),
      0
    );

    return {
      active,
      needsAttention,
      approvedPending,
      totalPipelineValue,
    };
  }, [dockets]);

  const filteredDockets = useMemo(() => {
    const text = searchTerm.trim().toLowerCase();

    const filtered = dockets.filter((docket) => {
      const customerName = getCustomerName(docket).toLowerCase();
      const vehicle = getVehicleLabel(docket).toLowerCase();
      const textMatches = text.length === 0 || customerName.includes(text) || vehicle.includes(text);

      if (!textMatches) {
        return false;
      }

      if (flaggedOnly && !docket.is_flagged) {
        return false;
      }

      if (statusFilter === "all") {
        return true;
      }
      if (statusFilter === "needs_attention") {
        return isNeedsAttention(docket);
      }
      if (statusFilter === "active") {
        return isActive(docket);
      }
      if (statusFilter === "approved") {
        return docket.status === "decision_made";
      }
      if (statusFilter === "paused") {
        return isPaused(docket);
      }
      if (statusFilter === "cleared") {
        return docket.status === "cleared";
      }
      if (statusFilter === "lost") {
        return docket.status === "lost";
      }

      return true;
    });

    return filtered.sort((a, b) => {
      const aPaused = isPaused(a);
      const bPaused = isPaused(b);

      if (aPaused !== bPaused) {
        return aPaused ? 1 : -1;
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [dockets, flaggedOnly, searchTerm, statusFilter]);

  return (
    <main className="min-h-screen bg-[#0b0b0b] px-5 py-6 text-white sm:px-8">
      <div className="mx-auto w-full max-w-[1400px]">
        <header className="mb-6 border-b border-white/10 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#E55125]">JDM Rush</p>
          <h1 className="mt-2 text-3xl font-semibold">Admin Pipeline Dashboard</h1>
        </header>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-white/10 bg-[#161616] p-4">
            <p className="text-xs uppercase tracking-wider text-white/60">Total Active Dockets</p>
            <p className="mt-2 text-3xl font-semibold">{metrics.active}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-[#161616] p-4">
            <p className="text-xs uppercase tracking-wider text-white/60">Needs Attention</p>
            <p className="mt-2 text-3xl font-semibold text-orange-300">{metrics.needsAttention}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-[#161616] p-4">
            <p className="text-xs uppercase tracking-wider text-white/60">Approved - Pending Deposit</p>
            <p className="mt-2 text-3xl font-semibold text-green-300">{metrics.approvedPending}</p>
          </article>
          <article className="rounded-xl border border-white/10 bg-[#161616] p-4">
            <p className="text-xs uppercase tracking-wider text-white/60">Total Pipeline Value</p>
            <p className="mt-2 text-3xl font-semibold">{formatCurrencyCad(metrics.totalPipelineValue)}</p>
          </article>
        </section>

        <section className="mb-5 grid gap-3 rounded-xl border border-white/10 bg-[#141414] p-4 md:grid-cols-[1fr_220px_auto] md:items-center">
          <input
            className="h-10 rounded-md border border-white/15 bg-black/30 px-3 text-sm outline-none focus:border-[#E55125]"
            placeholder="Search by customer or vehicle"
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <select
            className="h-10 rounded-md border border-white/15 bg-black/30 px-3 text-sm outline-none focus:border-[#E55125]"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="all">All</option>
            <option value="needs_attention">Needs Attention</option>
            <option value="active">Active</option>
            <option value="approved">Approved</option>
            <option value="paused">Paused</option>
            <option value="cleared">Cleared</option>
            <option value="lost">Lost</option>
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-white/85">
            <input
              checked={flaggedOnly}
              onChange={(event) => setFlaggedOnly(event.target.checked)}
              type="checkbox"
            />
            Flagged only
          </label>
        </section>

        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}

        <section className="overflow-x-auto rounded-xl border border-white/10 bg-[#131313]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wider text-white/60">
              <tr>
                <th className="px-3 py-3">Flag</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Vehicle</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Days in status</th>
                <th className="px-3 py-3">Reminders sent</th>
                <th className="px-3 py-3">Est. deal value</th>
                <th className="px-3 py-3">Marcus status</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDockets.map((docket) => {
                const status = docket.status ?? "new";
                const badgeClass = STATUS_BADGE_STYLES[status] ?? "bg-zinc-700 text-zinc-100";
                const pausedRow = isPaused(docket);

                return (
                  <tr
                    key={docket.id}
                    className={`border-t border-white/5 align-top ${pausedRow ? "opacity-50" : "opacity-100"}`}
                  >
                    <td className="px-3 py-3">
                      <button
                        className="text-lg"
                        onClick={() => void handleToggleFlag(docket.id, docket.is_flagged)}
                        type="button"
                      >
                        {docket.is_flagged ? "🚩" : "⚐"}
                      </button>
                    </td>
                    <td className="px-3 py-3 font-medium">{getCustomerName(docket)}</td>
                    <td className="px-3 py-3 text-white/85">{getVehicleLabel(docket)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>{status}</span>
                    </td>
                    <td className="px-3 py-3 text-white/80">{getDaysInStatus(docket)}</td>
                    <td className="px-3 py-3 text-white/80">{docket.reminders_sent_total}</td>
                    <td className="px-3 py-3 text-white/85">{formatCurrencyCad(docket.estimated_deal_value)}</td>
                    <td className="px-3 py-3 text-white/80">{getMarcusStatus(docket)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border border-[#E55125]/70 px-2 py-1 text-xs text-[#E55125] hover:bg-[#E55125]/10"
                          disabled={sendingReminderId === docket.id}
                          onClick={() => void handleSendReminder(docket.id)}
                          type="button"
                        >
                          {sendingReminderId === docket.id ? "Sending..." : "Send Reminder"}
                        </button>
                        <button
                          className="rounded-md border border-white/20 px-2 py-1 text-xs text-white hover:bg-white/10"
                          onClick={() => setSelectedDocketId(docket.id)}
                          type="button"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredDockets.length === 0 ? (
            <div className="p-6 text-center text-sm text-white/60">No dockets match your filters.</div>
          ) : null}
        </section>

        {loading ? <p className="mt-3 text-sm text-white/60">Refreshing dockets...</p> : null}
      </div>

      {selectedDocket ? (
        <div className="fixed inset-0 z-30 bg-black/55" onClick={() => setSelectedDocketId(null)}>
          <aside
            className="absolute inset-y-0 right-0 w-full max-w-[480px] overflow-y-auto border-l border-white/10 bg-[#111111] p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-semibold">{getCustomerName(selectedDocket)}</h2>
                <p className="text-sm text-white/65">{getVehicleLabel(selectedDocket)}</p>
              </div>
              <button
                className="rounded-md border border-white/20 px-2 py-1 text-sm hover:bg-white/10"
                onClick={() => setSelectedDocketId(null)}
                type="button"
              >
                X
              </button>
            </div>

            <section className="space-y-2 border-b border-white/10 pb-4 text-sm">
              <p><span className="text-white/60">Email:</span> {selectedDocket.customer_email || "N/A"}</p>
              <p><span className="text-white/60">Phone:</span> {selectedDocket.customer_phone || "N/A"}</p>
              <p>
                <span className="text-white/60">Location:</span>{" "}
                {[selectedDocket.destination_city, selectedDocket.destination_province].filter(Boolean).join(", ") || "N/A"}
              </p>
              <p><span className="text-white/60">Vehicle:</span> {getVehicleLabel(selectedDocket)}</p>
            </section>

            <section className="mt-4 space-y-3 border-b border-white/10 pb-4">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="text-xs uppercase tracking-wider text-white/60">
                  Status override
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm"
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value)}
                  >
                    {STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="h-10 rounded-md border border-white/20 px-3 text-sm hover:bg-white/10"
                  onClick={() => void saveStatus()}
                  type="button"
                >
                  Save
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="text-xs uppercase tracking-wider text-white/60">
                  Estimated deal value (CAD)
                  <input
                    className="mt-1 h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm"
                    value={estimatedDealValueDraft}
                    onChange={(event) => setEstimatedDealValueDraft(event.target.value)}
                  />
                </label>
                <button
                  className="h-10 rounded-md border border-white/20 px-3 text-sm hover:bg-white/10"
                  onClick={() => void saveEstimatedDealValue()}
                  type="button"
                >
                  Save
                </button>
              </div>

              <label className="block text-xs uppercase tracking-wider text-white/60">
                Admin notes
                <textarea
                  className="mt-1 min-h-[110px] w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm"
                  onBlur={() => void saveAdminNotes()}
                  onChange={(event) => {
                    setAdminNotesDraft(event.target.value);
                    if (notesSavedState === "saved") {
                      setNotesSavedState("idle");
                    }
                  }}
                  value={adminNotesDraft}
                />
              </label>
              <p className="text-xs text-white/60">
                {notesSavedState === "saving" ? "Saving..." : notesSavedState === "saved" ? "Saved ✓" : ""}
              </p>

              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="inline-flex h-10 items-center gap-2 rounded-md border border-white/15 bg-black/30 px-3 text-sm">
                  <input
                    checked={pauseDraft}
                    onChange={(event) => setPauseDraft(event.target.checked)}
                    type="checkbox"
                  />
                  Pause docket
                </label>
                <label className="text-xs uppercase tracking-wider text-white/60">
                  Paused until
                  <input
                    className="mt-1 h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm"
                    disabled={!pauseDraft}
                    type="date"
                    value={pausedUntilDraft}
                    onChange={(event) => setPausedUntilDraft(event.target.value)}
                  />
                </label>
                <button
                  className="h-10 rounded-md border border-white/20 px-3 text-sm hover:bg-white/10"
                  onClick={() => void savePauseSettings()}
                  type="button"
                >
                  Save
                </button>
              </div>

              {statusDraft === "lost" ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="text-xs uppercase tracking-wider text-white/60">
                    Lost reason
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-black/30 px-3 text-sm"
                      onChange={(event) => setLostReasonDraft(event.target.value)}
                      value={lostReasonDraft}
                    >
                      <option value="">Select reason</option>
                      {LOST_REASONS.map((reason) => (
                        <option key={reason} value={reason}>{reason}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="h-10 rounded-md border border-white/20 px-3 text-sm hover:bg-white/10"
                    onClick={() => void saveLostReason()}
                    type="button"
                  >
                    Save
                  </button>
                </div>
              ) : null}
            </section>

            <section className="mt-4 border-b border-white/10 pb-4">
              <p className="text-sm text-white/70">
                Reminder count: {selectedDocket.email_log.filter((entry) => entry.email_type === "manual_reminder").length}
              </p>
              <button
                className="mt-2 rounded-md border border-[#E55125]/70 px-3 py-2 text-sm text-[#E55125] hover:bg-[#E55125]/10"
                disabled={sendingReminderId === selectedDocket.id}
                onClick={() => void handleSendReminder(selectedDocket.id)}
                type="button"
              >
                {sendingReminderId === selectedDocket.id ? "Sending..." : "Send Reminder"}
              </button>
            </section>

            <section className="mt-4 border-b border-white/10 pb-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/70">Status history</h3>
              <div className="space-y-2 text-sm">
                {selectedDocket.docket_status_history.length === 0 ? <p className="text-white/50">No status history.</p> : null}
                {selectedDocket.docket_status_history.map((entry) => (
                  <div className="rounded-md border border-white/10 bg-black/25 p-2" key={entry.id}>
                    <p className="text-white/85">
                      {(entry.old_status ?? "none")} → {(entry.new_status ?? "none")}
                    </p>
                    <p className="text-xs text-white/60">
                      {entry.changed_by ?? "system"} • {formatDate(entry.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/70">Email log</h3>
              <div className="space-y-2 text-sm">
                {selectedDocket.email_log.length === 0 ? <p className="text-white/50">No emails logged.</p> : null}
                {selectedDocket.email_log.map((entry) => (
                  <div className="rounded-md border border-white/10 bg-black/25 p-2" key={entry.id}>
                    <p className="text-white/85">{entry.subject || "(No subject)"}</p>
                    <p className="text-xs text-white/60">{entry.email_type || "unknown"} • {entry.recipient_email || "N/A"}</p>
                    <p className="text-xs text-white/60">{formatSimpleDate(entry.sent_at)}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </main>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getForwardStages,
  getStageLabel,
  getStageProgress,
  SHIPMENT_STAGES,
  type ShipmentStageHistoryItem,
} from "@/lib/shipments/stages";

type Shipment = {
  id: string;
  current_stage: string | null;
  stage_updated_at: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  bill_of_lading: string | null;
  container_number: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  estimated_departure_date: string | null;
  estimated_arrival_date: string | null;
  actual_departure_date: string | null;
  actual_arrival_date: string | null;
  marine_traffic_url: string | null;
  customer_visible_notes: string | null;
  internal_notes: string | null;
};

const TEXT_FIELDS: { key: keyof Shipment; label: string }[] = [
  { key: "vessel_name", label: "Vessel name" },
  { key: "voyage_number", label: "Voyage number" },
  { key: "bill_of_lading", label: "Bill of lading" },
  { key: "container_number", label: "Container number" },
  { key: "port_of_loading", label: "Port of loading" },
  { key: "port_of_discharge", label: "Port of discharge" },
  { key: "marine_traffic_url", label: "MarineTraffic URL" },
];

const DATE_FIELDS: { key: keyof Shipment; label: string }[] = [
  { key: "estimated_departure_date", label: "Estimated departure" },
  { key: "estimated_arrival_date", label: "Estimated arrival" },
  { key: "actual_departure_date", label: "Actual departure" },
  { key: "actual_arrival_date", label: "Actual arrival" },
];

const EDITABLE_KEYS: (keyof Shipment)[] = [
  ...TEXT_FIELDS.map((field) => field.key),
  ...DATE_FIELDS.map((field) => field.key),
  "customer_visible_notes",
  "internal_notes",
];

function toForm(shipment: Shipment): Record<string, string> {
  const form: Record<string, string> = {};
  for (const key of EDITABLE_KEYS) {
    const value = shipment[key];
    form[key as string] = typeof value === "string" ? value : "";
  }
  return form;
}

function formatDateTime(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) {
    return null;
  }
  return new Date(time).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

export function ShipmentPanel({ docketId }: { docketId: string }) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [history, setHistory] = useState<ShipmentStageHistoryItem[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const [toStage, setToStage] = useState("");
  const [advanceNote, setAdvanceNote] = useState("");
  const [advancing, setAdvancing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/agent/shipments?docketId=${encodeURIComponent(docketId)}`);
      const data = (await response.json()) as {
        success?: boolean;
        enabled?: boolean;
        shipment?: Shipment | null;
        history?: ShipmentStageHistoryItem[];
        error?: string;
      };
      if (!response.ok || !data.success) {
        setError(data.error ?? "Failed to load shipment.");
        return;
      }
      setEnabled(data.enabled !== false);
      setShipment(data.shipment ?? null);
      setHistory(Array.isArray(data.history) ? data.history : []);
      if (data.shipment) {
        setForm(toForm(data.shipment));
      }
      setError(null);
    } catch {
      setError("Failed to load shipment.");
    } finally {
      setLoading(false);
    }
  }, [docketId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!shipment) {
      return;
    }
    setSaving(true);
    setError(null);
    setSavedHint(null);
    try {
      const body: Record<string, string> = {};
      for (const key of EDITABLE_KEYS) {
        body[key as string] = form[key as string] ?? "";
      }
      const response = await fetch(`/api/agent/shipments/${shipment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { success?: boolean; shipment?: Shipment; error?: string };
      if (!response.ok || !data.success || !data.shipment) {
        throw new Error(data.error ?? "Save failed.");
      }
      setShipment(data.shipment);
      setForm(toForm(data.shipment));
      setSavedHint("Shipment details saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAdvance() {
    if (!shipment || !toStage) {
      return;
    }
    if (!window.confirm(`Advance this shipment to "${getStageLabel(toStage)}"? This cannot be undone.`)) {
      return;
    }
    setAdvancing(true);
    setError(null);
    try {
      const response = await fetch(`/api/agent/shipments/${shipment.id}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStage, note: advanceNote }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        shipment?: Shipment;
        historyRow?: ShipmentStageHistoryItem | null;
        error?: string;
      };
      if (!response.ok || !data.success || !data.shipment) {
        throw new Error(data.error ?? "Advance failed.");
      }
      setShipment(data.shipment);
      setForm(toForm(data.shipment));
      if (data.historyRow) {
        setHistory((prev) => [data.historyRow as ShipmentStageHistoryItem, ...prev]);
      }
      setToStage("");
      setAdvanceNote("");
    } catch (advanceError) {
      setError(advanceError instanceof Error ? advanceError.message : "Advance failed.");
    } finally {
      setAdvancing(false);
    }
  }

  const currentStage = shipment?.current_stage ?? null;
  const forwardStages = getForwardStages(currentStage);
  const progress = getStageProgress(currentStage);

  return (
    <section className="rounded-xl border border-white/12 bg-[#171717] p-5">
      <h2 className="text-xl font-semibold">Delivery Shipment</h2>
      <p className="mt-1 text-sm text-white/60">Track this vehicle&apos;s journey. Forward-only stage advancement is logged.</p>

      {loading ? <p className="mt-4 text-sm text-white/60">Loading shipment…</p> : null}

      {!loading && !enabled ? (
        <p className="mt-4 rounded-lg border border-dashed border-white/15 bg-black/20 p-4 text-sm text-white/55">
          Shipment tracking is not enabled yet. Once the shipments table is live this panel activates automatically.
        </p>
      ) : null}

      {!loading && enabled && !shipment ? (
        <p className="mt-4 rounded-lg border border-dashed border-white/15 bg-black/20 p-4 text-sm text-white/55">
          No shipment record for this docket yet.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {savedHint ? <p className="mt-3 text-sm text-[#7dd3fc]">{savedHint}</p> : null}

      {!loading && enabled && shipment ? (
        <div className="mt-4 space-y-6">
          {/* Current stage + progress */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#7dd3fc]">Current stage: {getStageLabel(currentStage)}</p>
              {shipment.stage_updated_at ? (
                <p className="text-xs text-white/45">Updated {formatDateTime(shipment.stage_updated_at)}</p>
              ) : null}
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#38bdf8]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>

          {/* Advance forward */}
          {forwardStages.length > 0 ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">Advance stage</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <select
                  className="rounded-lg border border-white/15 bg-[#111] px-3 py-2 text-sm text-white"
                  onChange={(event) => setToStage(event.target.value)}
                  value={toStage}
                >
                  <option value="">Select next stage…</option>
                  {forwardStages.map((stage) => (
                    <option key={stage.slug} value={stage.slug}>
                      {stage.label}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-lg border border-white/15 bg-[#111] px-3 py-2 text-sm text-white"
                  onChange={(event) => setAdvanceNote(event.target.value)}
                  placeholder="Customer-visible note (optional)"
                  type="text"
                  value={advanceNote}
                />
                <button
                  className="rounded-lg bg-[#E55125] px-4 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={advancing || !toStage}
                  onClick={handleAdvance}
                  type="button"
                >
                  {advancing ? "Advancing…" : "Advance →"}
                </button>
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 p-4 text-sm font-medium text-[#4ade80]">
              ✅ Delivered — this is the final stage.
            </p>
          )}

          {/* Editable shipment fields */}
          <div className="grid gap-3 sm:grid-cols-2">
            {TEXT_FIELDS.map((field) => (
              <label className="flex flex-col gap-1 text-xs text-white/60" key={field.key as string}>
                {field.label}
                <input
                  className="rounded-lg border border-white/15 bg-[#111] px-3 py-2 text-sm text-white"
                  onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  type="text"
                  value={form[field.key as string] ?? ""}
                />
              </label>
            ))}
            {DATE_FIELDS.map((field) => (
              <label className="flex flex-col gap-1 text-xs text-white/60" key={field.key as string}>
                {field.label}
                <input
                  className="rounded-lg border border-white/15 bg-[#111] px-3 py-2 text-sm text-white"
                  onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  type="date"
                  value={form[field.key as string] ?? ""}
                />
              </label>
            ))}
            <label className="flex flex-col gap-1 text-xs text-white/60 sm:col-span-2">
              Customer-visible notes (shown to the customer)
              <textarea
                className="min-h-[72px] rounded-lg border border-white/15 bg-[#111] px-3 py-2 text-sm text-white"
                onChange={(event) => setForm((prev) => ({ ...prev, customer_visible_notes: event.target.value }))}
                value={form.customer_visible_notes ?? ""}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-white/60 sm:col-span-2">
              Internal notes (never shown to the customer)
              <textarea
                className="min-h-[72px] rounded-lg border border-[#fbbf24]/30 bg-[#111] px-3 py-2 text-sm text-white"
                onChange={(event) => setForm((prev) => ({ ...prev, internal_notes: event.target.value }))}
                value={form.internal_notes ?? ""}
              />
            </label>
          </div>
          <button
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-60"
            disabled={saving}
            onClick={handleSave}
            type="button"
          >
            {saving ? "Saving…" : "Save shipment details"}
          </button>

          {/* Stage history */}
          {history.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-white">Stage history</p>
              <ul className="mt-2 space-y-2">
                {history.map((item) => (
                  <li className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-white/60" key={item.id}>
                    <span className="text-white/80">
                      {item.old_stage ? `${getStageLabel(item.old_stage)} → ` : ""}
                      {getStageLabel(item.new_stage)}
                    </span>
                    {" · "}
                    {formatDateTime(item.changed_at)}
                    {item.notes ? <span className="mt-1 block text-white/50">Note: {item.notes}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

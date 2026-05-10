"use client";

import { useEffect, useState } from "react";

const MAX_VEHICLE_REQUEST_LENGTH = 500;
const COUNTER_THRESHOLD = 400;

type Props = {
  docketId: string;
  value: string | null;
  onSaved: (value: string) => void;
};

export default function VehicleRequestEditor({ docketId, value, onSaved }: Props) {
  const displayValue = value?.trim() || "N/A";
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(displayValue === "N/A" ? "" : displayValue);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isOpen]);

  function openEditor() {
    setDraft(value?.trim() ?? "");
    setError(null);
    setIsOpen(true);
  }

  async function saveVehicleRequest() {
    const trimmed = draft.trim();

    if (!trimmed) {
      setError("Vehicle request cannot be empty.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/dockets/${docketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicle_description: trimmed }),
      });
      const result = (await response.json()) as { success?: boolean; error?: string; docket?: { vehicle_description?: string | null } };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Failed to update vehicle request.");
      }

      onSaved(result.docket?.vehicle_description?.trim() || trimmed);
      setIsOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update vehicle request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <p className="sm:col-span-2">
        <span className="inline-flex items-center gap-1.5 text-white">
          Customer&apos;s Vehicle Request:
          <button
            aria-label="Edit vehicle request"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-white/45 transition hover:bg-white/10 hover:text-[#E55125] focus:outline-none focus:ring-2 focus:ring-[#E55125]/60"
            onClick={openEditor}
            type="button"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        </span>{" "}
        {displayValue}
      </p>

      {isOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-[1px]"
          onClick={() => setIsOpen(false)}
          role="dialog"
        >
          <div
            className="w-full max-w-lg rounded-xl border border-white/12 bg-[#111111] shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-white">Edit Vehicle Request</h2>
            </div>
            <div className="px-5 py-4">
              <textarea
                className="min-h-[150px] w-full resize-y rounded-md border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#E55125]"
                maxLength={MAX_VEHICLE_REQUEST_LENGTH}
                onChange={(event) => {
                  setDraft(event.target.value);
                  if (error) {
                    setError(null);
                  }
                }}
                value={draft}
              />
              <div className="mt-2 flex items-start justify-between gap-3">
                <p className="text-xs text-white/45">Enter the customer&apos;s requested vehicle (make, model, year if known).</p>
                {draft.length >= COUNTER_THRESHOLD ? (
                  <p className="shrink-0 text-xs text-white/45">
                    {draft.length}/{MAX_VEHICLE_REQUEST_LENGTH}
                  </p>
                ) : null}
              </div>
              {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
              <button
                className="rounded-md border border-white/20 bg-transparent px-4 py-2 text-sm text-white/75 transition hover:border-white/35 hover:bg-white/5 hover:text-white"
                disabled={saving}
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-[#E55125] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving}
                onClick={() => void saveVehicleRequest()}
                type="button"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

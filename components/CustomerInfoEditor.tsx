"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import type { CustomerInfoUpdate, NormalizedAdminDocket } from "@/lib/admin/types";

const LOCKED_DESTINATION_STATUSES = new Set(["research_in_progress", "report_sent", "decision_made", "cleared"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DESTINATION_OPTIONS = [
  { label: "Victoria, BC", city: "Victoria", province: "BC" },
  { label: "Duncan, BC", city: "Duncan", province: "BC" },
  { label: "Vancouver/Richmond, BC", city: "Vancouver/Richmond", province: "BC" },
  { label: "Kamloops, BC", city: "Kamloops", province: "BC" },
  { label: "Kelowna/Okanagan, BC", city: "Kelowna/Okanagan", province: "BC" },
  { label: "Calgary, AB", city: "Calgary", province: "AB" },
  { label: "Edmonton, AB", city: "Edmonton", province: "AB" },
  { label: "Regina, SK", city: "Regina", province: "SK" },
  { label: "Saskatoon, SK", city: "Saskatoon", province: "SK" },
  { label: "Winnipeg, MB", city: "Winnipeg", province: "MB" },
  { label: "Toronto/Ottawa, ON", city: "Toronto/Ottawa", province: "ON" },
  { label: "Montreal, QC", city: "Montreal", province: "QC" },
  { label: "Halifax, NS", city: "Halifax", province: "NS" },
] as const;

const BUDGET_OPTIONS = ["0,000 - 0,000", "Over 0,000", "Over 0,000"] as const;

type EditableDocketFields = Pick<
  NormalizedAdminDocket,
  | "customer_first_name"
  | "customer_last_name"
  | "customer_email"
  | "customer_phone"
  | "vehicle_year"
  | "vehicle_make"
  | "vehicle_model"
  | "vehicle_description"
  | "destination_city"
  | "destination_province"
  | "budget_bracket"
  | "timeline"
  | "additional_notes"
>;

type Props = {
  docket: NormalizedAdminDocket;
  onSaved: (updatedFields: EditableDocketFields) => void;
};

type Draft = CustomerInfoUpdate;
type FieldErrors = Partial<Record<keyof Draft, string>>;

function fieldValue(value: string | null | undefined) {
  return value ?? "";
}

function buildDraft(docket: NormalizedAdminDocket): Draft {
  return {
    first_name: fieldValue(docket.customer_first_name),
    last_name: fieldValue(docket.customer_last_name),
    email: fieldValue(docket.customer_email),
    phone: fieldValue(docket.customer_phone),
    vehicle_year: fieldValue(docket.vehicle_year),
    vehicle_make: fieldValue(docket.vehicle_make),
    vehicle_model: fieldValue(docket.vehicle_model),
    vehicle_description: fieldValue(docket.vehicle_description),
    destination_city: fieldValue(docket.destination_city),
    destination_province: fieldValue(docket.destination_province),
    budget_bracket: fieldValue(docket.budget_bracket),
    timeline: fieldValue(docket.timeline),
    additional_notes: fieldValue(docket.additional_notes),
  };
}

function toNullable(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function responseToEditableFields(docket: EditableDocketFields): EditableDocketFields {
  return {
    customer_first_name: docket.customer_first_name,
    customer_last_name: docket.customer_last_name,
    customer_email: docket.customer_email,
    customer_phone: docket.customer_phone,
    vehicle_year: docket.vehicle_year,
    vehicle_make: docket.vehicle_make,
    vehicle_model: docket.vehicle_model,
    vehicle_description: docket.vehicle_description,
    destination_city: docket.destination_city,
    destination_province: docket.destination_province,
    budget_bracket: docket.budget_bracket,
    timeline: docket.timeline,
    additional_notes: docket.additional_notes,
  };
}

export default function CustomerInfoEditor({ docket, onSaved }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => buildDraft(docket));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [destinationLockedError, setDestinationLockedError] = useState(false);
  const [saving, setSaving] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const isDestinationLocked = LOCKED_DESTINATION_STATUSES.has(docket.status ?? "");
  const destinationOption = DESTINATION_OPTIONS.find((option) => option.city === draft.destination_city);
  const currentDestinationIsLegacy = Boolean(draft.destination_city) && !destinationOption;
  const currentBudgetIsLegacy = Boolean(draft.budget_bracket) && !BUDGET_OPTIONS.includes(draft.budget_bracket as (typeof BUDGET_OPTIONS)[number]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => firstInputRef.current?.focus(), 0);

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!saving) {
          setIsOpen(false);
          window.setTimeout(() => triggerRef.current?.focus(), 0);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isOpen, saving]);

  function openEditor() {
    setDraft(buildDraft(docket));
    setFieldErrors({});
    setError(null);
    setDestinationLockedError(false);
    setIsOpen(true);
  }

  function closeEditor() {
    if (saving) {
      return;
    }

    setIsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function updateDraft<K extends keyof Draft>(field: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
    if (error) {
      setError(null);
    }
    if (field === "destination_city" || field === "destination_province") {
      setDestinationLockedError(false);
    }
  }

  function validateDraft() {
    const nextErrors: FieldErrors = {};

    if (!draft.first_name.trim()) {
      nextErrors.first_name = "First name is required.";
    }
    if (!draft.last_name.trim()) {
      nextErrors.last_name = "Last name is required.";
    }
    if (!draft.email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(draft.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function buildPayload(): CustomerInfoUpdate {
    return {
      first_name: draft.first_name.trim(),
      last_name: draft.last_name.trim(),
      email: draft.email.trim(),
      phone: toNullable(draft.phone),
      vehicle_year: toNullable(draft.vehicle_year),
      vehicle_make: toNullable(draft.vehicle_make),
      vehicle_model: toNullable(draft.vehicle_model),
      vehicle_description: toNullable(draft.vehicle_description),
      destination_city: toNullable(draft.destination_city),
      destination_province: toNullable(draft.destination_province),
      budget_bracket: toNullable(draft.budget_bracket),
      timeline: toNullable(draft.timeline),
      additional_notes: toNullable(draft.additional_notes),
    };
  }

  async function saveCustomerInfo() {
    if (!validateDraft()) {
      setError("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    setError(null);
    setDestinationLockedError(false);

    try {
      const response = await fetch(`/api/admin/dockets/${docket.id}/customer-info`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        docket?: EditableDocketFields;
      };

      if (!response.ok || !result.success || !result.docket) {
        if (response.status === 422) {
          setDestinationLockedError(true);
          throw new Error("Destination cannot be changed after research has begun.");
        }

        throw new Error(result.error ?? "Failed to update customer info.");
      }

      onSaved(responseToEditableFields(result.docket));
      setIsOpen(false);
      window.setTimeout(() => triggerRef.current?.focus(), 0);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update customer info.");
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveCustomerInfo();
  }

  function handleBackdropClick() {
    closeEditor();
  }

  function trapFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !modalRef.current) {
      return;
    }

    const focusableElements = Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );

    if (focusableElements.length === 0) {
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  const commonInputClass =
    "mt-1 w-full rounded-md border border-white/15 bg-black/35 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#E55125] disabled:cursor-not-allowed disabled:opacity-50";
  const errorInputClass = "border-red-400/70 focus:border-red-400";

  return (
    <>
      <button
        className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/80 transition hover:border-[#E55125] hover:text-[#E55125] focus:outline-none focus:ring-2 focus:ring-[#E55125]/60"
        onClick={openEditor}
        ref={triggerRef}
        type="button"
      >
        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        Edit Customer Info
      </button>

      {isOpen ? (
        <div
          aria-labelledby="customer-info-editor-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-[1px]"
          onClick={handleBackdropClick}
          role="dialog"
        >
          <div
            className="max-h-[calc(100vh-3rem)] w-full max-w-[640px] overflow-hidden rounded-xl border border-white/10 bg-[#141414] shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={trapFocus}
            ref={modalRef}
          >
            <form className="flex max-h-[calc(100vh-3rem)] flex-col" onSubmit={handleSubmit}>
              <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-6">
                <h2 className="text-lg font-semibold text-white" id="customer-info-editor-title">
                  Edit Customer Info
                </h2>
                <button
                  aria-label="Close customer info editor"
                  className="rounded-md border border-white/15 px-2 py-1 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                  disabled={saving}
                  onClick={closeEditor}
                  type="button"
                >
                  X
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
                {error ? (
                  <div className="flex items-start justify-between gap-3 rounded-md border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                    <p>{error}</p>
                    <button
                      aria-label="Dismiss error"
                      className="shrink-0 text-red-100/70 transition hover:text-red-100"
                      onClick={() => setError(null)}
                      type="button"
                    >
                      X
                    </button>
                  </div>
                ) : null}

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Contact Information</h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm text-white/75" htmlFor="customer-first-name">
                      First Name <span className="text-[#E55125]">*</span>
                      <input
                        className={`${commonInputClass} ${fieldErrors.first_name ? errorInputClass : ""}`}
                        disabled={saving}
                        id="customer-first-name"
                        onChange={(event) => updateDraft("first_name", event.target.value)}
                        ref={firstInputRef}
                        value={draft.first_name}
                        aria-describedby={fieldErrors.first_name ? "customer-first-name-error" : undefined}
                      />
                      {fieldErrors.first_name ? (
                        <span className="mt-1 block text-xs text-red-400" id="customer-first-name-error">
                          {fieldErrors.first_name}
                        </span>
                      ) : null}
                    </label>

                    <label className="block text-sm text-white/75" htmlFor="customer-last-name">
                      Last Name <span className="text-[#E55125]">*</span>
                      <input
                        className={`${commonInputClass} ${fieldErrors.last_name ? errorInputClass : ""}`}
                        disabled={saving}
                        id="customer-last-name"
                        onChange={(event) => updateDraft("last_name", event.target.value)}
                        value={draft.last_name}
                        aria-describedby={fieldErrors.last_name ? "customer-last-name-error" : undefined}
                      />
                      {fieldErrors.last_name ? (
                        <span className="mt-1 block text-xs text-red-400" id="customer-last-name-error">
                          {fieldErrors.last_name}
                        </span>
                      ) : null}
                    </label>

                    <label className="block text-sm text-white/75" htmlFor="customer-email">
                      Email <span className="text-[#E55125]">*</span>
                      <input
                        className={`${commonInputClass} ${fieldErrors.email ? errorInputClass : ""}`}
                        disabled={saving}
                        id="customer-email"
                        onChange={(event) => updateDraft("email", event.target.value)}
                        type="email"
                        value={draft.email}
                        aria-describedby={fieldErrors.email ? "customer-email-error" : undefined}
                      />
                      {fieldErrors.email ? (
                        <span className="mt-1 block text-xs text-red-400" id="customer-email-error">
                          {fieldErrors.email}
                        </span>
                      ) : null}
                    </label>

                    <label className="block text-sm text-white/75" htmlFor="customer-phone">
                      Phone <span className="text-xs text-white/40">(optional)</span>
                      <input
                        className={commonInputClass}
                        disabled={saving}
                        id="customer-phone"
                        onChange={(event) => updateDraft("phone", event.target.value)}
                        value={draft.phone ?? ""}
                      />
                    </label>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Vehicle Request</h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    <label className="block text-sm text-white/75" htmlFor="vehicle-year">
                      Vehicle Year <span className="text-xs text-white/40">(optional)</span>
                      <input
                        className={commonInputClass}
                        disabled={saving}
                        id="vehicle-year"
                        onChange={(event) => updateDraft("vehicle_year", event.target.value)}
                        value={draft.vehicle_year ?? ""}
                      />
                    </label>
                    <label className="block text-sm text-white/75" htmlFor="vehicle-make">
                      Vehicle Make <span className="text-xs text-white/40">(optional)</span>
                      <input
                        className={commonInputClass}
                        disabled={saving}
                        id="vehicle-make"
                        onChange={(event) => updateDraft("vehicle_make", event.target.value)}
                        value={draft.vehicle_make ?? ""}
                      />
                    </label>
                    <label className="block text-sm text-white/75" htmlFor="vehicle-model">
                      Vehicle Model <span className="text-xs text-white/40">(optional)</span>
                      <input
                        className={commonInputClass}
                        disabled={saving}
                        id="vehicle-model"
                        onChange={(event) => updateDraft("vehicle_model", event.target.value)}
                        value={draft.vehicle_model ?? ""}
                      />
                    </label>
                  </div>
                  <label className="mt-4 block text-sm text-white/75" htmlFor="vehicle-description">
                    Vehicle Description <span className="text-xs text-white/40">(optional)</span>
                    <textarea
                      className={`${commonInputClass} min-h-[96px] resize-y`}
                      disabled={saving}
                      id="vehicle-description"
                      onChange={(event) => updateDraft("vehicle_description", event.target.value)}
                      value={draft.vehicle_description ?? ""}
                    />
                  </label>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Destination</h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm text-white/75" htmlFor="destination-city">
                      Destination City
                      <select
                        className={`${commonInputClass} ${destinationLockedError ? errorInputClass : ""}`}
                        disabled={saving || isDestinationLocked}
                        id="destination-city"
                        onChange={(event) => {
                          const selected = DESTINATION_OPTIONS.find((option) => option.city === event.target.value);
                          updateDraft("destination_city", event.target.value);
                          if (selected) {
                            updateDraft("destination_province", selected.province);
                          }
                        }}
                        value={draft.destination_city ?? ""}
                        aria-describedby={
                          destinationLockedError || isDestinationLocked || currentDestinationIsLegacy
                            ? "destination-city-message"
                            : undefined
                        }
                      >
                        <option value="">Not provided</option>
                        {currentDestinationIsLegacy ? (
                          <option value={draft.destination_city ?? ""}>{draft.destination_city}</option>
                        ) : null}
                        {DESTINATION_OPTIONS.map((option) => (
                          <option key={option.label} value={option.city}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {isDestinationLocked ? (
                        <span className="mt-1 block text-xs text-white/45" id="destination-city-message">
                          Destination cannot be changed after research has begun.
                        </span>
                      ) : currentDestinationIsLegacy ? (
                        <span className="mt-1 block text-xs text-white/45" id="destination-city-message">
                          Current: {draft.destination_city} (legacy)
                        </span>
                      ) : destinationLockedError ? (
                        <span className="mt-1 block text-xs text-red-400" id="destination-city-message">
                          Destination cannot be changed after research has begun.
                        </span>
                      ) : null}
                    </label>

                    <label className="block text-sm text-white/75" htmlFor="destination-province">
                      Destination Province <span className="text-xs text-white/40">(optional)</span>
                      <input
                        className={`${commonInputClass} ${destinationLockedError ? errorInputClass : ""}`}
                        disabled={saving || isDestinationLocked}
                        id="destination-province"
                        onChange={(event) => updateDraft("destination_province", event.target.value)}
                        value={draft.destination_province ?? ""}
                      />
                    </label>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Additional Details</h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm text-white/75" htmlFor="budget-bracket">
                      Budget Bracket <span className="text-xs text-white/40">(optional)</span>
                      <select
                        className={commonInputClass}
                        disabled={saving}
                        id="budget-bracket"
                        onChange={(event) => updateDraft("budget_bracket", event.target.value)}
                        value={draft.budget_bracket ?? ""}
                      >
                        <option value="">Not provided</option>
                        {currentBudgetIsLegacy ? <option value={draft.budget_bracket ?? ""}>{draft.budget_bracket}</option> : null}
                        {BUDGET_OPTIONS.map((option, index) => (
                          <option key={`${option}-${index}`} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      {currentBudgetIsLegacy ? (
                        <span className="mt-1 block text-xs text-white/45">Current: {draft.budget_bracket} (legacy)</span>
                      ) : null}
                    </label>

                    <label className="block text-sm text-white/75" htmlFor="timeline">
                      Timeline <span className="text-xs text-white/40">(optional)</span>
                      <input
                        className={commonInputClass}
                        disabled={saving}
                        id="timeline"
                        onChange={(event) => updateDraft("timeline", event.target.value)}
                        value={draft.timeline ?? ""}
                      />
                    </label>
                  </div>
                  <label className="mt-4 block text-sm text-white/75" htmlFor="additional-notes">
                    Additional Notes <span className="text-xs text-white/40">(optional)</span>
                    <textarea
                      className={`${commonInputClass} min-h-[120px] resize-y`}
                      disabled={saving}
                      id="additional-notes"
                      onChange={(event) => updateDraft("additional_notes", event.target.value)}
                      value={draft.additional_notes ?? ""}
                    />
                  </label>
                </section>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-4 sm:px-6">
                <button
                  className="min-h-11 rounded-md border border-white/20 bg-transparent px-4 py-2 text-sm text-white/75 transition hover:border-white/35 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                  onClick={closeEditor}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="min-h-11 rounded-md bg-[#E55125] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

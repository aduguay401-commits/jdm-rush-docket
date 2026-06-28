"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

const ACCEPTED_LICENSE_TYPES = "image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf";
const MAX_LICENSE_BYTES = 10 * 1024 * 1024;

type SubmitState = "idle" | "submitting" | "signed";

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function drawSignatureGuides(canvas: HTMLCanvasElement) {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.strokeStyle = "rgba(255,255,255,0.05)";
  context.lineWidth = 1;
  for (let x = 16; x < width; x += 16) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 16; y < height; y += 16) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.strokeStyle = "rgba(229,81,37,0.2)";
  context.beginPath();
  context.moveTo(16, height - 36);
  context.lineTo(width - 16, height - 36);
  context.stroke();
}

function Field({
  label,
  name,
  value,
  onChange,
  autoComplete,
  readOnly = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange?: (value: string) => void;
  autoComplete?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-white/35">{label}</span>
      <input
        name={name}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={readOnly}
        autoComplete={autoComplete}
        className="w-full border border-white/[0.08] bg-white/[0.04] px-3 py-3 text-[14px] text-white outline-none transition focus:border-[#E55125]/70 read-only:text-white/45"
      />
    </label>
  );
}

function ChecklistItem({ label, complete }: { label: string; complete: boolean }) {
  return (
    <li className="flex items-center gap-2 text-[12px] text-white/55">
      <span className={`flex h-4 w-4 items-center justify-center border text-[10px] ${complete ? "border-[#E55125] bg-[#E55125] text-white" : "border-white/[0.12] text-white/20"}`}>
        {complete ? "✓" : ""}
      </span>
      {label}
    </li>
  );
}

export function SignClient({ docketId, vehicle }: { docketId: string; vehicle: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const licensePreviewUrlRef = useRef<string | null>(null);
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [signedByName, setSignedByName] = useState("");
  const [signedDate] = useState(todayIsoDate);
  const [hasSignature, setHasSignature] = useState(false);
  const [license, setLicense] = useState<File | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawSignatureGuides(canvas);

    return () => {
      if (licensePreviewUrlRef.current) {
        URL.revokeObjectURL(licensePreviewUrlRef.current);
      }
    };
  }, []);

  const hasAddress = [street, city, province, postalCode].every((value) => value.trim().length > 0);
  const hasName = signedByName.trim().length > 1;
  const hasLicense = Boolean(license);
  const canSubmit = hasAddress && hasSignature && hasName && hasLicense && submitState === "idle";

  const licenseLabel = useMemo(() => {
    if (!license) return "Drop license file or tap to upload";
    return `${license.name} (${Math.ceil(license.size / 1024)} KB)`;
  }, [license]);

  function getPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    if (!context) return;
    const point = getPoint(event);
    drawingRef.current = true;
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(point.x, point.y);
    canvas.setPointerCapture(event.pointerId);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const point = getPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasSignature(true);
  }

  function endDrawing(event: PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawSignatureGuides(canvas);
    setHasSignature(false);
  }

  function selectLicense(file: File | null) {
    setLicenseError(null);

    if (licensePreviewUrlRef.current) {
      URL.revokeObjectURL(licensePreviewUrlRef.current);
      licensePreviewUrlRef.current = null;
      setLicensePreview(null);
    }

    if (!file) {
      setLicense(null);
      return;
    }

    if (!ACCEPTED_LICENSE_TYPES.split(",").includes(file.type)) {
      setLicense(null);
      setLicenseError("Use JPG, PNG, HEIC, WEBP, or PDF.");
      return;
    }

    if (file.size > MAX_LICENSE_BYTES) {
      setLicense(null);
      setLicenseError("File must be 10 MB or smaller.");
      return;
    }

    setLicense(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      licensePreviewUrlRef.current = url;
      setLicensePreview(url);
    }
  }

  async function submit() {
    if (!canSubmit || !canvasRef.current || !license) return;

    setSubmitState("submitting");
    setSubmitError(null);

    const formData = new FormData();
    formData.set("street", street.trim());
    formData.set("city", city.trim());
    formData.set("province", province.trim());
    formData.set("postalCode", postalCode.trim());
    formData.set("signedByName", signedByName.trim());
    formData.set("signedDate", signedDate);
    formData.set("signatureDataUrl", canvasRef.current.toDataURL("image/png"));
    formData.set("license", license);

    const response = await fetch(`/api/customer/docket/${encodeURIComponent(docketId)}/sign`, {
      method: "POST",
      body: formData,
    });
    const result = (await response.json()) as { success?: boolean; error?: string };

    if (!response.ok || !result.success) {
      setSubmitState("idle");
      setSubmitError(result.error ?? "Unable to sign agreement. Please try again.");
      return;
    }

    setSubmitState("signed");
  }

  if (submitState === "signed") {
    return (
      <section className="bg-black border border-emerald-400/20 p-6 sm:p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center border border-emerald-400/40 bg-emerald-400/10 text-2xl text-emerald-300">
          ✓
        </div>
        <h2 className="text-white text-[24px] font-extrabold tracking-tight">Agreement Signed</h2>
        <p className="mt-3 text-white/55 text-[13px] leading-relaxed">
          Your signed agreement for {vehicle} has been stored securely. A copy was emailed to you.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="bg-black border border-white/[0.08] p-5 sm:p-6">
        <p className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.12em] mb-4">Address</p>
        <div className="grid gap-4">
          <Field label="Street" name="street" value={street} onChange={setStreet} autoComplete="street-address" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" name="city" value={city} onChange={setCity} autoComplete="address-level2" />
            <Field label="Province" name="province" value={province} onChange={setProvince} autoComplete="address-level1" />
          </div>
          <Field label="Postal code" name="postalCode" value={postalCode} onChange={setPostalCode} autoComplete="postal-code" />
        </div>
      </section>

      <section className="bg-black border border-white/[0.08] p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <p className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.12em]">Signature</p>
          <button type="button" onClick={clearSignature} className="border border-white/[0.12] px-3 py-1.5 text-[11px] font-bold uppercase text-white/55 hover:text-white">
            Clear
          </button>
        </div>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Draw your signature"
          className="h-[140px] w-full touch-none border border-white/[0.08] bg-white/[0.03]"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={endDrawing}
          onPointerCancel={endDrawing}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Typed legal name" name="signedByName" value={signedByName} onChange={setSignedByName} autoComplete="name" />
          <Field label="Date" name="signedDate" value={signedDate} readOnly />
        </div>
      </section>

      <section className="bg-black border border-white/[0.08] p-5 sm:p-6">
        <p className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.12em] mb-4">Driver License</p>
        <label className="flex cursor-pointer items-center gap-4 border border-dashed border-white/[0.14] bg-white/[0.03] p-4 transition hover:border-[#E55125]/60">
          <input
            type="file"
            className="sr-only"
            accept={ACCEPTED_LICENSE_TYPES}
            capture="environment"
            onChange={(event) => selectLicense(event.target.files?.[0] ?? null)}
          />
          <span className="flex h-[52px] w-[36px] shrink-0 items-center justify-center border border-white/[0.12] bg-black text-[10px] font-bold uppercase text-white/35 overflow-hidden">
            {licensePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={licensePreview} alt="License preview" className="h-full w-full object-cover" />
            ) : license?.type === "application/pdf" ? "PDF" : "ID"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-white/75">{licenseLabel}</span>
            <span className="mt-1 block text-[11px] leading-relaxed text-white/35">Stored privately. Secure access uses short-lived links only.</span>
          </span>
        </label>
        {licenseError && <p className="mt-3 text-[12px] text-red-300">{licenseError}</p>}
      </section>

      <section className="bg-black border border-white/[0.08] p-5 sm:p-6">
        <ul className="grid gap-2 sm:grid-cols-2">
          <ChecklistItem label="Address complete" complete={hasAddress} />
          <ChecklistItem label="Signature drawn" complete={hasSignature} />
          <ChecklistItem label="Legal name entered" complete={hasName} />
          <ChecklistItem label="License uploaded" complete={hasLicense} />
        </ul>
        {submitError && <p className="mt-4 text-[12px] text-red-300">{submitError}</p>}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="mt-5 w-full border border-[#E55125] bg-[#E55125] px-5 py-3 text-[13px] font-bold uppercase text-white transition hover:brightness-110 disabled:border-white/[0.08] disabled:bg-white/[0.04] disabled:text-white/20 disabled:hover:brightness-100"
        >
          {submitState === "submitting" ? "Submitting..." : "Sign and Submit"}
        </button>
      </section>
    </div>
  );
}

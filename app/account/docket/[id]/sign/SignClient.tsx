"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent,
  type UIEvent,
} from "react";

const ACCEPTED_LICENSE_TYPES = "image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf";
const ACCEPTED_LICENSE_LABEL = "JPG, PNG, HEIC, WEBP, or PDF";
const MAX_LICENSE_BYTES = 10 * 1024 * 1024;

type SubmitState = "idle" | "submitting" | "signed";
type WizardStep = 1 | 2 | 3 | 4;
type AgreementType = "auction" | "dealer";

type SignClientProps = {
  docketId: string;
  vehicle: string;
  customerName: string;
  agreementText: string;
  agreementLabel: string;
  agreementType: AgreementType;
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatAddress(street: string, city: string, province: string, postalCode: string) {
  return [street.trim(), [city.trim(), province.trim()].filter(Boolean).join(", "), postalCode.trim()]
    .filter(Boolean)
    .join(" ");
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

function restoreSignature(canvas: HTMLCanvasElement, dataUrl: string | null) {
  drawSignatureGuides(canvas);
  if (!dataUrl) return;

  const context = canvas.getContext("2d");
  if (!context) return;
  const image = new Image();
  image.onload = () => {
    context.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight);
  };
  image.src = dataUrl;
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

function StepProgress({ step }: { step: WizardStep }) {
  const steps: { id: WizardStep; label: string }[] = [
    { id: 1, label: "Review" },
    { id: 2, label: "Sign" },
    { id: 3, label: "License" },
    { id: 4, label: "Submit" },
  ];

  return (
    <section className="bg-black border border-white/[0.08] px-4 py-4">
      <div className="flex items-center gap-2 sm:gap-3">
        {steps.map((item, index) => (
          <div key={item.id} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center border text-[11px] font-bold ${
                  item.id <= step
                    ? "border-[#E55125] bg-[#E55125] text-white"
                    : "border-white/[0.12] bg-white/[0.03] text-white/35"
                }`}
              >
                {item.id}
              </span>
              <span className={`truncate text-[10px] font-bold uppercase sm:text-[11px] ${item.id === step ? "text-white" : "text-white/35"}`}>
                {item.label}
              </span>
            </div>
            {index < steps.length - 1 && <div className={`h-px flex-1 ${item.id < step ? "bg-[#E55125]/70" : "bg-white/[0.08]"}`} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function Sidebar({ step, vehicle, customerName, agreementLabel }: { step: WizardStep; vehicle: string; customerName: string; agreementLabel: string }) {
  return (
    <aside className="bg-black border border-white/[0.08] p-5 lg:sticky lg:top-24">
      <p className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.12em] mb-3">Signing Progress</p>
      <h2 className="text-white text-[18px] font-extrabold leading-tight">{vehicle}</h2>
      <dl className="mt-5 space-y-3 text-[12px]">
        <div className="flex justify-between gap-4 border-b border-white/[0.06] pb-3">
          <dt className="text-white/35">Step</dt>
          <dd className="text-white/75 font-semibold">{step} of 4</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-white/[0.06] pb-3">
          <dt className="text-white/35">Agreement</dt>
          <dd className="text-white/75 font-semibold">{agreementLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-white/35">Customer</dt>
          <dd className="text-white/75 font-semibold text-right">{customerName}</dd>
        </div>
      </dl>
      <p className="mt-5 border-t border-white/[0.06] pt-4 text-[11px] leading-relaxed text-white/35">
        You can go back before submitting. Your entered details stay in this wizard.
      </p>
    </aside>
  );
}

function PrimaryButton({ children, disabled, onClick }: { children: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full border border-[#E55125] bg-[#E55125] px-5 py-3 text-[13px] font-bold uppercase text-white transition hover:brightness-110 disabled:border-white/[0.08] disabled:bg-white/[0.04] disabled:text-white/20 disabled:hover:brightness-100"
    >
      {children}
    </button>
  );
}

function BackButton({ disabled, onClick }: { disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full border border-white/[0.12] px-5 py-3 text-[13px] font-bold uppercase text-white/55 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      Back
    </button>
  );
}

export function SignClient({ docketId, vehicle, customerName, agreementText, agreementLabel, agreementType }: SignClientProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const agreementScrollRef = useRef<HTMLDivElement | null>(null);
  const licensePreviewUrlRef = useRef<string | null>(null);
  const [step, setStep] = useState<WizardStep>(1);
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const [hasReadAgreement, setHasReadAgreement] = useState(false);
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [signedByName, setSignedByName] = useState("");
  const [signedDate] = useState(todayIsoDate);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [license, setLicense] = useState<File | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (licensePreviewUrlRef.current) {
        URL.revokeObjectURL(licensePreviewUrlRef.current);
        licensePreviewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && step === 2) restoreSignature(canvas, signatureDataUrl);
  }, [step, signatureDataUrl]);

  useEffect(() => {
    if (step !== 1 || hasReadToBottom) return;

    const frame = window.requestAnimationFrame(() => {
      const scrollRegion = agreementScrollRef.current;
      if (scrollRegion && scrollRegion.scrollHeight <= scrollRegion.clientHeight + 1) {
        setHasReadToBottom(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [agreementText, hasReadToBottom, step]);

  const hasAddress = [street, city, province, postalCode].every((value) => value.trim().length > 0);
  const hasName = signedByName.trim().length > 1;
  const hasLicense = Boolean(license);
  const canProceedFromReview = hasReadToBottom && hasReadAgreement;
  const canProceedFromSign = hasAddress && hasSignature && hasName;
  const canProceedFromLicense = hasLicense && !licenseError;
  const canSubmit = canProceedFromReview && canProceedFromSign && canProceedFromLicense && submitState === "idle";
  const addressSummary = formatAddress(street, city, province, postalCode);

  const licenseLabel = useMemo(() => {
    if (!license) return "Drop license file or tap to upload";
    return `${license.name} (${Math.ceil(license.size / 1024)} KB)`;
  }, [license]);

  function goBack() {
    setSubmitError(null);
    setStep((current) => (current > 1 ? ((current - 1) as WizardStep) : current));
  }

  function onAgreementScroll(event: UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - 12) {
      setHasReadToBottom(true);
    }
  }

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
    setSignatureDataUrl(event.currentTarget.toDataURL("image/png"));
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawSignatureGuides(canvas);
    setHasSignature(false);
    setSignatureDataUrl(null);
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
      setLicenseError(`Use ${ACCEPTED_LICENSE_LABEL}.`);
      return;
    }

    if (file.size <= 0) {
      setLicense(null);
      setLicenseError("File is empty.");
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

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    selectLicense(event.dataTransfer.files?.[0] ?? null);
  }

  async function submit() {
    if (!canSubmit || !signatureDataUrl || !license) return;

    setSubmitState("submitting");
    setSubmitError(null);

    const formData = new FormData();
    formData.set("street", street.trim());
    formData.set("city", city.trim());
    formData.set("province", province.trim());
    formData.set("postalCode", postalCode.trim());
    formData.set("customer_address", addressSummary);
    formData.set("signedByName", signedByName.trim());
    formData.set("signedDate", signedDate);
    formData.set("signatureDataUrl", signatureDataUrl);
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
      <StepProgress step={step} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-4">
          {step === 1 && (
            <section className="bg-black border border-white/[0.08] p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.12em] mb-2">Step 1 · Review Agreement</p>
                  <h2 className="text-white text-[24px] sm:text-[30px] font-extrabold tracking-tight leading-tight">Read the purchase agreement</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="border border-[#E55125]/35 bg-[#E55125] px-3 py-1 text-[11px] font-bold uppercase text-white">{vehicle}</span>
                  <span className="border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase text-white/70">{agreementLabel}</span>
                </div>
              </div>

              {agreementType === "auction" && (
                <div className="mb-4 border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-[12px] leading-relaxed text-amber-200/80">
                  Auction agreement selected. This version includes the auction bidding and availability clause.
                </div>
              )}

              <div className="relative border border-white/[0.08] bg-white/[0.02]">
                <div className="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-[#E55125]/25" />
                <div className="pointer-events-none absolute inset-x-5 top-0 h-8 bg-gradient-to-b from-black to-transparent" />
                <div className="pointer-events-none absolute inset-x-5 bottom-0 h-8 bg-gradient-to-t from-black to-transparent" />
                <div
                  ref={agreementScrollRef}
                  onScroll={onAgreementScroll}
                  tabIndex={0}
                  aria-label="Scrollable purchase agreement text"
                  className="max-h-[360px] overflow-y-auto p-5 pr-3 text-[12px] leading-relaxed text-white/70 outline-none focus:border focus:border-[#E55125]/60 sm:max-h-[520px]"
                >
                  {agreementText.split(/\n{2,}/).map((block, index) => (
                    <p key={index} className="mb-3 whitespace-pre-line">
                      {block}
                    </p>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 border border-white/[0.08] bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className={`text-[12px] font-semibold ${hasReadToBottom ? "text-emerald-300" : "text-white/45"}`}>
                  {hasReadToBottom ? "Agreement reviewed to the end" : "Scroll to the end to continue"}
                </p>
                <label className="flex items-start gap-3 text-[12px] leading-relaxed text-white/65">
                  <input
                    type="checkbox"
                    checked={hasReadAgreement}
                    onChange={(event) => setHasReadAgreement(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#E55125]"
                  />
                  <span>I have read and understand this agreement.</span>
                </label>
              </div>

              <div className="mt-5">
                <PrimaryButton disabled={!canProceedFromReview} onClick={() => setStep(2)}>
                  Proceed to Signature
                </PrimaryButton>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="bg-black border border-white/[0.08] p-5 sm:p-6">
              <p className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.12em] mb-2">Step 2 · Sign</p>
              <h2 className="text-white text-[24px] font-extrabold tracking-tight mb-5">Your details and signature</h2>

              <div className="grid gap-4">
                <Field label="Street" name="street" value={street} onChange={setStreet} autoComplete="street-address" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="City" name="city" value={city} onChange={setCity} autoComplete="address-level2" />
                  <Field label="Province" name="province" value={province} onChange={setProvince} autoComplete="address-level1" />
                </div>
                <Field label="Postal code" name="postalCode" value={postalCode} onChange={setPostalCode} autoComplete="postal-code" />
              </div>

              <div className="mt-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <p className="text-white/45 text-[11px] font-bold uppercase tracking-[0.1em]">Draw signature</p>
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
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Typed legal name" name="signedByName" value={signedByName} onChange={setSignedByName} autoComplete="name" />
                <Field label="Date" name="signedDate" value={signedDate} readOnly />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <BackButton onClick={goBack} />
                <PrimaryButton disabled={!canProceedFromSign} onClick={() => setStep(3)}>
                  Continue to License
                </PrimaryButton>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="bg-black border border-white/[0.08] p-5 sm:p-6">
              <p className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.12em] mb-2">Step 3 · Driver License</p>
              <h2 className="text-white text-[24px] font-extrabold tracking-tight mb-5">Upload your license</h2>

              <label
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="flex cursor-pointer items-center gap-4 border border-dashed border-white/[0.14] bg-white/[0.03] p-4 transition hover:border-[#E55125]/60"
              >
                <input
                  type="file"
                  className="sr-only"
                  accept={ACCEPTED_LICENSE_TYPES}
                  onChange={(event) => selectLicense(event.target.files?.[0] ?? null)}
                />
                <span className="flex h-[52px] w-[36px] shrink-0 items-center justify-center overflow-hidden border border-white/[0.12] bg-black text-[10px] font-bold uppercase text-white/35">
                  {licensePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={licensePreview} alt="License preview" className="h-full w-full object-cover" />
                  ) : license?.type === "application/pdf" ? "PDF" : "ID"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-white/75">{licenseLabel}</span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-white/35">Accepted: {ACCEPTED_LICENSE_LABEL}. Max 10 MB. Stored privately with short-lived secure access.</span>
                </span>
              </label>
              {licenseError && <p className="mt-3 text-[12px] text-red-300">{licenseError}</p>}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <BackButton onClick={goBack} />
                <PrimaryButton disabled={!canProceedFromLicense} onClick={() => setStep(4)}>
                  Continue to Review
                </PrimaryButton>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="bg-black border border-white/[0.08] p-5 sm:p-6">
              <p className="text-[#E55125] text-[10px] font-bold uppercase tracking-[0.12em] mb-2">Step 4 · Review and Submit</p>
              <h2 className="text-white text-[24px] font-extrabold tracking-tight mb-5">Confirm your signed agreement</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-white/35 text-[10px] font-bold uppercase tracking-[0.1em] mb-2">Customer</p>
                  <p className="text-white text-[14px] font-semibold">{customerName}</p>
                </div>
                <div className="border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-white/35 text-[10px] font-bold uppercase tracking-[0.1em] mb-2">Vehicle</p>
                  <p className="text-white text-[14px] font-semibold">{vehicle}</p>
                </div>
                <div className="border border-white/[0.08] bg-white/[0.03] p-4 sm:col-span-2">
                  <p className="text-white/35 text-[10px] font-bold uppercase tracking-[0.1em] mb-2">Address</p>
                  <p className="text-white text-[14px] font-semibold">{addressSummary}</p>
                </div>
                <div className="border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-white/35 text-[10px] font-bold uppercase tracking-[0.1em] mb-2">Agreement</p>
                  <p className="text-white text-[14px] font-semibold">{agreementLabel}</p>
                </div>
                <div className="border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-white/35 text-[10px] font-bold uppercase tracking-[0.1em] mb-2">Legal name</p>
                  <p className="text-white text-[14px] font-semibold">{signedByName}</p>
                </div>
                <div className="border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-white/35 text-[10px] font-bold uppercase tracking-[0.1em] mb-2">Signature</p>
                  {signatureDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={signatureDataUrl} alt="Signature preview" className="h-16 w-full border border-white/[0.08] bg-black object-contain" />
                  ) : (
                    <p className="text-white/35 text-[12px]">Missing</p>
                  )}
                </div>
                <div className="border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-white/35 text-[10px] font-bold uppercase tracking-[0.1em] mb-2">License</p>
                  <div className="flex items-center gap-3">
                    <span className="flex h-[52px] w-[36px] shrink-0 items-center justify-center overflow-hidden border border-white/[0.12] bg-black text-[10px] font-bold uppercase text-white/35">
                      {licensePreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={licensePreview} alt="License preview" className="h-full w-full object-cover" />
                      ) : license?.type === "application/pdf" ? "PDF" : "ID"}
                    </span>
                    <p className="min-w-0 truncate text-white text-[13px] font-semibold">{license?.name}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 border border-[#E55125]/20 bg-[#E55125]/10 p-4 text-[12px] leading-relaxed text-white/70">
                Your signed agreement will be saved to Documents in your My JDM Garage and emailed to you.
              </div>

              {submitError && <p className="mt-4 text-[12px] text-red-300">{submitError}</p>}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <BackButton disabled={submitState === "submitting"} onClick={goBack} />
                <PrimaryButton disabled={!canSubmit} onClick={submit}>
                  {submitState === "submitting" ? "Submitting..." : "Submit Agreement"}
                </PrimaryButton>
              </div>
            </section>
          )}
        </div>

        <Sidebar step={step} vehicle={vehicle} customerName={customerName} agreementLabel={agreementLabel} />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { AccountHeader } from "@/app/account/_components/header";

// ── Mock vault data ───────────────────────────────────────────────────────────
// Concept state: car reserved, purchase agreement signed, deposit paid,
// vehicle en route — Bill of Lading + certs will arrive later.

type DocStatus = "paid" | "signed" | "pending_payment" | "pending_signature" | "pending";

type VaultDoc = {
  name: string;
  status: DocStatus;
  date?: string;
};

type VaultCategory = {
  id: string;
  label: string;
  sublabel: string;
  docs: VaultDoc[];
};

const VAULT_CATEGORIES: VaultCategory[] = [
  {
    id: "invoices",
    label: "JDM Rush Invoices",
    sublabel: "Deposit and final payment records",
    docs: [
      { name: "Deposit Invoice — $4,000 CAD", status: "paid", date: "Jun 2, 2026" },
      { name: "Final Invoice", status: "pending_payment" },
    ],
  },
  {
    id: "import",
    label: "Import Documents",
    sublabel: "Shipping and customs paperwork — arrives as your car progresses",
    docs: [
      { name: "Bill of Lading", status: "pending" },
      { name: "Bill of Sale", status: "pending" },
      { name: "Export Certificate (English)", status: "pending" },
      { name: "Export Certificate (Japanese)", status: "pending" },
    ],
  },
  {
    id: "legal",
    label: "Legal Agreements",
    sublabel: "Signed agreements and contracts",
    docs: [
      { name: "Purchase Agreement", status: "signed", date: "Jun 3, 2026" },
    ],
  },
];

// ── Status chip ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DocStatus, { label: string; className: string }> = {
  paid:             { label: "Paid ✓",             className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" },
  signed:           { label: "Signed ✓",           className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" },
  pending_payment:  { label: "Pending payment",     className: "bg-amber-400/10 text-amber-400/80 border border-amber-400/20" },
  pending_signature:{ label: "Awaiting signature",  className: "bg-amber-400/10 text-amber-400/80 border border-amber-400/20" },
  pending:          { label: "Not yet available",   className: "bg-white/5 text-white/30 border border-white/[0.08]" },
};

function StatusChip({ status }: { status: DocStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ── Document row ──────────────────────────────────────────────────────────────

function DocRow({ doc }: { doc: VaultDoc }) {
  const canDownload = doc.status === "paid" || doc.status === "signed";

  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-white/[0.05] last:border-0">
      {/* File icon */}
      <div className="shrink-0 w-8 h-8 bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>

      {/* Name + date */}
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-medium leading-snug truncate ${canDownload ? "text-white" : "text-white/40"}`}>
          {doc.name}
        </p>
        {doc.date && (
          <p className="text-white/25 text-[11px] mt-0.5">{doc.date}</p>
        )}
      </div>

      {/* Status */}
      <StatusChip status={doc.status} />

      {/* Download */}
      <button
        type="button"
        disabled={!canDownload}
        className={[
          "shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border transition-colors",
          canDownload
            ? "border-white/[0.12] text-white/60 hover:text-white hover:border-white/25"
            : "border-white/[0.04] text-white/15 cursor-not-allowed",
        ].join(" ")}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download
      </button>
    </div>
  );
}

// ── Category section ──────────────────────────────────────────────────────────

function VaultCategory({ category }: { category: VaultCategory }) {
  const availableCount = category.docs.filter(
    (d) => d.status === "paid" || d.status === "signed"
  ).length;

  return (
    <section className="bg-black border border-white/[0.08]">
      {/* Category header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-start justify-between gap-3">
        <div>
          <h2 className="text-white text-[14px] font-bold tracking-tight mb-0.5">
            {category.label}
          </h2>
          <p className="text-white/35 text-[11px]">{category.sublabel}</p>
        </div>
        <span className="shrink-0 text-white/25 text-[11px] font-medium mt-0.5">
          {availableCount}/{category.docs.length} available
        </span>
      </div>

      {/* Doc rows */}
      <div className="px-5">
        {category.docs.map((doc, i) => (
          <DocRow key={i} doc={doc} />
        ))}
      </div>
    </section>
  );
}

// ── SectionEyebrow ────────────────────────────────────────────────────────────

function SectionEyebrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center mb-5">
      <p className="text-[#E55125]/70 text-[12px] font-bold uppercase mb-2" style={{ letterSpacing: "0.12em" }}>
        {label}
      </p>
      <div className="w-8 h-[2px] bg-[#E55125]" />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  return (
    <div className="min-h-screen bg-[#111111]">
      <AccountHeader />

      <main id="main-content">
        {/* Page title */}
        <section className="bg-black border-b border-white/[0.08] py-10 sm:py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1200px] mx-auto">
            <Link
              href="/account"
              className="inline-flex items-center gap-1.5 text-white/35 hover:text-white text-[12px] font-medium transition-colors mb-6"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              My Garage
            </Link>
            <SectionEyebrow label="My Garage · Section 02" />
            <h1 className="text-center text-white text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight mb-2">
              Purchase &amp; Documents
            </h1>
            <p className="text-center text-white/40 text-[14px] max-w-sm mx-auto leading-relaxed">
              Your agreements, invoices, and import documents — all in one place.
              Everything here is persistent and downloadable any time.
            </p>
          </div>
        </section>

        {/* Vault */}
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <p className="text-white/25 text-[10px] font-bold uppercase mb-5" style={{ letterSpacing: "0.12em" }}>
            1999 Nissan Skyline GT-R R34
          </p>

          {/* Action banner: agreement to sign */}
          <div className="mb-6 flex gap-4 bg-black border border-amber-400/20 px-5 py-4">
            <div className="w-[3px] bg-amber-400/60 shrink-0 self-stretch rounded-full" />
            <div className="flex-1 min-w-0">
              <p className="text-amber-400 text-[11px] font-bold uppercase tracking-[0.1em] mb-1">
                Action needed
              </p>
              <p className="text-white/60 text-[13px] leading-relaxed">
                Your purchase agreement is ready to sign. Review and sign it below to confirm your reservation and unlock the deposit invoice.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {VAULT_CATEGORIES.map((cat) => (
              <VaultCategory key={cat.id} category={cat} />
            ))}
          </div>

          {/* Persistent access note */}
          <p className="mt-6 text-white/20 text-[11px] text-center leading-relaxed">
            All documents in your vault are permanently accessible — grab your export certificate any time, even years from now.
          </p>
        </div>
      </main>
    </div>
  );
}

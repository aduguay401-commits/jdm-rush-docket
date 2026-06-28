import Link from "next/link";
import { AccountHeader } from "@/app/account/_components/header";
import { PageHeader } from "@/app/account/_components/page-header";
import {
  formatShortDate,
  getCustomerPortalContext,
  getDocketHref,
  getDocketIdParam,
  getVehicleLabel,
  type CustomerDocket,
} from "@/lib/customer/dashboard";

// ── Vault data ───────────────────────────────────────────────────────────────

type DocStatus = "paid" | "signed" | "pending_payment" | "pending_signature" | "pending";

type VaultDoc = {
  name: string;
  status: DocStatus;
  date?: string;
  href?: string | null;
};

type VaultCategory = {
  id: string;
  label: string;
  sublabel: string;
  docs: VaultDoc[];
};

function buildVaultCategories(docket: CustomerDocket): VaultCategory[] {
  const reportDate = formatShortDate(docket.approved_at ?? docket.created_at);
  const agreementDate = formatShortDate(docket.agreement_sent_at ?? docket.approved_at ?? docket.created_at);
  const reportHref = docket.report_url_token ? `/report/${encodeURIComponent(docket.report_url_token)}` : null;
  const agreementHref = docket.agreement_signed
    ? `/api/customer/docket/${encodeURIComponent(docket.id)}/agreement`
    : docket.agreement_sent_at
      ? `/account/docket/${encodeURIComponent(docket.id)}/sign`
      : null;

  return [
    {
      id: "research",
      label: "Research Reports",
      sublabel: "Candidate reports and sourcing recommendations",
      docs: [
        { name: "Vehicle Research Report", status: reportHref ? "signed" : "pending", date: reportHref ? reportDate ?? undefined : undefined, href: reportHref },
      ],
    },
    {
      id: "invoices",
      label: "JDM Rush Invoices",
      sublabel: "Deposit and final payment records",
      docs: [
        { name: "Deposit Invoice", status: docket.deposit_paid ? "paid" : "pending_payment", date: docket.deposit_paid ? reportDate ?? undefined : undefined },
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
        {
          name: "Purchase Agreement",
          status: docket.agreement_signed ? "signed" : "pending_signature",
          date: agreementHref ? agreementDate ?? undefined : undefined,
          href: agreementHref,
        },
      ],
    },
  ];
}

// ── Status chip ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DocStatus, { label: string; className: string }> = {
  paid:             { label: "Paid ✓",             className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" },
  signed:           { label: "Available ✓",        className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" },
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
  const canOpen = Boolean(doc.href) && (doc.status === "paid" || doc.status === "signed" || doc.status === "pending_signature");
  const buttonClass = [
    "shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border transition-colors",
    canOpen
      ? "border-white/[0.12] text-white/60 hover:text-white hover:border-white/25"
      : "border-white/[0.04] text-white/15 cursor-not-allowed",
  ].join(" ");

  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-white/[0.05] last:border-0">
      <div className="shrink-0 w-8 h-8 bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-medium leading-snug truncate ${canOpen ? "text-white" : "text-white/40"}`}>
          {doc.name}
        </p>
        {doc.date && (
          <p className="text-white/25 text-[11px] mt-0.5">{doc.date}</p>
        )}
      </div>

      <StatusChip status={doc.status} />

      {canOpen && doc.href ? (
        <Link href={doc.href} className={buttonClass}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {doc.status === "pending_signature" ? "Sign" : "Open"}
        </Link>
      ) : (
        <button type="button" disabled className={buttonClass}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Open
        </button>
      )}
    </div>
  );
}

// ── Category section ──────────────────────────────────────────────────────────

function VaultCategory({ category }: { category: VaultCategory }) {
  const availableCount = category.docs.filter(
    (d) => (d.status === "paid" || d.status === "signed") && d.href
  ).length;

  return (
    <section className="bg-black border border-white/[0.08]">
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

      <div className="px-5">
        {category.docs.map((doc, i) => (
          <DocRow key={i} doc={doc} />
        ))}
      </div>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selectedDocketId = getDocketIdParam(params);
  const context = await getCustomerPortalContext({
    nextPath: selectedDocketId ? `/account/documents?docket=${encodeURIComponent(selectedDocketId)}` : "/account/documents",
    selectedDocketId,
    requireDocket: true,
  });
  const docket = context.selectedDocket!;
  const vehicle = getVehicleLabel(docket);
  const categories = buildVaultCategories(docket);
  const messagesHref = getDocketHref("/account/messages", docket.id);

  return (
    <div className="min-h-screen bg-[#111111]">
      <AccountHeader customerName={context.customerName} messagesHref={messagesHref} unreadCount={context.unreadCount} />

      <PageHeader
        micro="Purchase & Documents · Your agreements, invoices, and import files are in your vault below."
        backHref={getDocketHref("/account/car", docket.id)}
        backLabel={vehicle}
      />

      <main id="main-content">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <p className="text-white/25 text-[10px] font-bold uppercase mb-5" style={{ letterSpacing: "0.12em" }}>
            {vehicle}
          </p>

          {/* Action banner: agreement to sign */}
          {!docket.agreement_signed && (
            <div className="mb-6 flex gap-4 bg-black border border-amber-400/20 px-5 py-4">
              <div className="w-[3px] bg-amber-400/60 shrink-0 self-stretch rounded-full" />
              <div className="flex-1 min-w-0">
                <p className="text-amber-400 text-[11px] font-bold uppercase tracking-[0.1em] mb-1">
                  Action needed
                </p>
                <p className="text-white/60 text-[13px] leading-relaxed">
                  ${docket.agreement_sent_at ? "Your purchase agreement is ready. Open the Purchase Agreement row below to review and sign." : "Your purchase agreement will appear here when it is ready to sign."}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {categories.map((cat) => (
              <VaultCategory key={cat.id} category={cat} />
            ))}
          </div>

          <p className="mt-6 text-white/20 text-[11px] text-center leading-relaxed">
            All documents in your vault are permanently accessible — grab your export certificate any time, even years from now.
          </p>
        </div>
      </main>
    </div>
  );
}

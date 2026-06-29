import Link from "next/link";
import { AccountHeader } from "@/app/account/_components/header";
import { EmptyState, PageShell, StatusPill } from "@/app/account/_components/garage-ui";
import {
  formatShortDate,
  getCustomerPortalContext,
  getDocketHref,
  getVehicleLabel,
  type CustomerDocket,
} from "@/lib/customer/dashboard";

function ReportCard({ docket }: { docket: CustomerDocket }) {
  const vehicle = getVehicleLabel(docket);
  const reportHref = docket.report_url_token ? `/report/${encodeURIComponent(docket.report_url_token)}` : null;

  return (
    <article className="border border-white/[0.08] bg-black p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#E55125]">
            {formatShortDate(docket.created_at) ?? "Search"}
          </p>
          <h2 className="mt-2 text-[18px] font-black leading-tight text-white">{vehicle}</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-white/40">
            {reportHref ? "Your research report is ready." : "Your sourcing team is preparing the research report."}
          </p>
        </div>
        <StatusPill tone={reportHref ? "good" : "muted"}>{reportHref ? "Report ready" : "In progress"}</StatusPill>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {reportHref ? (
          <Link href={reportHref} className="inline-flex min-h-12 items-center justify-center bg-[#E55125] px-5 text-[13px] font-black uppercase text-white transition hover:brightness-110">
            View Report
          </Link>
        ) : (
          <button type="button" disabled className="inline-flex min-h-12 items-center justify-center border border-white/[0.08] px-5 text-[13px] font-black uppercase text-white/20">
            Report Pending
          </button>
        )}
        <Link href={getDocketHref("/account/messages", docket.id)} className="inline-flex min-h-12 items-center justify-center border border-white/[0.10] px-5 text-[13px] font-black uppercase text-white/55 transition hover:text-white">
          Messages
        </Link>
      </div>
    </article>
  );
}

export default async function FindMyJdmPage() {
  const context = await getCustomerPortalContext({ nextPath: "/account/find" });
  const messagesHref = getDocketHref("/account/messages", context.latestDocket?.id);

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <AccountHeader
        customerName={context.customerName}
        messagesHref={messagesHref}
        unreadCount={context.unreadCount}
        title="Find My JDM"
        backHref="/account"
        backLabel="Back to My JDM Garage"
        breadcrumbs={[{ href: "/account", label: "Garage" }]}
      />

      <PageShell>
        <div className="grid gap-4">
          {context.dockets.length > 0 ? (
            context.dockets.map((docket) => <ReportCard key={docket.id} docket={docket} />)
          ) : (
            <EmptyState title="No searches yet" body="Your JDM Rush searches and research reports will appear here once a docket is connected to your account." />
          )}
        </div>
      </PageShell>
    </div>
  );
}

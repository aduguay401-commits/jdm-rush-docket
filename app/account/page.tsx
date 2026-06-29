import {
  ActionBanner,
  EmptyState,
  PageShell,
  SpokeRow,
  StatGrid,
} from "@/app/account/_components/garage-ui";
import { AccountHeader } from "@/app/account/_components/header";
import {
  getAgreementSentAt,
  getCustomerPortalContext,
  getDocketHref,
  isPurchaseUnlocked,
  isShippingUnlocked,
  type CustomerDocket,
} from "@/lib/customer/dashboard";

type HubAction = {
  href: string;
  title: string;
  body: string;
  priority: number;
};

function isCompletedDocket(docket: CustomerDocket) {
  const status = docket.status?.toLowerCase() ?? "";
  return status === "delivered" || status === "completed" || status === "archived";
}

function getCurrentStage(dockets: CustomerDocket[]) {
  const latest = dockets[0];
  if (!latest) return "None";
  if (isCompletedDocket(latest)) return "Delivered";
  if (isShippingUnlocked(latest)) return "Import";
  if (isPurchaseUnlocked(latest)) return "Purchase";
  if (latest.status === "report_sent") return "Report";
  if (latest.status === "questions_sent") return "Questions";
  return "Research";
}

async function buildHubActions(dockets: CustomerDocket[]): Promise<HubAction[]> {
  const agreementSentEntries = await Promise.all(
    dockets.map(async (docket) => [docket.id, await getAgreementSentAt(docket.id)] as const)
  );
  const agreementSentAt = new Map(agreementSentEntries);
  const actions: HubAction[] = [];

  for (const docket of dockets) {
    if (docket.status === "questions_sent") {
      actions.push({
        href: getDocketHref("/account/messages", docket.id),
        title: "Answer your sourcing questions",
        body: "Marcus needs your reply before the search can continue.",
        priority: 1,
      });
      continue;
    }

    if (docket.status === "report_sent") {
      actions.push({
        href: docket.report_url_token ? `/report/${encodeURIComponent(docket.report_url_token)}` : getDocketHref("/account/find", docket.id),
        title: "Review your vehicle report",
        body: "Your JDM Rush sourcing report is ready.",
        priority: 2,
      });
      continue;
    }

    if (!docket.agreement_signed && agreementSentAt.get(docket.id)) {
      actions.push({
        href: `/account/docket/${encodeURIComponent(docket.id)}/sign`,
        title: "Sign your purchase agreement",
        body: "Your legal agreement is ready for review and signature.",
        priority: 3,
      });
    }
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

export default async function MyGarageHome() {
  const context = await getCustomerPortalContext({ nextPath: "/account" });
  const messagesHref = getDocketHref("/account/messages", context.latestDocket?.id);
  const completed = context.dockets.filter(isCompletedDocket);
  const active = context.dockets.filter((docket) => !isCompletedDocket(docket));
  const actions = await buildHubActions(active);

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <AccountHeader customerName={context.customerName} messagesHref={messagesHref} unreadCount={context.unreadCount} title="My JDM Garage" />

      <PageShell>
        <div className="grid gap-4">
          {actions[0] && <ActionBanner href={actions[0].href} title={actions[0].title} body={actions[0].body} />}

          <section className="border border-white/[0.08] bg-black p-5 sm:p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#E55125]">Welcome back</p>
            <h2 className="mt-2 text-[28px] font-black leading-none tracking-tight text-white sm:text-[36px]">
              Hi {context.customerName}
            </h2>
            <div className="mt-5">
              <StatGrid
                stats={[
                  { label: "Active Imports", value: active.length, tone: "accent" },
                  { label: "Unread Messages", value: context.unreadCount },
                  { label: "Completed", value: completed.length },
                  { label: "Current Stage", value: getCurrentStage(active) },
                ]}
              />
            </div>
          </section>

          <section className="grid gap-3">
            <SpokeRow
              href="/account/find"
              icon="search"
              title="Find My JDM"
              sub="Your searches, sourcing updates, candidate cars, and research reports."
              count={context.dockets.length}
            />
            <SpokeRow
              href="/account/imports"
              icon="ship"
              title="Active Imports"
              sub="Open each in-flight import for vehicle info, documents, agreement, and next steps."
              count={active.length}
            />
            <SpokeRow
              href="/account/completed"
              icon="check"
              title="Completed Purchases"
              sub="Delivered cars and ownership archive."
              count={completed.length}
            />
          </section>

          {context.dockets.length === 0 && (
            <EmptyState
              title="No claimed vehicles yet"
              body="Use the same email address from your JDM Rush inquiry. Matching dockets are claimed automatically after login."
            />
          )}
        </div>
      </PageShell>
    </div>
  );
}

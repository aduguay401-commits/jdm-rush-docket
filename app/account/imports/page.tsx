import { AccountHeader } from "@/app/account/_components/header";
import { EmptyState, ImportCard, PageShell } from "@/app/account/_components/garage-ui";
import {
  getCardStatus,
  getCustomerPortalContext,
  getDocketHref,
  getVehicleLabel,
  type CustomerDocket,
} from "@/lib/customer/dashboard";

function isCompletedDocket(docket: CustomerDocket) {
  const status = docket.status?.toLowerCase() ?? "";
  return status === "delivered" || status === "completed" || status === "archived";
}

export default async function ActiveImportsPage() {
  const context = await getCustomerPortalContext({ nextPath: "/account/imports" });
  const messagesHref = getDocketHref("/account/messages", context.latestDocket?.id);
  const active = context.dockets.filter((docket) => !isCompletedDocket(docket));

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <AccountHeader
        customerName={context.customerName}
        messagesHref={messagesHref}
        unreadCount={context.unreadCount}
        title="My Active Imports"
        backHref="/account"
        backLabel="Back to My JDM Garage"
        breadcrumbs={[{ href: "/account", label: "Garage" }]}
      />

      <PageShell>
        {active.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((docket) => {
              const status = getCardStatus(docket);
              return (
                <ImportCard
                  key={docket.id}
                  href={`/account/imports/${encodeURIComponent(docket.id)}`}
                  vehicle={getVehicleLabel(docket)}
                  status={status.statusLabel}
                  meta={status.progressLabel}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState title="No active imports" body="When your next JDM import is underway, it will appear here as a large tappable card." />
        )}
      </PageShell>
    </div>
  );
}

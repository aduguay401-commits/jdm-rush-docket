import { AccountHeader } from "@/app/account/_components/header";
import { EmptyState, ImportCard, PageShell } from "@/app/account/_components/garage-ui";
import { getCustomerPortalContext, getDocketHref, getVehicleLabel, type CustomerDocket } from "@/lib/customer/dashboard";

function isCompletedDocket(docket: CustomerDocket) {
  const status = docket.status?.toLowerCase() ?? "";
  return status === "delivered" || status === "completed" || status === "archived";
}

export default async function CompletedPurchasesPage() {
  const context = await getCustomerPortalContext({ nextPath: "/account/completed" });
  const messagesHref = getDocketHref("/account/messages", context.latestDocket?.id);
  const completed = context.dockets.filter(isCompletedDocket);

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <AccountHeader
        customerName={context.customerName}
        messagesHref={messagesHref}
        unreadCount={context.unreadCount}
        title="My Completed Purchases"
        backHref="/account"
        backLabel="Back to My JDM Garage"
        breadcrumbs={[{ href: "/account", label: "Garage" }]}
      />

      <PageShell>
        {completed.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {completed.map((docket) => (
              <ImportCard
                key={docket.id}
                href={`/account/imports/${encodeURIComponent(docket.id)}`}
                vehicle={getVehicleLabel(docket)}
                status="Delivered"
                meta="Completed purchase archive"
                showJourneyTrack={false}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No completed purchases yet" body="Delivered cars will move into this archive when completion data exists in your docket." />
        )}
      </PageShell>
    </div>
  );
}

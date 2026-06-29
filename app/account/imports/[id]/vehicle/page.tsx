import { AccountHeader } from "@/app/account/_components/header";
import { EmptyState, PageShell, StatusPill } from "@/app/account/_components/garage-ui";
import {
  getCustomerPortalContext,
  getDocketHref,
  getResearchData,
  getVehicleLabel,
} from "@/lib/customer/dashboard";

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="border border-white/[0.08] bg-black p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.10em] text-white/30">{label}</p>
      <p className="mt-2 break-words text-[15px] font-bold text-white/80">{value || "Not available yet"}</p>
    </div>
  );
}

function photoUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && /^https?:\/\//.test(item));
}

export default async function VehicleInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getCustomerPortalContext({
    nextPath: `/account/imports/${encodeURIComponent(id)}/vehicle`,
    selectedDocketId: id,
    requireDocket: true,
  });
  const docket = context.selectedDocket!;
  const vehicle = getVehicleLabel(docket);
  const research = await getResearchData(docket.id);
  const selectedOption =
    research.dealerOptions.find((option) => option.option_number === (docket.chosen_dealer_index ?? docket.selected_private_dealer_option)) ??
    research.dealerOptions[0] ??
    null;
  const photos = photoUrls(selectedOption?.photos);
  const messagesHref = getDocketHref("/account/messages", docket.id);

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <AccountHeader
        customerName={context.customerName}
        messagesHref={messagesHref}
        unreadCount={context.unreadCount}
        title="Vehicle Info"
        backHref={`/account/imports/${encodeURIComponent(docket.id)}`}
        backLabel={`Back to ${vehicle}`}
        breadcrumbs={[
          { href: "/account", label: "Garage" },
          { href: "/account/imports", label: "My Active Imports" },
          { href: `/account/imports/${encodeURIComponent(docket.id)}`, label: vehicle },
        ]}
      />

      <PageShell>
        <div className="grid gap-4">
          <section className="border border-white/[0.08] bg-black p-5 sm:p-6">
            <StatusPill tone="accent">Real docket data</StatusPill>
            <h2 className="mt-3 text-[24px] font-black leading-tight text-white">{vehicle}</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-white/40">
              Details below come from the current docket and sourced research records. Missing values are left blank rather than inferred.
            </p>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Year" value={docket.vehicle_year} />
            <Detail label="Make" value={docket.vehicle_make} />
            <Detail label="Model" value={docket.vehicle_model} />
            <Detail label="Description" value={docket.vehicle_description} />
            <Detail label="Grade" value={selectedOption?.grade} />
            <Detail label="Mileage" value={selectedOption?.mileage} />
            <Detail label="Colour" value={selectedOption?.colour} />
            <Detail label="Transmission" value={selectedOption?.transmission} />
          </div>

          {photos.length > 0 ? (
            <section className="grid gap-3 sm:grid-cols-2">
              {photos.slice(0, 6).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt={`${vehicle} sourced photo`} className="aspect-[4/3] w-full border border-white/[0.08] bg-black object-cover" />
              ))}
            </section>
          ) : (
            <EmptyState title="Photos are not available in the garage yet" body="When sourced vehicle photos are attached to this docket, they will appear here. The rest of the vehicle data above remains available." />
          )}
        </div>
      </PageShell>
    </div>
  );
}

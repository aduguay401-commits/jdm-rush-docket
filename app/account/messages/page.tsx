import { MessagesClient } from "./MessagesClient";
import {
  getCustomerPortalContext,
  getDocketIdParam,
  getMessageThread,
  getVehicleLabel,
} from "@/lib/customer/dashboard";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selectedDocketId = getDocketIdParam(params);
  const context = await getCustomerPortalContext({
    nextPath: selectedDocketId ? `/account/messages?docket=${encodeURIComponent(selectedDocketId)}` : "/account/messages",
    selectedDocketId,
    requireDocket: true,
  });
  const docket = context.selectedDocket!;
  const messages = await getMessageThread(docket.id);

  return (
    <MessagesClient
      docketId={docket.id}
      customerName={context.customerName}
      messages={messages}
      vehicle={getVehicleLabel(docket)}
    />
  );
}

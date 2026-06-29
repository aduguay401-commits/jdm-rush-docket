import { redirect } from "next/navigation";
import { getCustomerPortalContext, getDocketIdParam } from "@/lib/customer/dashboard";

export default async function CarDashboardRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selectedDocketId = getDocketIdParam(params);
  const context = await getCustomerPortalContext({
    nextPath: selectedDocketId ? `/account/car?docket=${encodeURIComponent(selectedDocketId)}` : "/account/car",
    selectedDocketId,
    requireDocket: true,
  });

  redirect(`/account/imports/${encodeURIComponent(context.selectedDocket!.id)}`);
}

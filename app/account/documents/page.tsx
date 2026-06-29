import { redirect } from "next/navigation";
import { getCustomerPortalContext, getDocketIdParam } from "@/lib/customer/dashboard";

export default async function DocumentsRedirect({
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

  redirect(`/account/imports/${encodeURIComponent(context.selectedDocket!.id)}/agreement`);
}

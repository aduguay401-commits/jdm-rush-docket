import { redirect } from "next/navigation";
import { getDocketIdParam } from "@/lib/customer/dashboard";

export default async function ResearchRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const selectedDocketId = getDocketIdParam(params);
  redirect(selectedDocketId ? `/account/find?docket=${encodeURIComponent(selectedDocketId)}` : "/account/find");
}

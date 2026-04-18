import { sendEmail } from '@/lib/email';

type CreateDepositInvoiceInput = {
  docketId: string;
  customerName: string;
  customerEmail: string | null;
  vehicleDescription: string;
  chosenPath: "private_dealer" | "auction";
  chosenDealerIndex?: number | null;
};

export async function createDepositInvoice(input: CreateDepositInvoiceInput) {
  console.log("[invoice-stub] createDepositInvoice called", {
    docketId: input.docketId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    vehicleDescription: input.vehicleDescription,
    chosenPath: input.chosenPath,
    chosenDealerIndex: input.chosenDealerIndex ?? null,
    depositTotalCad: 1500,
  });
  const fromEmail = process.env.FROM_EMAIL;
  const adminEmail = process.env.ADMIN_EMAIL ?? "adam@jdmrushimports.ca";
  const devMode = process.env.DEV_MODE === "true";

  if (!fromEmail) {
    throw new Error("Email configuration is missing");
  }
  const subject = `[INVOICE STUB] Deposit Required — ${input.customerName}`;
  const devPrefix = devMode ? "[DEV MODE]\n\n" : "";

  await sendEmail({
    from: fromEmail,
    to: adminEmail,
    subject,
    text: `${devPrefix}QuickBooks integration is stubbed for now and will be wired in during the polish pass.

Docket ID: ${input.docketId}
Customer Name: ${input.customerName}
Customer Email: ${input.customerEmail ?? "Unknown"}
Vehicle: ${input.vehicleDescription}
Chosen Path: ${input.chosenPath}
Chosen Dealer Index: ${input.chosenDealerIndex ?? "N/A"}
Deposit Total: $1,500 CAD`,
  });
}

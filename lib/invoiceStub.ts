import { sendEmail } from '@/lib/email';
import { DEPOSIT_NON_REFUNDABLE_CAD } from '@/lib/importCalculator';

type CreateDepositInvoiceInput = {
  docketId: string;
  customerName: string;
  customerEmail: string | null;
  vehicleDescription: string;
  chosenPath: "private_dealer" | "auction";
  chosenDealerIndex?: number | null;
  /** The service fee for the chosen car (= the deposit), or null when no price is on file. */
  depositCad?: number | null;
  /** The CAD purchase price the tier was picked from. */
  vehiclePriceCad?: number | null;
};

const cad = (n: number) => `$${n.toLocaleString("en-CA", { maximumFractionDigits: 2 })} CAD`;

export async function createDepositInvoice(input: CreateDepositInvoiceInput) {
  console.log("[invoice-stub] createDepositInvoice called", {
    docketId: input.docketId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    vehicleDescription: input.vehicleDescription,
    chosenPath: input.chosenPath,
    chosenDealerIndex: input.chosenDealerIndex ?? null,
    depositTotalCad: input.depositCad ?? null,
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
Deposit Total: ${
      input.depositCad != null
        ? `${cad(input.depositCad)} + tax (service fee tier for a ${cad(input.vehiclePriceCad ?? 0)} purchase price; ${cad(DEPOSIT_NON_REFUNDABLE_CAD)} non-refundable)`
        : "no purchase price on file. Pick the tier by hand: up to $10,000 = $1,000, $10,001-$20,000 = $1,500, $20,001-$30,000 = $2,000, over $30,000 = $3,500 (+ tax)"
    }`,
  });
}

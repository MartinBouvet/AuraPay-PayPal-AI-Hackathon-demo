import { paypalCall, paypalJson, paypalPngDataUrl } from "@/lib/paypal/client";
import { isRecord } from "@/lib/paypal/errors";
import type { MockApplicationCode } from "@/lib/paypal/config";

export type PayPalInvoice = {
  id?: string;
  status?: string;
  detail?: {
    invoice_number?: string;
    currency_code?: string;
    metadata?: { recipient_view_url?: string };
  };
  due_amount?: { currency_code?: string; value?: string };
  amount?: { currency_code?: string; value?: string };
  links?: Array<{ href: string; rel: string; method?: string }>;
};

export type InvoiceDraft = {
  requestId: string;
  invoiceNumber: string;
  currencyCode: string;
  note: string;
  merchantEmail: string;
  recipient: { email: string; givenName: string; surname: string };
  itemName: string;
  itemDescription: string;
  quantity: string;
  unitAmount: string;
  taxPercent: string;
  taxAmount: string;
  mockApplicationCode?: MockApplicationCode;
};

function invoiceIdFromLocation(location: string | null): string | undefined {
  if (!location) return undefined;
  try {
    const url = new URL(location);
    const segment = url.pathname.split("/").filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : undefined;
  } catch {
    return undefined;
  }
}

export async function createPayPalInvoice(draft: InvoiceDraft): Promise<PayPalInvoice> {
  const result = await paypalCall({
    method: "POST",
    path: "/v2/invoicing/invoices",
    requestId: draft.requestId,
    mockApplicationCode: draft.mockApplicationCode,
    preferRepresentation: true,
    json: {
      detail: {
        invoice_number: draft.invoiceNumber,
        currency_code: draft.currencyCode,
        note: draft.note,
        payment_term: { term_type: "DUE_ON_RECEIPT" },
        memo: "Quote locked by the AuraPay agent. The payer cannot change these amounts.",
      },
      invoicer: {
        name: { given_name: "AuraPay", surname: "Studio" },
        email_address: draft.merchantEmail,
      },
      primary_recipients: [
        {
          billing_info: {
            name: { given_name: draft.recipient.givenName, surname: draft.recipient.surname },
            email_address: draft.recipient.email,
          },
        },
      ],
      items: [
        {
          name: draft.itemName.slice(0, 200),
          description: draft.itemDescription.slice(0, 1000),
          quantity: draft.quantity,
          unit_amount: { currency_code: draft.currencyCode, value: draft.unitAmount },
          unit_of_measure: "QUANTITY",
          tax: {
            name: "Tax",
            percent: draft.taxPercent,
            amount: { currency_code: draft.currencyCode, value: draft.taxAmount },
          },
        },
      ],
      configuration: {
        tax_inclusive: false,
        allow_tip: false,
        partial_payment: { allow_partial_payment: false },
      },
    },
  });

  const data = isRecord(result.data) ? (result.data as PayPalInvoice) : {};
  if (!data.id) {
    const id = invoiceIdFromLocation(result.location);
    if (id) data.id = id;
  }
  return data;
}

export async function getPayPalInvoice(invoiceId: string): Promise<PayPalInvoice> {
  return paypalJson<PayPalInvoice>({
    method: "GET",
    path: `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`,
  });
}

export async function sendPayPalInvoice(invoiceId: string, requestId: string): Promise<PayPalInvoice> {
  return paypalJson<PayPalInvoice>({
    method: "POST",
    path: `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`,
    requestId,
    preferRepresentation: true,
    json: {
      send_to_recipient: true,
      send_to_invoicer: true,
    },
  });
}

export async function generateInvoiceQr(invoiceId: string, requestId: string): Promise<string | null> {
  return paypalPngDataUrl({
    method: "POST",
    path: `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/generate-qr-code`,
    requestId,
    json: { width: 360, height: 360 },
  });
}

export function payerViewUrl(invoice: PayPalInvoice): string | undefined {
  const fromLink = invoice.links?.find((link) => link.rel === "payer-view")?.href;
  return fromLink || invoice.detail?.metadata?.recipient_view_url;
}

import type { MockApplicationCode } from "@/lib/paypal/config";
import { paypalJson } from "@/lib/paypal/client";

export type PayPalMoney = {
  currency_code: string;
  value: string;
};

export type PayPalOrder = {
  id: string;
  status: string;
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    invoice_id?: string;
    amount?: PayPalMoney & {
      breakdown?: {
        item_total?: PayPalMoney;
        tax_total?: PayPalMoney;
      };
    };
    payments?: {
      captures?: Array<{ id?: string; status?: string; amount?: PayPalMoney }>;
    };
  }>;
};

export type OrderLine = {
  name: string;
  description: string;
  quantity: string;
  unitAmount: string;
  taxAmount: string;
};

export type CreateOrderInput = {
  requestId: string;
  referenceId: string;
  customId: string;
  invoiceNumber?: string;
  description: string;
  currencyCode: string;
  itemTotal: string;
  taxTotal: string;
  value: string;
  items: OrderLine[];
  mockApplicationCode?: MockApplicationCode;
};

export async function createPayPalOrder(input: CreateOrderInput): Promise<PayPalOrder> {
  return paypalJson<PayPalOrder>({
    method: "POST",
    path: "/v2/checkout/orders",
    requestId: input.requestId,
    mockApplicationCode: input.mockApplicationCode,
    preferRepresentation: true,
    json: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.referenceId,
          custom_id: input.customId,
          invoice_id: input.invoiceNumber,
          description: input.description.slice(0, 127),
          amount: {
            currency_code: input.currencyCode,
            value: input.value,
            breakdown: {
              item_total: { currency_code: input.currencyCode, value: input.itemTotal },
              tax_total: { currency_code: input.currencyCode, value: input.taxTotal },
            },
          },
          items: input.items.map((item) => ({
            name: item.name.slice(0, 127),
            description: item.description.slice(0, 127),
            quantity: item.quantity,
            category: "DIGITAL_GOODS",
            unit_amount: { currency_code: input.currencyCode, value: item.unitAmount },
            tax: { currency_code: input.currencyCode, value: item.taxAmount },
          })),
        },
      ],
    },
  });
}

export async function getPayPalOrder(orderId: string): Promise<PayPalOrder> {
  return paypalJson<PayPalOrder>({
    method: "GET",
    path: `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
  });
}

export async function capturePayPalOrder(
  orderId: string,
  requestId: string,
  mockApplicationCode?: MockApplicationCode,
): Promise<PayPalOrder> {
  return paypalJson<PayPalOrder>({
    method: "POST",
    path: `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    requestId,
    mockApplicationCode,
    preferRepresentation: true,
    json: {},
  });
}

export function readCaptureId(order: PayPalOrder): string | undefined {
  return order.purchase_units?.[0]?.payments?.captures?.[0]?.id;
}

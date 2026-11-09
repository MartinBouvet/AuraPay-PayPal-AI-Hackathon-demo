import type React from "react";

export {};

declare global {
  interface Window {
    paypal?: {
      createInstance: (options: {
        clientToken: string;
        components: Array<"paypal-payments">;
        pageType?: "checkout";
        locale?: string;
        clientMetadataId?: string;
      }) => Promise<PayPalSdkInstance>;
    };
  }
}

type SessionHandlers = {
  onApprove: (data: { orderId: string }) => Promise<void> | void;
  onCancel: (data?: unknown) => void;
  onError: (error: { message?: string; code?: string }) => void;
};

type PaymentSession = {
  start: (
    options: { presentationMode: "auto" },
    order: Promise<{ orderId: string }>,
  ) => Promise<void>;
};

type PayPalSdkInstance = {
  findEligibleMethods: (input: { currencyCode: string; amount: string }) => Promise<{
    isEligible: (method: string) => boolean;
    getDetails: (method: string) => { productCode?: string; countryCode?: string };
  }>;
  createPayPalOneTimePaymentSession: (handlers: SessionHandlers) => PaymentSession;
  createPayLaterOneTimePaymentSession: (handlers: SessionHandlers) => PaymentSession;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "paypal-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        type?: string;
      };
      "paypal-pay-later-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

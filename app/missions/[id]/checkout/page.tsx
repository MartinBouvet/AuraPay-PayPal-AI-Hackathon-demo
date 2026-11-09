import { PaypalCheckout } from "@/components/paypal-checkout";
import { paypalSdkScriptUrl } from "@/lib/paypal/config";

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaypalCheckout quoteId={id} sdkUrl={paypalSdkScriptUrl()} />;
}

import { integrationStatus } from "@/lib/paypal/config";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  return json(integrationStatus());
}

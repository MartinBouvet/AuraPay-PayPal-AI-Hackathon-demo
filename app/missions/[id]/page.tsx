import { DossierDesk } from "@/components/dossier-desk";

export default async function MissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DossierDesk quoteId={id} devTools={process.env.NODE_ENV === "development"} />;
}

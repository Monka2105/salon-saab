import type { Metadata } from "next";
import { PublicShell } from "@/components/PublicShell";
import { ServicesView } from "@/components/services/ServicesView";
import { getCurrentTenant } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const { terminology } = await getCurrentTenant();
  return { title: terminology.item.plural };
}

export default async function CatalogPage() {
  const tenant = await getCurrentTenant();

  return (
    <PublicShell tenant={tenant}>
      <header className="max-w-[600px]">
        <p className="micro-label text-ash">{tenant.business.name}</p>
        <h1 className="headline mt-5">{tenant.terminology.item.plural}</h1>
      </header>
      <ServicesView tenant={tenant} />
    </PublicShell>
  );
}

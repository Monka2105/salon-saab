import { tenantConfig } from "@/config/tenant";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { SettingsForm } from "./SettingsForm";

export default async function AdminSettingsPage() {
  const tenant = await getCurrentTenant();
  const row = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-zinc-500">
          Los campos vacíos usan el valor por defecto de <code>src/config/tenant.ts</code> (mostrado como placeholder).
        </p>
      </div>
      <SettingsForm
        values={{
          name: row.name ?? "",
          tagline: row.tagline ?? "",
          description: row.description ?? "",
          phone: row.phone ?? "",
          address: row.address ?? "",
          timezone: row.timezone ?? "",
          primaryColor: row.primaryColor ?? "",
          accentColor: row.accentColor ?? "",
          whatsappPhoneNumberId: row.whatsappPhoneNumberId ?? "",
          systemPrompt: row.systemPrompt ?? "",
          terminology: row.terminology ?? "",
        }}
        defaults={{
          ...tenantConfig.business,
          primaryColor: tenantConfig.theme.primary,
          accentColor: tenantConfig.theme.accent,
          systemPrompt: tenantConfig.agent.systemPrompt,
          terminology: JSON.stringify(tenantConfig.terminology, null, 2),
        }}
      />
    </>
  );
}

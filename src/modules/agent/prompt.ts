import type { Service, StaffMember, User } from "@prisma/client";
import { describeOpeningHours, formatDateTime, formatPrice } from "@/lib/format";
import type { ResolvedTenant } from "@/lib/tenant";

/** Sustituye {{ruta.a.valor}} por el valor correspondiente de `vars` (vacío si no existe). */
export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const value = path
      .split(".")
      .reduce<unknown>((acc, key) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined), vars);
    return value == null ? "" : String(value);
  });
}

function describeCatalog(services: Service[], tenant: ResolvedTenant): string {
  if (!services.length) return "(catálogo vacío)";
  return services
    .map((s) => {
      const details = [formatPrice(s.price, tenant.business), `${s.durationMinutes} min`].filter(Boolean).join(" · ");
      return `- [${s.id}] ${s.title} — ${details}${s.description ? `\n  ${s.description}` : ""}`;
    })
    .join("\n");
}

function describeStaff(staff: StaffMember[]): string {
  if (!staff.length) return "(sin estilistas configurados)";
  return staff.map((s) => `- [${s.id}] ${s.name}${s.specialty ? ` — ${s.specialty}` : ""}`).join("\n");
}

export function buildSystemPrompt(params: {
  tenant: ResolvedTenant;
  services: Service[];
  staff: StaffMember[];
  customer: User;
  now?: Date;
}): string {
  const { tenant, services, staff, customer, now = new Date() } = params;
  const hours = describeOpeningHours(tenant.records.openingHours, tenant.business.locale)
    .map(({ day, ranges }) => `  - ${day}: ${ranges}`)
    .join("\n");

  return renderTemplate(tenant.agent.systemPrompt, {
    business: tenant.business,
    terminology: tenant.terminology,
    catalog: describeCatalog(services, tenant),
    staff: describeStaff(staff),
    openingHours: hours || "  (no definido)",
    now: formatDateTime(now, tenant.business),
    customer: {
      name: customer.name ?? "(desconocido)",
      phone: customer.phoneNumber ?? "",
      verified: customer.isPhoneVerified ? "sí" : "no",
    },
  });
}

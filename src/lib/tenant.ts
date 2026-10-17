import { cache } from "react";
import type { Tenant } from "@prisma/client";
import { tenantConfig, type TenantConfig, type Terminology } from "@/config/tenant";
import { ensureInitialData } from "@/modules/setup/initial-data";
import { prisma } from "./db";

/** Configuración efectiva: config/tenant.ts + overrides guardados en la tabla Tenant. */
export type ResolvedTenant = TenantConfig & {
  id: string;
  whatsappPhoneNumberId: string | null;
};

const DEFAULT_SLUG = process.env.TENANT_SLUG || tenantConfig.slug;

export function parseJson<T>(value: string | null | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export function resolveTenant(row: Tenant): ResolvedTenant {
  const base = tenantConfig;
  const terms = parseJson<Partial<Terminology>>(row.terminology) ?? {};

  return {
    ...base,
    id: row.id,
    slug: row.slug,
    whatsappPhoneNumberId: row.whatsappPhoneNumberId,
    business: {
      ...base.business,
      name: row.name ?? base.business.name,
      tagline: row.tagline ?? base.business.tagline,
      description: row.description ?? base.business.description,
      phone: row.phone ?? base.business.phone,
      address: row.address ?? base.business.address,
      timezone: row.timezone ?? base.business.timezone,
    },
    theme: {
      ...base.theme,
      primary: row.primaryColor ?? base.theme.primary,
      accent: row.accentColor ?? base.theme.accent,
    },
    terminology: {
      ...base.terminology,
      ...terms,
      statusLabels: { ...base.terminology.statusLabels, ...terms.statusLabels },
    },
    agent: {
      ...base.agent,
      model: process.env.AI_MODEL || base.agent.model,
      systemPrompt: row.systemPrompt ?? base.agent.systemPrompt,
    },
  };
}

// Una vez por proceso: crea admin/servicios/estilistas iniciales si faltan (ver initial-data.ts).
let initialData: Promise<void> | undefined;

async function loadDefaultTenantRow(): Promise<Tenant> {
  // upsert: crea la fila la primera vez, así la app funciona sin seed.
  const row = await prisma.tenant.upsert({ where: { slug: DEFAULT_SLUG }, create: { slug: DEFAULT_SLUG }, update: {} });
  initialData ??= ensureInitialData(prisma, row.id, { syncAdminPassword: false }).catch((err) => {
    initialData = undefined;
    console.error("No se pudieron crear los datos iniciales:", err);
  });
  await initialData;
  return row;
}

/** Tenant de la petición actual (memoizado por request en Server Components). */
export const getCurrentTenant = cache(async (): Promise<ResolvedTenant> => {
  return resolveTenant(await loadDefaultTenantRow());
});

/** Enruta un webhook al tenant dueño del número; si no hay match, usa el tenant por defecto. */
export async function getTenantByPhoneNumberId(phoneNumberId: string): Promise<ResolvedTenant> {
  const row = await prisma.tenant.findUnique({ where: { whatsappPhoneNumberId: phoneNumberId } });
  return resolveTenant(row ?? (await loadDefaultTenantRow()));
}

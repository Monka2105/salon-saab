import type { Metadata } from "next";
import { BookingForm } from "@/components/BookingForm";
import { PublicShell } from "@/components/PublicShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatPrice, shiftDay, todayIn } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const { terminology } = await getCurrentTenant();
  return { title: terminology.ctaPrimary };
}

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; staff?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  await requireUser(`/new${query.size ? `?${query}` : ""}`);

  const tenant = await getCurrentTenant();
  const { terminology: terms, records, business } = tenant;

  const [services, staff] = await Promise.all([
    prisma.service.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }] }),
    prisma.staffMember.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const today = todayIn(business.timezone);

  return (
    <PublicShell tenant={tenant}>
      <div className="grid gap-10 md:grid-cols-[1fr_1.2fr] md:gap-16">
        <div>
          <h1 className="headline">{terms.ctaPrimary}</h1>
          <p className="mt-5 max-w-[420px] text-lg leading-[1.35]">Elige servicio, estilista y día: te mostramos solo los horarios realmente libres. Te confirmaremos por WhatsApp.</p>
        </div>
        <BookingForm
          services={services.map((s) => {
            const price = formatPrice(s.price, business);
            return { id: s.id, label: `${s.title} — ${s.durationMinutes} min${price ? ` · ${price}` : ""}` };
          })}
          staff={staff}
          defaultServiceId={services.some((s) => s.id === params.service) ? params.service : undefined}
          defaultStaffId={staff.some((s) => s.id === params.staff) ? params.staff : undefined}
          terms={terms}
          minDay={today}
          maxDay={shiftDay(today, records.maxDaysAhead)}
        />
      </div>
    </PublicShell>
  );
}

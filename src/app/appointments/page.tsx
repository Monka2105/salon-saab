import type { Metadata } from "next";
import Link from "next/link";
import { AppointmentCard } from "@/components/appointments/AppointmentCard";
import { PublicShell } from "@/components/PublicShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { BLOCKING_STATUSES } from "@/modules/appointments/status";

export const metadata: Metadata = { title: "Mis citas", robots: { index: false } };

export default async function MyAppointmentsPage() {
  const [user, tenant] = await Promise.all([requireUser("/appointments"), getCurrentTenant()]);
  const { terminology: terms } = tenant;

  const upcoming = await prisma.appointment.findMany({
    where: { userId: user.id, tenantId: tenant.id, endTime: { gt: new Date() }, status: { in: BLOCKING_STATUSES } },
    include: { service: true, staffMember: true },
    orderBy: { startTime: "asc" },
  });

  return (
    <PublicShell tenant={tenant}>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="micro-label text-ash">Mi cuenta</p>
          <h1 className="headline mt-5">Mis {terms.record.plural.toLowerCase()}</h1>
        </div>
        <Link href="/new" className="link-cta">
          {terms.ctaPrimary}
        </Link>
      </header>

      {upcoming.length ? (
        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((a) => (
            <AppointmentCard key={a.id} appointment={a} tenant={tenant} />
          ))}
        </section>
      ) : (
        <section className="max-w-[520px] space-y-6">
          <p className="font-serif text-2xl leading-[1.2]">No tienes {terms.record.plural.toLowerCase()} próximas.</p>
          <Link href="/catalog" className="link-cta">
            Ver {terms.item.plural.toLowerCase()}
          </Link>
        </section>
      )}
    </PublicShell>
  );
}

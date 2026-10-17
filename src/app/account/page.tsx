import type { Metadata } from "next";
import Link from "next/link";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { PublicShell } from "@/components/PublicShell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { BLOCKING_STATUSES } from "@/modules/appointments/status";
import { maskPhone } from "@/lib/phone";
import { getCurrentTenant } from "@/lib/tenant";
import { confirmLinkCode, logout, requestLinkCode } from "./actions";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

export default async function AccountPage() {
  const [user, tenant] = await Promise.all([requireUser("/account"), getCurrentTenant()]);
  const { terminology: terms, business } = tenant;

  const where = { userId: user.id, tenantId: tenant.id, endTime: { gt: new Date() }, status: { in: BLOCKING_STATUSES } };
  const [next, upcomingCount] = await Promise.all([
    prisma.appointment.findFirst({ where, include: { service: true }, orderBy: { startTime: "asc" } }),
    prisma.appointment.count({ where }),
  ]);

  return (
    <PublicShell tenant={tenant}>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="micro-label text-ash">Mi cuenta</p>
          <h1 className="headline mt-5">{user.name ?? "Hola."}</h1>
        </div>
        <form action={logout}>
          <button className="btn-secondary">Cerrar sesión</button>
        </form>
      </header>

      <section className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
        <h2 className="font-serif text-[32px] leading-[1.1]">WhatsApp</h2>
        {user.isPhoneVerified && user.phoneNumber ? (
          <div className="max-w-[520px]">
            <p className="micro-label text-ash">Verificado</p>
            <p className="mt-3 font-serif text-2xl">{maskPhone(user.phoneNumber)}</p>
            <p className="mt-4 text-[15px] leading-[1.45] text-ash">
              Nuestro asistente te reconocerá cuando escribas desde este número: podrás agendar, consultar o cancelar
              tus {terms.record.plural.toLowerCase()} por WhatsApp.
            </p>
          </div>
        ) : (
          <div className="max-w-[520px] bg-white p-8">
            <p className="mb-6 text-[15px] leading-[1.45]">
              Verifica tu celular para gestionar tus {terms.record.plural.toLowerCase()} también desde WhatsApp.
            </p>
            <PhoneOtpForm requestAction={requestLinkCode} verifyAction={confirmLinkCode} submitLabel="Verificar" />
          </div>
        )}
      </section>

      <section className="grid gap-10 md:grid-cols-[1fr_2fr] md:gap-16">
        <h2 className="font-serif text-[32px] leading-[1.1]">Próximas {terms.record.plural.toLowerCase()}</h2>
        {next ? (
          <div className="space-y-6">
            <div>
              <p className="font-serif text-2xl leading-[1.1]">{next.service.title}</p>
              <p className="mt-2 text-[15px]">{formatDateTime(next.startTime, business)}</p>
              {upcomingCount > 1 && (
                <p className="micro-label mt-2 text-ash">
                  y {upcomingCount - 1} {upcomingCount - 1 === 1 ? terms.record.singular.toLowerCase() : terms.record.plural.toLowerCase()} más
                </p>
              )}
            </div>
            <Link href="/appointments" className="link-cta">
              Ver mis {terms.record.plural.toLowerCase()}
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-[15px] text-ash">No tienes {terms.record.plural.toLowerCase()} próximas.</p>
            <Link href="/#servicios" className="link-cta mt-6">
              {terms.ctaPrimary}
            </Link>
          </div>
        )}
      </section>
    </PublicShell>
  );
}

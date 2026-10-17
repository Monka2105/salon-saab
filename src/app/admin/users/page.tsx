import type { Prisma, Role } from "@prisma/client";
import Link from "next/link";
import { UserRoleEditor } from "@/components/admin/UserRoleEditor";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { maskPhone } from "@/lib/phone";
import { getCurrentTenant } from "@/lib/tenant";
import { ROLE_LABELS, ROLES } from "@/modules/staff/roles";

const PAGE_SIZE = 100;

/** Cuentas registradas: buscar, filtrar por rol y cambiar roles (p. ej. dar o quitar acceso de estilista). */
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const [admin, tenant, params] = await Promise.all([requireAdmin(), getCurrentTenant(), searchParams]);
  const { business } = tenant;
  const q = params.q?.trim().slice(0, 100) ?? "";
  const role = ROLES.find((r) => r === params.role);

  const digits = q.replace(/\D/g, "");
  const where: Prisma.UserWhereInput = {
    ...(role && { role }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 3 ? [{ phoneNumber: { contains: digits } }] : []),
      ],
    }),
  };

  const [users, total, counts, freeStaff] = await Promise.all([
    prisma.user.findMany({
      where,
      // Admin y estilistas primero (orden del enum: ADMIN, STAFF, USER), luego los más recientes.
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      take: PAGE_SIZE,
      include: {
        staffProfile: { select: { id: true, name: true, active: true } },
        _count: { select: { appointments: true } },
      },
    }),
    prisma.user.count({ where }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.staffMember.findMany({
      where: { tenantId: tenant.id, active: true, userId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const countOf = (r: Role) => counts.find((c) => c.role === r)?._count._all ?? 0;
  const date = new Intl.DateTimeFormat(business.locale, { dateStyle: "medium", timeZone: business.timezone });
  const filterHref = (r?: Role) => {
    const sp = new URLSearchParams({ ...(q && { q }), ...(r && { role: r }) });
    return `/admin/users${sp.size ? `?${sp}` : ""}`;
  };

  return (
    <>
      <header className="space-y-6">
        <h1 className="headline">Usuarios</h1>
        <form className="flex flex-wrap items-center gap-4">
          {role && <input type="hidden" name="role" value={role} />}
          <input name="q" defaultValue={q} placeholder="Buscar por nombre, correo o celular" className="input max-w-[420px] flex-1" />
          <button className="btn-secondary">Buscar</button>
        </form>
        <nav className="flex flex-wrap gap-x-8 gap-y-3">
          <Link href={filterHref()} scroll={false} className={!role ? "link-cta" : "btn-secondary border-transparent"}>
            Todos ({counts.reduce((n, c) => n + c._count._all, 0)})
          </Link>
          {ROLES.map((r) => (
            <Link key={r} href={filterHref(r)} scroll={false} className={role === r ? "link-cta" : "btn-secondary border-transparent"}>
              {ROLE_LABELS[r]} ({countOf(r)})
            </Link>
          ))}
        </nav>
      </header>

      <ul className="border-b border-stone">
        {users.map((u) => {
          // Fichas que puede tomar: las libres + la suya (aunque esté archivada no se ofrece).
          const options = u.staffProfile?.active ? [{ id: u.staffProfile.id, name: u.staffProfile.name }, ...freeStaff] : freeStaff;
          return (
            <li key={u.id} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-t border-stone py-5">
              <div className="min-w-0 flex-1">
                <p className="text-lg">
                  {u.name ?? "Sin nombre"}
                  <span className={`micro-label ml-3 ${u.role === "USER" ? "text-ash" : "text-carbon"}`}>{ROLE_LABELS[u.role]}</span>
                </p>
                <p className="mt-1 text-[14px] break-all text-ash">
                  {[u.email, u.phoneNumber && maskPhone(u.phoneNumber)].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                </p>
                <p className="micro-label mt-2 text-ash">
                  {u.staffProfile && `Ficha: ${u.staffProfile.name} · `}
                  {u._count.appointments} {u._count.appointments === 1 ? "cita" : "citas"} · desde {date.format(u.createdAt)}
                </p>
              </div>
              <div className="w-full sm:w-auto sm:max-w-[420px] sm:min-w-[280px] sm:text-right">
                {/* key: si el rol cambia en el servidor, el editor se reinicia cerrado */}
                <UserRoleEditor
                  key={`${u.id}-${u.role}-${u.staffProfile?.id}`}
                  userId={u.id}
                  role={u.role}
                  staffProfileId={u.staffProfile?.active ? u.staffProfile.id : null}
                  staffOptions={options}
                  isSelf={u.id === admin.id}
                />
              </div>
            </li>
          );
        })}
        {!users.length && <li className="border-t border-stone py-10 text-[15px] text-ash">Ninguna cuenta coincide.</li>}
      </ul>
      {total > users.length && (
        <p className="text-[13px] text-ash">
          Mostrando {users.length} de {total}. Usa el buscador para encontrar una cuenta concreta.
        </p>
      )}
    </>
  );
}

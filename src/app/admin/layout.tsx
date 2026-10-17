import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { logout } from "./actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  const tenant = await getCurrentTenant();
  const { business, terminology: terms } = tenant;
  // Un admin que también atiende tiene su propia agenda de estilista.
  const ownStaffProfile = await prisma.staffMember.count({ where: { userId: admin.id, tenantId: tenant.id, active: true } });

  const links = [
    { href: "/admin", label: terms.record.plural },
    { href: "/admin/availability", label: "Disponibilidad" },
    { href: "/admin/stats", label: "Rendimiento" },
    { href: "/admin/users", label: "Usuarios" },
    { href: "/admin/services", label: terms.item.plural },
    { href: "/admin/settings", label: "Configuración" },
    ...(ownStaffProfile ? [{ href: "/staff", label: "Mi agenda" }] : []),
  ];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-stone px-4 py-5">
        <Link href="/admin" className="font-serif text-xl">
          {business.name} · Admin
        </Link>
        <nav className="micro-label flex flex-1 gap-6">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-carbon">
              {l.label}
            </Link>
          ))}
        </nav>
        {/* La web de clientes no bloquea al admin: puede reservar o revisar su cuenta sin cerrar sesión. */}
        <Link href="/" className="micro-label underline decoration-1 underline-offset-4 hover:text-carbon">
          Ver como cliente
        </Link>
        <form action={logout}>
          <button className="micro-label text-ash hover:text-carbon">Salir</button>
        </form>
      </header>
      <main className="space-y-6 p-4">{children}</main>
    </div>
  );
}

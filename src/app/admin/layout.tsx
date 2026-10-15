import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { logout } from "./actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  const { business, terminology: terms } = await getCurrentTenant();

  const links = [
    { href: "/admin", label: terms.record.plural },
    { href: "/admin/availability", label: "Disponibilidad" },
    { href: "/admin/services", label: terms.item.plural },
    { href: "/admin/settings", label: "Configuración" },
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
        <form action={logout}>
          <button className="micro-label text-ash hover:text-carbon">Salir</button>
        </form>
      </header>
      <main className="space-y-6 p-4">{children}</main>
    </div>
  );
}

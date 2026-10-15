import Link from "next/link";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import type { ResolvedTenant } from "@/lib/tenant";

export async function PublicShell({ tenant, children }: { tenant: ResolvedTenant; children: ReactNode }) {
  const { business, terminology: terms } = tenant;
  const user = await getSessionUser();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1200px] flex-col px-4 sm:px-10">
      <header className="flex items-center justify-between gap-6 py-5">
        <Link href="/" className="truncate font-serif text-xl">
          {business.name}
        </Link>
        <nav className="micro-label flex items-center gap-5 sm:gap-8">
          <Link href="/catalog" className="hover:text-carbon">
            {terms.item.plural}
          </Link>
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="hover:text-carbon">
              Admin
            </Link>
          )}
          {user && (
            <Link href="/appointments" className="hover:text-carbon">
              Mis {terms.record.plural.toLowerCase()}
            </Link>
          )}
          <Link href={user ? "/account" : "/login"} className="hover:text-carbon">
            {user ? "Mi cuenta" : "Entrar"}
          </Link>
          <Link href="/new" className="underline decoration-1 underline-offset-4 hover:text-carbon">
            {terms.ctaPrimary}
          </Link>
        </nav>
      </header>
      <main className="flex-1 space-y-20 py-10 sm:space-y-24 sm:py-16">{children}</main>
      <footer className="flex flex-wrap justify-between gap-4 border-t border-stone py-14 text-[11px] text-ash">
        <span className="micro-label text-ink">{business.name}</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
}

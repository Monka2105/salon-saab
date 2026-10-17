import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { safeCallbackUrl } from "@/modules/auth/schemas";
import { LoginForms } from "./LoginForms";

export const metadata: Metadata = { title: "Entrar", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const [{ business }, params, user] = await Promise.all([getCurrentTenant(), searchParams, getSessionUser()]);
  const callbackUrl = safeCallbackUrl(params.callbackUrl);
  if (user) redirect(callbackUrl);

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-[1200px] items-center gap-16 px-4 py-20 sm:px-10 md:grid-cols-2">
      <div className="max-w-[480px]">
        <Link href="/" className="micro-label text-ash hover:text-ink">
          {business.name}
        </Link>
        <h1 className="headline mt-5">Bienvenido de vuelta.</h1>
        <p className="mt-6 text-lg leading-[1.35]">
          Entra con tu celular y te reconoceremos también cuando nos escribas por WhatsApp.
        </p>
      </div>
      <div className="bg-white p-8 sm:p-12">
        <LoginForms callbackUrl={callbackUrl} />
        <p className="mt-10 border-t border-stone pt-6 text-[15px] text-ash">
          ¿Primera vez aquí?
          <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="link-cta ml-2">
            Crear cuenta
          </Link>
        </p>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { safeCallbackUrl } from "@/modules/auth/schemas";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Crear cuenta", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const [params, user] = await Promise.all([searchParams, getSessionUser()]);
  const callbackUrl = safeCallbackUrl(params.callbackUrl, "/account");
  if (user) redirect(callbackUrl);

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-[1200px] items-center gap-16 px-4 py-20 sm:px-10 md:grid-cols-2">
      <div className="max-w-[480px]">
        <p className="micro-label text-ash">Cuenta</p>
        <h1 className="headline mt-5">Crea tu perfil.</h1>
        <p className="mt-6 text-lg leading-[1.35]">
          Solo tu nombre y tu celular. Te enviamos un código por WhatsApp y te reconoceremos también cuando nos
          escribas por ahí.
        </p>
      </div>
      <div className="bg-white p-8 sm:p-12">
        <RegisterForm callbackUrl={callbackUrl} />
        <p className="mt-10 border-t border-stone pt-6 text-[15px] text-ash">
          ¿Ya tienes cuenta?
          <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="link-cta ml-2">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}

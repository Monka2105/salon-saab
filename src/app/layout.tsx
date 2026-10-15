import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { getCurrentTenant } from "@/lib/tenant";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/500.css";
import "./globals.css";

// Todo depende de la configuración en BD, así que no se prerenderiza en build.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { business } = await getCurrentTenant();
  return {
    title: { default: business.name, template: `%s · ${business.name}` },
    description: business.tagline,
  };
}

export const viewport: Viewport = { themeColor: "#f6f3f0", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { theme, business } = await getCurrentTenant();

  // Inyección de la marca del tenant como CSS variables → clases bg-brand, text-brand, rounded-brand…
  const brandVars = {
    "--brand": theme.primary,
    "--brand-foreground": theme.primaryForeground,
    "--brand-accent": theme.accent,
    "--brand-radius": theme.radius,
  } as CSSProperties;

  return (
    <html lang={business.locale.split("-")[0]} style={brandVars}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

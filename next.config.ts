import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  // Solo afecta a `next dev`: permite abrir la app desde otros dispositivos de la red local
  // (p. ej. http://192.168.1.7:3000 en el celular). Sin esto, Next bloquea sus scripts y la página no es interactiva.
  allowedDevOrigins: ["192.168.1.*"],
};

export default nextConfig;

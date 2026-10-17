import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Datos iniciales del salón. Los usa `npm run db:seed` y también la app en su primer arranque,
// para entornos donde no se puede correr el seed contra la base (p. ej. Netlify Database,
// cuyo usuario de la CLI es de solo lectura).

const DEFAULT_SERVICES = [
  { title: "Arreglo de barba", description: "Arreglo de barba a tu gusto 💎 Precio desde $6.000.", price: 6000, durationMinutes: 25, sortOrder: 1 },
  { title: "Corte desvanecidos o modernos", description: "Corte con desvanecidos o modernos + diseño.", price: 20000, durationMinutes: 40, sortOrder: 2 },
  { title: "Corte + barba + cejas", description: "Corte de cabello con arreglo de barba más cejas. Precio desde $27.000.", price: 27000, durationMinutes: 60, sortOrder: 3 },
  { title: "Arreglo de cejas", description: "Arreglo de cejas.", price: 3000, durationMinutes: 5, sortOrder: 4 },
  { title: "Corte de pelo + arreglo de barba", description: "Corte de cabello y arreglo de barba. Precio desde $25.000.", price: 25000, durationMinutes: 60, sortOrder: 5 },
  { title: "Corte + cejas", description: "Corte de cabello más arreglo de cejas.", price: 22000, durationMinutes: 40, sortOrder: 6 },
  { title: "Corte hombre + mascarilla", description: "Corte de cabello más aplicación de mascarilla.", price: 22000, durationMinutes: 40, sortOrder: 7 },
];

const DEFAULT_STAFF = [
  { name: "Valentina", specialty: "Color" },
  { name: "Mateo", specialty: "Barbería clásica" },
  { name: "Lucía", specialty: "Corte & peinado" },
];

type Options = {
  /** true (seed): ADMIN_PASSWORD es la fuente de verdad y se re-sincroniza. false (app): solo crea si falta. */
  syncAdminPassword: boolean;
  log?: (message: string) => void;
};

/** Idempotente: admin desde ADMIN_EMAIL/ADMIN_PASSWORD, y servicios/estilistas de ejemplo si no hay ninguno. */
export async function ensureInitialData(prisma: PrismaClient, tenantId: string, { syncAdminPassword, log = () => {} }: Options) {
  // Admin inicial desde env. Nunca hay contraseñas por defecto en el código.
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 10) throw new Error("ADMIN_PASSWORD debe tener al menos 10 caracteres");
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!existing || syncAdminPassword) {
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.upsert({
        where: { email },
        create: { email, name: "Administración", role: "ADMIN", passwordHash },
        update: { role: "ADMIN", passwordHash },
      });
      log(`Admin listo: ${email}`);
    }
  } else {
    log("ADMIN_EMAIL / ADMIN_PASSWORD no definidos: no se creó el admin.");
  }

  if ((await prisma.service.count({ where: { tenantId } })) === 0) {
    await prisma.service.createMany({ data: DEFAULT_SERVICES.map((s) => ({ ...s, tenantId })) });
    log("Servicios creados.");
  }

  if ((await prisma.staffMember.count({ where: { tenantId } })) === 0) {
    await prisma.staffMember.createMany({ data: DEFAULT_STAFF.map((s) => ({ ...s, tenantId })) });
    log("Estilistas de ejemplo creados.");
  }
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { tenantConfig } from "../src/config/tenant";

try {
  process.loadEnvFile(".env");
} catch {
  // sin .env: se usan las variables del entorno
}

const prisma = new PrismaClient();

async function main() {
  const slug = process.env.TENANT_SLUG || tenantConfig.slug;
  const tenant = await prisma.tenant.upsert({ where: { slug }, create: { slug }, update: {} });

  // Admin inicial desde env. Nunca hay contraseñas por defecto en el código.
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 10) throw new Error("ADMIN_PASSWORD debe tener al menos 10 caracteres");
    // .env es la fuente de verdad: volver a correr el seed sincroniza la contraseña del admin.
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      create: { email, name: "Administración", role: "ADMIN", passwordHash },
      update: { role: "ADMIN", passwordHash },
    });
    console.log(`Admin listo: ${email}`);
  } else {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD no definidos: no se creó el admin.");
  }

  if ((await prisma.service.count({ where: { tenantId: tenant.id } })) === 0) {
    await prisma.service.createMany({
      data: [
        { title: "Arreglo de barba", description: "Arreglo de barba a tu gusto 💎 Precio desde $6.000.", price: 6000, durationMinutes: 25, sortOrder: 1 },
        { title: "Corte desvanecidos o modernos", description: "Corte con desvanecidos o modernos + diseño.", price: 20000, durationMinutes: 40, sortOrder: 2 },
        { title: "Corte + barba + cejas", description: "Corte de cabello con arreglo de barba más cejas. Precio desde $27.000.", price: 27000, durationMinutes: 60, sortOrder: 3 },
        { title: "Arreglo de cejas", description: "Arreglo de cejas.", price: 3000, durationMinutes: 5, sortOrder: 4 },
        { title: "Corte de pelo + arreglo de barba", description: "Corte de cabello y arreglo de barba. Precio desde $25.000.", price: 25000, durationMinutes: 60, sortOrder: 5 },
        { title: "Corte + cejas", description: "Corte de cabello más arreglo de cejas.", price: 22000, durationMinutes: 40, sortOrder: 6 },
        { title: "Corte hombre + mascarilla", description: "Corte de cabello más aplicación de mascarilla.", price: 22000, durationMinutes: 40, sortOrder: 7 },
      ].map((s) => ({ ...s, tenantId: tenant.id })),
    });
    console.log("Servicios creados.");
  }

  if ((await prisma.staffMember.count({ where: { tenantId: tenant.id } })) === 0) {
    await prisma.staffMember.createMany({
      data: [
        { name: "Valentina", specialty: "Color" },
        { name: "Mateo", specialty: "Barbería clásica" },
        { name: "Lucía", specialty: "Corte & peinado" },
      ].map((s) => ({ ...s, tenantId: tenant.id })),
    });
    console.log("Estilistas de ejemplo creados.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

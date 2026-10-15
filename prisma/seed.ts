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
        { title: "Corte de autor", description: "Diagnóstico, lavado ritual y corte a tijera con acabado.", price: 65000, durationMinutes: 60, sortOrder: 1 },
        { title: "Ritual de barba", description: "Toalla caliente, perfilado a navaja y aceites botánicos.", price: 40000, durationMinutes: 45, sortOrder: 2 },
        { title: "Color & brillo", description: "Coloración a medida con gloss final.", price: 120000, durationMinutes: 120, sortOrder: 3 },
        { title: "Corte + barba", description: "El servicio completo, sin prisas.", price: 95000, durationMinutes: 90, sortOrder: 4 },
        { title: "Peinado de evento", description: "Ondas, recogidos o acabado pulido.", price: 55000, durationMinutes: 60, sortOrder: 5 },
        { title: "Tratamiento capilar", description: "Hidratación profunda y masaje de cuero cabelludo.", price: 45000, durationMinutes: 45, sortOrder: 6 },
      ].map((s) => ({ ...s, tenantId: tenant.id })),
    });
    console.log("Servicios de ejemplo creados.");
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

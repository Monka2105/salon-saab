import { PrismaClient } from "@prisma/client";
import { tenantConfig } from "../src/config/tenant";
import { ensureInitialData } from "../src/modules/setup/initial-data";

try {
  process.loadEnvFile(".env");
} catch {
  // sin .env: se usan las variables del entorno
}

const prisma = new PrismaClient();

async function main() {
  const slug = process.env.TENANT_SLUG || tenantConfig.slug;
  const tenant = await prisma.tenant.upsert({ where: { slug }, create: { slug }, update: {} });

  // .env es la fuente de verdad: volver a correr el seed sincroniza la contraseña del admin.
  await ensureInitialData(prisma, tenant.id, { syncAdminPassword: true, log: console.log });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

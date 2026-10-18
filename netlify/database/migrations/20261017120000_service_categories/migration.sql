-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Service" ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_tenantId_name_key" ON "ServiceCategory"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Datos: categorías iniciales para los salones que ya tienen servicios, y cada servicio en la
-- primera que aparezca en su nombre (antes eran los filtros por palabra del inicio).
-- Los ids imitan un cuid ("c" + 32 caracteres sin guiones) para pasar la validación de la app.
INSERT INTO "ServiceCategory" ("id", "tenantId", "name", "sortOrder", "updatedAt")
SELECT 'c' || replace(gen_random_uuid()::text, '-', ''), t."id", c."name", c."sortOrder", CURRENT_TIMESTAMP
FROM "Tenant" t
CROSS JOIN (VALUES ('Corte', 1), ('Barba', 2), ('Cejas', 3)) AS c("name", "sortOrder")
WHERE EXISTS (SELECT 1 FROM "Service" s WHERE s."tenantId" = t."id");

UPDATE "Service" s
SET "categoryId" = (
    SELECT c."id" FROM "ServiceCategory" c
    WHERE c."tenantId" = s."tenantId" AND s."title" ILIKE '%' || c."name" || '%'
    ORDER BY c."sortOrder"
    LIMIT 1
);

-- Renombra date/endDate → startTime/endTime conservando las citas existentes.
-- Ejecutar UNA vez, antes de `npm run db:push`, solo si la base ya tenía la tabla Appointment:
--   npx prisma db execute --file prisma/sql/rename-appointment-times.sql --schema prisma/schema.prisma
ALTER TABLE "Appointment" RENAME COLUMN "date" TO "startTime";
ALTER TABLE "Appointment" RENAME COLUMN "endDate" TO "endTime";

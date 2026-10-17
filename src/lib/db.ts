import { PrismaClient } from "@prisma/client";

// Singleton para evitar múltiples conexiones con el hot-reload de Next.js.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// En Netlify, Netlify Database inyecta NETLIFY_DB_URL (también en las ramas de deploy preview);
// tiene prioridad sobre un DATABASE_URL local (localhost) que se haya copiado por error.
const datasourceUrl = process.env.NETLIFY_DB_URL || process.env.DATABASE_URL;

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

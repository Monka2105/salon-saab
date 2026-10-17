// Aplica las migraciones de Prisma y el seed (idempotente) a Netlify Database.
// Uso: npm run db:netlify [-- <rama>]   (por defecto: production)
// Requiere `npx netlify login` y `npx netlify link`. Nunca imprime la URL de conexión.
import { execSync } from "node:child_process";

const branch = process.argv[2] || "production";

const status = JSON.parse(
  execSync(`npx netlify db status --branch ${branch} --show-credentials --json`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
const url = JSON.stringify(status).match(/postgres(?:ql)?:\/\/[^"\\]+/)?.[0];
if (!url) {
  console.error(`No se encontró la URL de Netlify Database para la rama "${branch}".`);
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: url };
console.log(`Netlify Database (${branch}) → ${new URL(url).hostname}`);
execSync("npx prisma migrate deploy", { stdio: "inherit", env });
execSync("npm run db:seed", { stdio: "inherit", env });

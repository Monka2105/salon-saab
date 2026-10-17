// Ejecuta el seed (idempotente) contra Netlify Database. El esquema lo aplica Netlify en cada deploy.
// Uso: npm run db:seed:netlify [-- <rama>]   (por defecto: production)
// Requiere `npx netlify login` y `npx netlify link`. Nunca imprime la URL de conexión.
import { execSync } from "node:child_process";

const branch = process.argv[2] || "production";

const status = JSON.parse(
  execSync(`npx netlify db status --branch ${branch} --show-credentials --json`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
const url = status.database?.connectionString;
if (!url) {
  console.error(`No se encontró la URL de Netlify Database para la rama "${branch}".`);
  process.exit(1);
}

console.log(`Netlify Database (${branch}) → ${new URL(url).hostname}`);
execSync("npm run db:seed", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });

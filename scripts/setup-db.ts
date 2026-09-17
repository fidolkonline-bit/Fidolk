import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { initializeDatabase, getPool } from "../lib/store";
async function main() {
  await initializeDatabase();
  console.log(
    "Database initialized with an empty workspace. Demo transactions were not imported.",
  );
  await getPool().end();
}
main().catch(() => {
  console.error("Database setup failed. Check DATABASE_URL and permissions.");
  process.exitCode = 1;
});

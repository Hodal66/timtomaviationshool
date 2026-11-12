import { execSync } from "node:child_process";

/**
 * Rebuilds the QA database from the committed migrations and seed.
 * Refuses to run against anything that is not named like a test database, so production data can never be touched.
 */
export default function setup() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/(\/tas_qa|_test|_qa)(\?|$)/.test(url)) throw new Error("Refusing to reset a database that is not named like a test database: " + url.replace(/:\/\/.*@/, "://***@"));
  const env = { ...process.env, ADMIN_EMAIL: "admin@test.local", ADMIN_PASSWORD: "localtest-123" };
  execSync(`psql "${url.split("?")[0]}" -q -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"`, { stdio: "ignore", env });
  execSync("npx prisma migrate deploy", { stdio: "ignore", env });
  execSync("npx prisma db seed", { stdio: "ignore", env });
}

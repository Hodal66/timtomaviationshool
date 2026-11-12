// Boots the QA environment: fresh test database, fake SMTP server, production build, production server.
import { execSync, spawn } from "node:child_process";
import { startSmtpSink } from "./smtp-sink.mjs";

const url = process.env.DATABASE_URL ?? "";
if (!/(\/tas_qa|_test|_qa)(\?|$)/.test(url)) { console.error("Refusing to run against a database not named like a test database."); process.exit(1); }
const env = { ...process.env, RATE_LIMIT_SCALE: "50", AUTH_SECRET: process.env.AUTH_SECRET ?? "qa-only-secret-not-for-production-0123456789abcdef", DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED ?? url, ADMIN_EMAIL: "admin@test.local", ADMIN_PASSWORD: "localtest-123", SMTP_HOST: "127.0.0.1", SMTP_PORT: "2526", SMTP_SECURE: "false", SMTP_PASS: "qa-test", NEXT_PUBLIC_SITE_URL: `http://localhost:${process.env.QA_PORT ?? 3100}` };
execSync(`psql "${url.split("?")[0]}" -q -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"`, { stdio: "inherit", env });
execSync("npx prisma migrate deploy", { stdio: "ignore", env });
execSync("npx prisma db seed", { stdio: "ignore", env });
import("node:fs").then((f) => f.rmSync("tests/.tmp/state.json", { force: true }));
startSmtpSink(2526, "tests/.tmp/mail.jsonl");
execSync("npx next build", { stdio: "ignore", env });
const srv = spawn("npx", ["next", "start", "-p", String(process.env.QA_PORT ?? 3100)], { stdio: "inherit", env });
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { srv.kill(); process.exit(0); });

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const errors: string[] = [];
const required = (name: string, minimum = 1) => {
  const value = process.env[name] ?? "";
  if (value.length < minimum)
    errors.push(
      minimum === 1
        ? `${name} is required.`
        : `${name} must contain at least ${minimum} characters.`,
    );
  return value;
};
const base64Bytes = (name: string, bytes: number) => {
  const value = required(name);
  if (value && Buffer.from(value, "base64").length !== bytes)
    errors.push(`${name} must be a base64-encoded ${bytes}-byte value.`);
};

const database = required("DATABASE_URL");
if (database) {
  try {
    const url = new URL(database);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:")
      errors.push("DATABASE_URL must use PostgreSQL.");
    if (!/sslmode=verify-full/.test(url.search))
      errors.push("DATABASE_URL must use sslmode=verify-full.");
  } catch {
    errors.push("DATABASE_URL is not a valid URL.");
  }
}
required("APP_ACCESS_KEY", 32);
required("CRON_SECRET", 32);
base64Bytes("APP_ENCRYPTION_KEY", 32);
base64Bytes("BACKUP_ENCRYPTION_KEY", 32);
const vapidPublic = required("VAPID_PUBLIC_KEY");
const vapidPrivate = required("VAPID_PRIVATE_KEY");
const vapidSubject = required("VAPID_SUBJECT");
if (vapidPublic && Buffer.from(vapidPublic, "base64url").length !== 65)
  errors.push("VAPID_PUBLIC_KEY is invalid.");
if (vapidPrivate && Buffer.from(vapidPrivate, "base64url").length !== 32)
  errors.push("VAPID_PRIVATE_KEY is invalid.");
if (vapidSubject && !/^(mailto:|https:)/.test(vapidSubject))
  errors.push("VAPID_SUBJECT must start with mailto: or https:.");

if (errors.length) {
  console.error("Production configuration is incomplete:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Production configuration is valid.");
}

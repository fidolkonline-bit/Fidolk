import { spawnSync } from "node:child_process";
import { loadEnvConfig } from "@next/env";
import { createCipheriv, randomBytes } from "node:crypto";
import {
  mkdirSync,
  chmodSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY ?? "", "base64");
if (key.length !== 32)
  throw new Error(
    "BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key. Store it separately from backups.",
  );
const dir = path.resolve(process.env.BACKUP_DIR ?? "backups");
mkdirSync(dir, { recursive: true, mode: 0o700 });
const work = mkdtempSync(path.join(tmpdir(), "fido-backup-"));
chmodSync(work, 0o700);
try {
  const raw = path.join(work, "database.dump");
  const result = spawnSync("pg_dump", ["--format=custom", "--file", raw], {
    env: { ...process.env, PGDATABASE: process.env.DATABASE_URL },
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0)
    throw new Error(
      "Backup failed. Check pg_dump installation/version, connectivity and permissions.",
    );
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const data = Buffer.concat([
    cipher.update(readFileSync(raw)),
    cipher.final(),
  ]);
  const target = path.join(
    dir,
    `fido-${new Date().toISOString().replace(/[:.]/g, "-")}.dump.enc`,
  );
  writeFileSync(
    target,
    Buffer.concat([Buffer.from("FIDO1"), nonce, cipher.getAuthTag(), data]),
    { mode: 0o600 },
  );
  console.log(`Encrypted backup written to ${target}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

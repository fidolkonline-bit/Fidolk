import { createDecipheriv } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { readFileSync, writeFileSync } from "node:fs";
loadEnvConfig(process.cwd());
const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw new Error(
    "Usage: tsx scripts/decrypt-backup.ts input.dump.enc output.dump",
  );
const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY ?? "", "base64");
if (key.length !== 32)
  throw new Error("A valid BACKUP_ENCRYPTION_KEY is required.");
const data = readFileSync(source);
if (data.subarray(0, 5).toString() !== "FIDO1")
  throw new Error("Unsupported backup format.");
const decipher = createDecipheriv("aes-256-gcm", key, data.subarray(5, 17));
decipher.setAuthTag(data.subarray(17, 33));
const plain = Buffer.concat([
  decipher.update(data.subarray(33)),
  decipher.final(),
]);
writeFileSync(destination, plain, { mode: 0o600, flag: "wx" });
console.log(
  "Backup decrypted to the requested new file. Restore only into an isolated recovery database first.",
);

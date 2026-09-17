import { loadEnvConfig } from "@next/env";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { applyAction } from "../lib/business";
import { parseCsv } from "../lib/csv";
import { mutateWorkspace, readWorkspace } from "../lib/store";
import type { Action, AuthUser } from "../lib/types";

loadEnvConfig(process.cwd());

const actor: AuthUser = {
  id: "migration",
  name: "Legacy product migration",
  username: "migration",
  role: "System",
  permissions: ["*"],
  active: true,
};

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const source = args.find((arg) => !arg.startsWith("--"));
  if (!source)
    throw new Error(
      "Usage: npm run import:legacy-products -- /path/products.csv [--commit]",
    );
  const rows = parseCsv(await readFile(resolve(source), "utf8"));
  const action: Action = {
    type: "importCsv",
    payload: { kind: "legacyProducts", rows },
    requestId: randomUUID(),
  };
  const current = await readWorkspace(actor);
  const before = {
    products: current.data.products.length,
    stock: current.data.products.reduce(
      (sum, product) => sum + product.stock,
      0,
    ),
  };
  const next = commit
    ? (await mutateWorkspace(action, actor)).data
    : applyAction(structuredClone(current.data), action, undefined, actor);
  const after = {
    products: next.products.length,
    stock: next.products.reduce((sum, product) => sum + product.stock, 0),
  };
  console.log({
    mode: commit ? "committed" : "dry-run",
    sourceRows: rows.length,
    importedProducts: after.products - before.products,
    openingStockUnits: after.stock - before.stock,
    before,
    after,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Import failed.");
  process.exitCode = 1;
});

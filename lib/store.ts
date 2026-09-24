import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { applyAction, BusinessError } from "./business";
import { getPricing } from "./pricing";
import { createSeed, createEmptyWorkspace } from "./seed";
import type { Action, AuthUser, Workspace, WorkspaceResponse } from "./types";
interface Stored {
  version: number;
  data: Workspace;
  requests: Record<string, string>;
}
const root = process.env.FIDO_DATA_DIR ?? path.join(process.cwd(), ".data");
const file = path.join(root, "demo.json");
const globalState = globalThis as unknown as {
  fidoPool?: Pool;
  fidoQueue?: Promise<unknown>;
  fidoInitialized?: Promise<void>;
};
export const mode = () =>
  process.env.DATABASE_URL || process.env.NODE_ENV === "production"
    ? ("database" as const)
    : ("demo" as const);
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const configuredMax = Number(process.env.DATABASE_POOL_MAX ?? 5);
  const max = Number.isInteger(configuredMax)
    ? Math.min(20, Math.max(1, configuredMax))
    : 5;
  if (globalState.fidoPool) return globalState.fidoPool;
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max,
    application_name: "fido-lk",
    connectionTimeoutMillis: 15000,
    idleTimeoutMillis: 30000,
    query_timeout: 15000,
  });
  pool.on("error", (error) => {
    console.error("Unexpected idle PostgreSQL client error", error.message);
  });
  globalState.fidoPool = pool;
  return pool;
}
export async function initializeDatabase() {
  if (!globalState.fidoInitialized)
    globalState.fidoInitialized = (async () => {
      try {
        const db = getPool();
        const client = await db.connect();
        try {
          await client.query("BEGIN");
          await client.query("SELECT pg_advisory_xact_lock($1)", [73190420]);
          await client.query(
            `CREATE TABLE IF NOT EXISTS fido_workspace (id text PRIMARY KEY CHECK (id = 'main'), version bigint NOT NULL DEFAULT 0, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
           CREATE TABLE IF NOT EXISTS fido_requests (id uuid PRIMARY KEY, payload_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
           CREATE TABLE IF NOT EXISTS fido_users (id uuid PRIMARY KEY, name text NOT NULL, username text NOT NULL UNIQUE, password_hash text NOT NULL, password_salt text NOT NULL, role text NOT NULL, permissions jsonb NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
           CREATE TABLE IF NOT EXISTS fido_sessions (token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES fido_users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
           CREATE INDEX IF NOT EXISTS fido_sessions_user_id_idx ON fido_sessions(user_id);
           CREATE INDEX IF NOT EXISTS fido_sessions_expires_at_idx ON fido_sessions(expires_at);
           CREATE INDEX IF NOT EXISTS fido_requests_created_at_idx ON fido_requests(created_at);
           CREATE TABLE IF NOT EXISTS fido_login_attempts (username text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, locked_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now());
           CREATE TABLE IF NOT EXISTS fido_auth_events (id bigserial PRIMARY KEY, occurred_at timestamptz NOT NULL DEFAULT now(), event text NOT NULL, success boolean NOT NULL, user_id text, username text, actor_id text, client_id text);
           CREATE INDEX IF NOT EXISTS fido_auth_events_occurred_at_idx ON fido_auth_events(occurred_at DESC);`,
          );
          await client.query(
            "ALTER TABLE fido_users ADD COLUMN IF NOT EXISTS staff_id text",
          );
          await client.query(
            "CREATE UNIQUE INDEX IF NOT EXISTS fido_users_staff_id_uidx ON fido_users(staff_id) WHERE staff_id IS NOT NULL",
          );
          await client.query(
            "INSERT INTO fido_workspace (id,data) VALUES ($1,$2::jsonb) ON CONFLICT (id) DO NOTHING",
            ["main", JSON.stringify(createEmptyWorkspace())],
          );
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        globalState.fidoInitialized = undefined;
        throw error;
      }
    })();
  return globalState.fidoInitialized;
}
async function readFile(): Promise<Stored> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as Stored;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    return { version: 0, data: createSeed(), requests: {} };
  }
}
async function writeFile(state: Stored) {
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state), { mode: 0o600 });
  await fs.rename(tmp, file);
}
async function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const previous = globalState.fidoQueue ?? Promise.resolve();
  const current = previous.then(fn, fn);
  globalState.fidoQueue = current.catch(() => {});
  return current;
}
export async function readWorkspace(
  user?: AuthUser,
): Promise<WorkspaceResponse> {
  if (mode() === "database") {
    await initializeDatabase();
    const r = await getPool().query(
      "SELECT data FROM fido_workspace WHERE id=$1",
      ["main"],
    );
    return {
      data: normalizeWorkspace(r.rows[0].data as Workspace),
      mode: "database",
      user: user ?? demoUser,
    };
  }
  return serialized(async () => {
    const state = await readFile();
    await writeFile(state);
    return {
      data: normalizeWorkspace(state.data),
      mode: "demo",
      user: user ?? demoUser,
    };
  });
}
export async function mutateWorkspace(
  action: Action,
  user?: AuthUser,
): Promise<WorkspaceResponse> {
  const hash = createHash("sha256")
    .update(JSON.stringify({ type: action.type, payload: action.payload }))
    .digest("hex");
  if (mode() === "database") {
    await initializeDatabase();
    const db = await getPool().connect();
    try {
      await db.query("BEGIN");
      const locked = await db.query(
        "SELECT data FROM fido_workspace WHERE id=$1 FOR UPDATE",
        ["main"],
      );
      const prior = await db.query(
        "SELECT payload_hash FROM fido_requests WHERE id=$1",
        [action.requestId],
      );
      if (prior.rowCount) {
        if (prior.rows[0].payload_hash !== hash)
          throw new BusinessError(
            "This request ID was already used for another operation.",
          );
        await db.query("COMMIT");
        return {
          data: normalizeWorkspace(locked.rows[0].data),
          mode: "database",
          user: user ?? demoUser,
        };
      }
      const data = applyAction(
        normalizeWorkspace(locked.rows[0].data as Workspace),
        action,
        undefined,
        user,
      );
      await db.query(
        "UPDATE fido_workspace SET data=$1::jsonb,version=version+1,updated_at=now() WHERE id=$2",
        [JSON.stringify(data), "main"],
      );
      await db.query(
        "INSERT INTO fido_requests(id,payload_hash) VALUES($1,$2)",
        [action.requestId, hash],
      );
      await db.query("COMMIT");
      return { data, mode: "database", user: user ?? demoUser };
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    } finally {
      db.release();
    }
  }
  return serialized(async () => {
    const state = await readFile();
    if (state.requests[action.requestId]) {
      if (state.requests[action.requestId] !== hash)
        throw new BusinessError(
          "This request ID was already used for another operation.",
        );
      return {
        data: normalizeWorkspace(state.data),
        mode: "demo",
        user: user ?? demoUser,
      };
    }
    const next = applyAction(
      normalizeWorkspace(structuredClone(state.data)),
      action,
      undefined,
      user,
    );
    state.data = next;
    state.requests[action.requestId] = hash;
    state.version++;
    await writeFile(state);
    return { data: next, mode: "demo", user: user ?? demoUser };
  });
}

const demoUser: AuthUser = {
  id: "demo-owner",
  name: "Fido LK Owner",
  username: "owner",
  role: "Owner",
  permissions: ["*"],
  active: true,
};

export function normalizeWorkspace(value: Workspace): Workspace {
  const empty = createEmptyWorkspace();
  return {
    ...empty,
    ...value,
    products: (value.products ?? []).map((product) => ({
      ...product,
      active: product.active !== false,
      pricing: getPricing(product),
    })),
    batches: (value.batches ?? []).map((batch) => ({
      ...batch,
      pricing: batch.pricing ?? {
        Retail:
          value.products.find((product) => product.id === batch.productId)
            ?.price ?? 0,
      },
    })),
    suppliers: value.suppliers ?? [],
    purchaseOrders: value.purchaseOrders ?? [],
    supplierReturns: value.supplierReturns ?? [],
    agents: value.agents ?? [],
    commissionSettlements: value.commissionSettlements ?? [],
    returns: value.returns ?? [],
    codSettlements: value.codSettlements ?? [],
    alerts: value.alerts ?? [],
    inventoryMovements: value.inventoryMovements ?? [],
    inventoryCounts: value.inventoryCounts ?? [],
    parkedCarts: value.parkedCarts ?? [],
    saleQuotes: value.saleQuotes ?? [],
    pushSubscriptions: value.pushSubscriptions ?? [],
    settings: {
      ...empty.settings,
      ...value.settings,
      ai: {
        ...empty.settings.ai,
        ...(value.settings?.ai ?? {}),
        features: {
          ...empty.settings.ai.features,
          ...(value.settings?.ai?.features ?? {}),
        },
      },
      providerRules:
        value.settings?.providerRules ?? empty.settings.providerRules,
    },
  };
}

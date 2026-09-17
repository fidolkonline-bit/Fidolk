import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest, NextResponse } from "next/server";
import { getPool, initializeDatabase, mode } from "./store";
import type { AuthUser, Permission } from "./types";

const derive = promisify(scrypt);
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-fido_session"
    : "fido_session";
const SESSION_HOURS = 12;
const MAX_FAILURES = 5;
const MAX_IP_FAILURES = 20;
const LOCK_MINUTES = 15;
const allowedPermissions = new Set<Permission>([
  "*",
  "dashboard.view",
  "sales.view",
  "sales.manage",
  "sales.priceTier",
  "sales.discount",
  "sales.priceOverride",
  "inventory.view",
  "inventory.manage",
  "repairs.view",
  "repairs.manage",
  "repairs.credentials",
  "customers.view",
  "customers.manage",
  "purchasing.view",
  "purchasing.manage",
  "expenses.view",
  "expenses.manage",
  "cod.view",
  "cod.manage",
  "reloads.view",
  "reloads.manage",
  "payroll.view",
  "payroll.manage",
  "reports.view",
  "settings.manage",
  "users.manage",
  "alerts.view",
  "alerts.manage",
]);

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

const normalizeUsername = (value: unknown) => {
  if (typeof value !== "string")
    throw new AuthError("Enter a valid username.", 400);
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username))
    throw new AuthError(
      "Username must be 3–40 letters, numbers, dots, dashes or underscores.",
      400,
    );
  return username;
};

const validatePassword = (value: unknown) => {
  if (
    typeof value !== "string" ||
    value.length < 12 ||
    value.length > 128 ||
    !/[a-z]/.test(value) ||
    !/[A-Z]/.test(value) ||
    !/[0-9]/.test(value) ||
    !/[^A-Za-z0-9]/.test(value)
  )
    throw new AuthError(
      "Use at least 12 characters with upper and lower case, a number and a symbol.",
      400,
    );
  return value;
};

async function passwordDigest(password: string, salt: string) {
  const value = (await derive(password, salt, 64)) as Buffer;
  return value.toString("base64");
}

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

function permissionsFor(input: unknown, actor: AuthUser) {
  if (!Array.isArray(input))
    throw new AuthError("Choose valid permissions.", 400);
  const permissions = [...new Set(input)] as unknown[];
  if (
    permissions.some(
      (permission) =>
        typeof permission !== "string" ||
        !allowedPermissions.has(permission as Permission),
    )
  )
    throw new AuthError("One or more permissions are invalid.", 400);
  const result = permissions as Permission[];
  if (
    !actor.permissions.includes("*") &&
    result.some((permission) => !actor.permissions.includes(permission))
  )
    throw new AuthError(
      "You cannot grant access that your own account does not have.",
      403,
    );
  return result;
}

const toUser = (row: Record<string, unknown>): AuthUser => ({
  id: String(row.id),
  name: String(row.name),
  username: String(row.username),
  role: String(row.role),
  permissions: row.permissions as Permission[],
  active: Boolean(row.active),
  staffId: row.staff_id ? String(row.staff_id) : undefined,
});

function issueCookie(res: NextResponse, token: string, expires: Date) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await getPool().query(
    "INSERT INTO fido_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)",
    [tokenHash, userId, expires],
  );
  return { token, expires };
}

export async function authStatus(req: NextRequest) {
  if (mode() === "demo")
    return {
      authenticated: true,
      needsBootstrap: false,
      bootstrapRequired: false,
      user: demoUser,
    };
  await initializeDatabase();
  const count = await getPool().query(
    "SELECT count(*)::int AS count FROM fido_users",
  );
  const user = await authenticateRequest(req, false);
  return {
    authenticated: Boolean(user),
    needsBootstrap: count.rows[0].count === 0,
    bootstrapRequired: count.rows[0].count === 0,
    user,
  };
}

export async function authenticateRequest(
  req: NextRequest,
  required = true,
): Promise<AuthUser | null> {
  if (mode() === "demo") return demoUser;
  await initializeDatabase();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (required) throw new AuthError("Sign in to continue.");
    return null;
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const result = await getPool().query(
    `SELECT u.id,u.name,u.username,u.role,u.permissions,u.active,u.staff_id
       FROM fido_sessions s JOIN fido_users u ON u.id=s.user_id
      WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true`,
    [tokenHash],
  );
  if (!result.rowCount) {
    if (required) throw new AuthError("Your session expired. Sign in again.");
    return null;
  }
  return toUser(result.rows[0]);
}

export async function bootstrapOwner(
  input: Record<string, unknown>,
  res: NextResponse,
) {
  await initializeDatabase();
  const expected = process.env.APP_ACCESS_KEY ?? "";
  const supplied =
    typeof input.accessKey === "string"
      ? input.accessKey
      : typeof input.setupKey === "string"
        ? input.setupKey
        : "";
  if (!expected || !safeEqual(expected, supplied))
    throw new AuthError("The setup access key is incorrect.", 403);
  const username = normalizeUsername(input.username);
  const password = validatePassword(input.password);
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 100)
    throw new AuthError("Enter the owner name.", 400);
  const salt = randomBytes(16).toString("base64");
  const id = randomUUID();
  const db = await getPool().connect();
  let session: Awaited<ReturnType<typeof createSession>>;
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock($1)", [73190421]);
    const existing = await db.query(
      "SELECT count(*)::int AS count FROM fido_users",
    );
    if (existing.rows[0].count)
      throw new AuthError("The owner account has already been created.", 409);
    await db.query(
      "INSERT INTO fido_users(id,name,username,password_hash,password_salt,role,permissions) VALUES($1,$2,$3,$4,$5,'Owner',$6::jsonb)",
      [
        id,
        name,
        username,
        await passwordDigest(password, salt),
        salt,
        JSON.stringify(["*"]),
      ],
    );
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
    await db.query(
      "INSERT INTO fido_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)",
      [tokenHash, id, expires],
    );
    session = { token, expires };
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
  issueCookie(res, session.token, session.expires);
  return {
    id,
    name,
    username,
    role: "Owner",
    permissions: ["*"] as Permission[],
    active: true,
  };
}

export async function login(
  input: Record<string, unknown>,
  res: NextResponse,
  clientId = "unknown",
) {
  await initializeDatabase();
  const username = normalizeUsername(input.username);
  const password = typeof input.password === "string" ? input.password : "";
  const userKey = `user:${username}`;
  const ipKey = `ip:${clientId}`;
  const attempts = await getPool().query(
    "SELECT username,attempts,locked_until FROM fido_login_attempts WHERE username=ANY($1::text[])",
    [[userKey, ipKey]],
  );
  if (
    attempts.rows.some(
      (row) => row.locked_until && new Date(row.locked_until) > new Date(),
    )
  )
    throw new AuthError("Too many attempts. Try again in 15 minutes.", 429);
  const result = await getPool().query(
    "SELECT * FROM fido_users WHERE username=$1 AND active=true",
    [username],
  );
  let valid = false;
  if (result.rowCount) {
    const digest = await passwordDigest(password, result.rows[0].password_salt);
    valid = safeEqual(result.rows[0].password_hash, digest);
  } else {
    await passwordDigest(
      password || "invalid",
      randomBytes(16).toString("base64"),
    );
  }
  if (!valid) {
    for (const [key, limit] of [
      [userKey, MAX_FAILURES],
      [ipKey, MAX_IP_FAILURES],
    ] as const)
      await getPool().query(
        `INSERT INTO fido_login_attempts(username,attempts,locked_until) VALUES($1,1,NULL)
         ON CONFLICT(username) DO UPDATE SET attempts=fido_login_attempts.attempts+1,
         locked_until=CASE WHEN fido_login_attempts.attempts+1 >= $2 THEN now()+($3 || ' minutes')::interval ELSE NULL END,updated_at=now()`,
        [key, limit, String(LOCK_MINUTES)],
      );
    throw new AuthError("Username or password is incorrect.");
  }
  await getPool().query(
    "DELETE FROM fido_login_attempts WHERE username=ANY($1::text[])",
    [[userKey, ipKey]],
  );
  const user = toUser(result.rows[0]);
  const session = await createSession(user.id);
  issueCookie(res, session.token, session.expires);
  return user;
}

export async function logout(req: NextRequest, res: NextResponse) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && mode() === "database")
    await getPool().query("DELETE FROM fido_sessions WHERE token_hash=$1", [
      createHash("sha256").update(token).digest("hex"),
    ]);
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function listUsers() {
  const result = await getPool().query(
    "SELECT id,name,username,role,permissions,active,staff_id FROM fido_users ORDER BY created_at",
  );
  return result.rows.map(toUser);
}

export async function createUser(
  input: Record<string, unknown>,
  actor: AuthUser,
) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 100)
    throw new AuthError("Enter the staff name.", 400);
  const username = normalizeUsername(input.username);
  const password = validatePassword(input.password);
  const role =
    typeof input.role === "string" && input.role.trim()
      ? input.role.trim().slice(0, 60)
      : "Staff";
  const permissions = permissionsFor(input.permissions, actor);
  if (role === "Owner" && !permissions.includes("*"))
    throw new AuthError("Owner accounts require full owner access.", 400);
  const salt = randomBytes(16).toString("base64");
  try {
    await getPool().query(
      "INSERT INTO fido_users(id,name,username,password_hash,password_salt,role,permissions,staff_id) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8)",
      [
        randomUUID(),
        name,
        username,
        await passwordDigest(password, salt),
        salt,
        role,
        JSON.stringify(permissions),
        typeof input.staffId === "string" && input.staffId
          ? input.staffId
          : null,
      ],
    );
  } catch (error) {
    if ((error as { code?: string; constraint?: string }).code === "23505")
      throw new AuthError(
        (error as { constraint?: string }).constraint?.includes("staff_id")
          ? "That staff record is already linked to another account."
          : "That username is already in use.",
        409,
      );
    throw error;
  }
}

export async function updateUser(
  input: Record<string, unknown>,
  actor: AuthUser,
) {
  const id = typeof input.id === "string" ? input.id : "";
  if (!id) throw new AuthError("User not found.", 404);
  if (id === actor.id && input.active === false)
    throw new AuthError("You cannot deactivate your own account.", 422);
  const permissions = permissionsFor(input.permissions, actor);
  const role =
    typeof input.role === "string" && input.role.trim()
      ? input.role.trim().slice(0, 60)
      : "Staff";
  const name =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim().slice(0, 100)
      : null;
  const newPassword =
    typeof input.password === "string" && input.password
      ? validatePassword(input.password)
      : null;
  const salt = newPassword ? randomBytes(16).toString("base64") : null;
  if (role === "Owner" && !permissions.includes("*"))
    throw new AuthError("Owner accounts require full owner access.", 400);
  const db = await getPool().connect();
  try {
    await db.query("BEGIN");
    const current = await db.query(
      "SELECT permissions,active FROM fido_users WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!current.rowCount) throw new AuthError("User not found.", 404);
    const targetIsOwner = (
      current.rows[0].permissions as Permission[]
    ).includes("*");
    if (targetIsOwner && !actor.permissions.includes("*"))
      throw new AuthError("Only an owner can modify another owner.", 403);
    if (
      targetIsOwner &&
      (input.active === false || !permissions.includes("*"))
    ) {
      const owners = await db.query(
        "SELECT count(*)::int AS count FROM fido_users WHERE active=true AND permissions ? '*'",
      );
      if (owners.rows[0].count <= 1)
        throw new AuthError("The last active owner cannot be removed.", 422);
    }
    await db.query(
      `UPDATE fido_users SET name=COALESCE($2,name),role=$3,permissions=$4::jsonb,active=$5,
         password_hash=COALESCE($6,password_hash),password_salt=COALESCE($7,password_salt),staff_id=$8,updated_at=now() WHERE id=$1`,
      [
        id,
        name,
        role,
        JSON.stringify(permissions),
        input.active !== false,
        newPassword ? await passwordDigest(newPassword, salt!) : null,
        salt,
        typeof input.staffId === "string" && input.staffId
          ? input.staffId
          : null,
      ],
    );
    await db.query("DELETE FROM fido_sessions WHERE user_id=$1", [id]);
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    if ((error as { code?: string; constraint?: string }).code === "23505")
      throw new AuthError(
        (error as { constraint?: string }).constraint?.includes("staff_id")
          ? "That staff record is already linked to another account."
          : "That account change conflicts with an existing user.",
        409,
      );
    throw error;
  } finally {
    db.release();
  }
}

export async function changePassword(
  req: NextRequest,
  user: AuthUser,
  input: Record<string, unknown>,
) {
  const currentPassword =
    typeof input.currentPassword === "string" ? input.currentPassword : "";
  const newPassword = validatePassword(input.newPassword);
  if (safeEqual(currentPassword, newPassword))
    throw new AuthError("Choose a different password.", 422);
  const record = await getPool().query(
    "SELECT password_hash,password_salt FROM fido_users WHERE id=$1 AND active=true",
    [user.id],
  );
  if (!record.rowCount)
    throw new AuthError("Your account is no longer active.", 401);
  const digest = await passwordDigest(
    currentPassword,
    record.rows[0].password_salt,
  );
  if (!safeEqual(record.rows[0].password_hash, digest))
    throw new AuthError("The current password is incorrect.", 403);
  const salt = randomBytes(16).toString("base64");
  const currentToken = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  const currentTokenHash = currentToken
    ? createHash("sha256").update(currentToken).digest("hex")
    : "";
  const db = await getPool().connect();
  try {
    await db.query("BEGIN");
    await db.query(
      "UPDATE fido_users SET password_hash=$2,password_salt=$3,updated_at=now() WHERE id=$1",
      [user.id, await passwordDigest(newPassword, salt), salt],
    );
    await db.query(
      "DELETE FROM fido_sessions WHERE user_id=$1 AND token_hash<>$2",
      [user.id, currentTokenHash],
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

export async function cleanupSecurityRecords() {
  if (mode() !== "database") return;
  await initializeDatabase();
  await getPool().query(
    `DELETE FROM fido_sessions WHERE expires_at < now();
     DELETE FROM fido_login_attempts WHERE updated_at < now() - interval '7 days';
     DELETE FROM fido_requests WHERE created_at < now() - interval '90 days';
     DELETE FROM fido_auth_events WHERE occurred_at < now() - interval '365 days';`,
  );
}

export async function recordAuthEvent(input: {
  event: string;
  success: boolean;
  userId?: string;
  username?: string;
  actorId?: string;
  clientId?: string;
}) {
  if (mode() !== "database") return;
  try {
    await initializeDatabase();
    await getPool().query(
      `INSERT INTO fido_auth_events(event,success,user_id,username,actor_id,client_id)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [
        input.event.slice(0, 80),
        input.success,
        input.userId ?? null,
        input.username?.slice(0, 40) ?? null,
        input.actorId ?? null,
        input.clientId ?? null,
      ],
    );
  } catch (error) {
    console.error(
      "Authentication audit write failed",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

export async function listAuthEvents(limit = 100) {
  await initializeDatabase();
  const bounded = Math.min(250, Math.max(1, Math.trunc(limit)));
  const result = await getPool().query(
    `SELECT id,occurred_at,event,success,username,user_id,actor_id
       FROM fido_auth_events ORDER BY occurred_at DESC LIMIT $1`,
    [bounded],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    occurredAt: new Date(row.occurred_at).toISOString(),
    event: String(row.event),
    success: Boolean(row.success),
    username: row.username ? String(row.username) : undefined,
    userId: row.user_id ? String(row.user_id) : undefined,
    actorId: row.actor_id ? String(row.actor_id) : undefined,
  }));
}

export function hasPermission(user: AuthUser, permission: Permission) {
  return (
    user.permissions.includes("*") || user.permissions.includes(permission)
  );
}

export const demoUser: AuthUser = {
  id: "demo-owner",
  name: "Fido LK Owner",
  username: "owner",
  role: "Owner",
  permissions: ["*"],
  active: true,
  staffId: "staff-1",
};

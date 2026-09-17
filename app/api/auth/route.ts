import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import {
  AuthError,
  authStatus,
  bootstrapOwner,
  changePassword,
  login,
  logout,
  authenticateRequest,
  recordAuthEvent,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200, requestId?: string) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(requestId ? { "X-Request-ID": requestId } : {}),
    },
  });

function clientId(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0].trim();
  const value =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    forwarded ||
    "unknown";
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

function sameOrigin(req: NextRequest) {
  const value = req.headers.get("origin");
  if (!value) return true;
  try {
    const origin = new URL(value);
    const host =
      req.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
      req.headers.get("host");
    const protocol =
      req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
      req.nextUrl.protocol.slice(0, -1);
    return (
      Boolean(host) &&
      origin.host === host &&
      origin.protocol === `${protocol}:`
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    return json(await authStatus(req));
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : "Unable to check access.",
      },
      error instanceof AuthError ? error.status : 500,
    );
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const requester = clientId(req);
  let operation = "unknown";
  let auditUsername: string | undefined;
  let auditUserId: string | undefined;
  if (!sameOrigin(req))
    return json({ error: "Cross-origin request rejected." }, 403, requestId);
  try {
    const raw = await req.text();
    if (raw.length > 32768)
      return json({ error: "Request is too large." }, 413, requestId);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid JSON." }, 400, requestId);
    }
    operation = typeof body.operation === "string" ? body.operation : "unknown";
    auditUsername =
      typeof body.username === "string"
        ? body.username.trim().toLowerCase().slice(0, 40)
        : undefined;
    const response = json({ ok: true }, 200, requestId);
    if (operation === "bootstrap") {
      const owner = await bootstrapOwner(body, response);
      await recordAuthEvent({
        event: "owner.bootstrap",
        success: true,
        userId: owner.id,
        username: owner.username,
        clientId: requester,
      });
      return response;
    }
    if (operation === "login") {
      const user = await login(body, response, requester);
      await recordAuthEvent({
        event: "login",
        success: true,
        userId: user.id,
        username: user.username,
        clientId: requester,
      });
      return response;
    }
    if (operation === "logout") {
      const user = await authenticateRequest(req, false);
      await logout(req, response);
      await recordAuthEvent({
        event: "logout",
        success: true,
        userId: user?.id,
        username: user?.username,
        clientId: requester,
      });
      return response;
    }
    if (operation === "changePassword") {
      const user = await authenticateRequest(req);
      auditUserId = user!.id;
      auditUsername = user!.username;
      await changePassword(req, user!, body);
      await recordAuthEvent({
        event: "password.change",
        success: true,
        userId: user!.id,
        username: user!.username,
        actorId: user!.id,
        clientId: requester,
      });
      return response;
    }
    return json({ error: "Unknown authentication operation." }, 400, requestId);
  } catch (error) {
    if (["bootstrap", "login", "changePassword"].includes(operation))
      await recordAuthEvent({
        event:
          operation === "changePassword"
            ? "password.change.failed"
            : `${operation}.failed`,
        success: false,
        userId: auditUserId,
        username: auditUsername,
        clientId: requester,
      });
    const status = error instanceof AuthError ? error.status : 500;
    return json(
      {
        error:
          error instanceof AuthError
            ? error.message
            : "Unable to complete authentication.",
      },
      status,
      requestId,
    );
  }
}

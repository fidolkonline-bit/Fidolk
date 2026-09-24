import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, hasPermission } from "@/lib/auth";
import { BusinessError } from "@/lib/business";
import { mode, mutateWorkspace, readWorkspace } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const attempts = new Map<string, { count: number; resetAt: number }>();
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const response = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  return !origin || origin === req.nextUrl.origin;
}

function limit(req: NextRequest) {
  const key =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || record.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  record.count += 1;
  return record.count > 30;
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return response({ error: "Cross-origin request rejected." }, 403);
  if (limit(req))
    return response({ error: "Too many requests. Try again shortly." }, 429);
  try {
    const text = await req.text();
    if (text.length > 10_000)
      return response({ error: "Request is too large." }, 413);
    const body = JSON.parse(text) as Record<string, unknown>;
    if (body.operation === "issue") {
      if (mode() !== "database")
        return response(
          { error: "Customer portal links require database mode." },
          409,
        );
      const user = await authenticateRequest(req);
      if (!user || !hasPermission(user, "repairs.manage"))
        return response(
          { error: "You do not have permission for this operation." },
          403,
        );
      const workspace = await readWorkspace(user);
      const repair = workspace.data.repairs.find(
        (item) => item.id === body.repairId,
      );
      if (!repair) return response({ error: "Repair not found." }, 404);
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 14 * 86400000).toISOString();
      await mutateWorkspace(
        {
          type: "setRepairPortalToken",
          payload: { id: repair.id, tokenHash: hash(token), expiresAt },
          requestId: randomUUID(),
        },
        user,
      );
      return response({
        url: `${req.nextUrl.origin}/repair-status#token=${encodeURIComponent(token)}`,
        expiresAt,
      });
    }
    const token = typeof body.token === "string" ? body.token : "";
    if (token.length < 32 || token.length > 100)
      return response(
        { error: "This repair link is invalid or expired." },
        404,
      );
    const tokenHash = hash(token);
    const workspace = await readWorkspace();
    const repair = workspace.data.repairs.find(
      (item) =>
        item.portalTokenHash === tokenHash &&
        item.portalTokenExpiresAt &&
        Date.parse(item.portalTokenExpiresAt) >= Date.now(),
    );
    if (!repair)
      return response(
        { error: "This repair link is invalid or expired." },
        404,
      );
    if (body.operation === "decision") {
      const decision = body.decision;
      if (decision !== "Approved" && decision !== "Declined")
        return response({ error: "Choose approve or decline." }, 400);
      await mutateWorkspace({
        type: "repairPortalDecision",
        payload: {
          tokenHash,
          decision,
          estimateRevision: body.estimateRevision,
        },
        requestId: randomUUID(),
      });
      return response({ ok: true, decision });
    }
    return response({
      repair: {
        number: repair.number,
        device: repair.device,
        issue: repair.issue,
        status: repair.status,
        estimate: repair.estimate,
        paid: repair.paid,
        estimateRevision: repair.estimateRevision ?? 1,
        warrantyDays: repair.warrantyDays,
        createdAt: repair.createdAt,
        completedAt: repair.completedAt,
        canDecide: repair.status === "Awaiting approval",
      },
    });
  } catch (error) {
    if (error instanceof BusinessError)
      return response({ error: error.message }, 422);
    return response({ error: "Unable to open this repair link." }, 500);
  }
}

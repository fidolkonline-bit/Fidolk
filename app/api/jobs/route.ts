import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { decryptSecret } from "@/lib/secrets";
import { mutateWorkspace, readWorkspace } from "@/lib/store";
import { listUsers } from "@/lib/auth";
import { cleanupSecurityRecords } from "@/lib/auth";
import { sendEmptyPush } from "@/lib/web-push";
import type { AuthUser } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const systemUser: AuthUser = {
  id: "system",
  name: "Scheduled worker",
  username: "system",
  role: "System",
  permissions: ["*"],
  active: true,
};

function authorized(req: NextRequest) {
  const expected = process.env.CRON_SECRET ?? "";
  const supplied = (req.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return Boolean(expected) && a.length === b.length && timingSafeEqual(a, b);
}

const normalizePhone = (phone: string) =>
  phone.startsWith("0") ? `94${phone.slice(1)}` : phone.replace(/^\+/, "");

async function run(req: NextRequest) {
  if (!authorized(req))
    return NextResponse.json(
      { error: "Job authorization required." },
      { status: 401 },
    );
  try {
    await cleanupSecurityRecords();
    const before = await readWorkspace(systemUser);
    const afterAlerts = await mutateWorkspace(
      { type: "processAlerts", payload: {}, requestId: crypto.randomUUID() },
      systemUser,
    );
    await mutateWorkspace(
      {
        type: "processCreditReminders",
        payload: {},
        requestId: crypto.randomUUID(),
      },
      systemUser,
    );
    const owners = (await listUsers())
      .filter((user) => user.active && user.permissions.includes("*"))
      .map((user) => user.id);
    const targets = new Set<string>();
    for (const alert of afterAlerts.data.alerts) {
      const previous = before.data.alerts.find((item) => item.id === alert.id);
      if (previous?.status === alert.status) continue;
      if (alert.status === "Due" && alert.assigneeUserId)
        targets.add(alert.assigneeUserId);
      if (alert.status === "Due" && !alert.assigneeUserId)
        owners.forEach((id) => targets.add(id));
      if (alert.status === "Escalated") {
        owners.forEach((id) => targets.add(id));
        if (alert.assigneeUserId) targets.add(alert.assigneeUserId);
      }
    }
    if (targets.size && process.env.VAPID_PUBLIC_KEY) {
      for (const subscription of afterAlerts.data.pushSubscriptions.filter(
        (item) => targets.has(item.userId),
      )) {
        try {
          const result = await sendEmptyPush(subscription);
          if (result.expired)
            await mutateWorkspace(
              {
                type: "removePush",
                payload: { endpoint: subscription.endpoint },
                requestId: crypto.randomUUID(),
              },
              systemUser,
            );
        } catch (error) {
          console.error(
            "Push delivery failed",
            error instanceof Error ? error.message : "Unknown error",
          );
        }
      }
    }
    const state = await readWorkspace(systemUser);
    const settings = state.data.settings;
    let sent = 0;
    let failed = 0;
    if (
      settings.smsEnabled &&
      settings.smsSenderId &&
      settings.smsApiKeyCiphertext
    ) {
      const token = decryptSecret(settings.smsApiKeyCiphertext);
      for (const message of state.data.sms
        .filter(
          (item) =>
            item.status === "Queued" &&
            (!item.nextAttemptAt ||
              Date.parse(item.nextAttemptAt) <= Date.now()),
        )
        .slice(0, 10)) {
        let status: "Sent" | "Failed" = "Failed";
        let deliveryError = "Provider delivery failed";
        try {
          const response = await fetch("https://app.text.lk/api/v3/sms/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              recipient: normalizePhone(message.phone),
              sender_id: settings.smsSenderId,
              type: "plain",
              message: message.message,
            }),
            signal: AbortSignal.timeout(10000),
          });
          const result = (await response.json()) as { status?: string };
          status =
            response.ok && result.status === "success" ? "Sent" : "Failed";
          if (status === "Failed")
            deliveryError = `text.lk returned ${response.status}`;
        } catch (error) {
          status = "Failed";
          deliveryError =
            error instanceof Error ? error.message : deliveryError;
        }
        await mutateWorkspace(
          {
            type: "markSms",
            payload: { id: message.id, status, error: deliveryError },
            requestId: crypto.randomUUID(),
          },
          systemUser,
        );
        if (status === "Sent") sent++;
        else failed++;
      }
    }
    return NextResponse.json(
      { ok: true, sent, failed },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Scheduled job failed",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Scheduled processing failed." },
      { status: 500 },
    );
  }
}

export const GET = run;
export const POST = run;

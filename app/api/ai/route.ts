import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateRequest, AuthError, hasPermission } from "@/lib/auth";
import { BusinessError } from "@/lib/business";
import {
  aiRequestSchema,
  aiUsageDate,
  runAiAssistant,
  testAiConnection,
} from "@/lib/ai";
import { decryptSecret } from "@/lib/secrets";
import { mutateWorkspace, readWorkspace } from "@/lib/store";
import type { AiFeature, Permission } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const featurePermission: Record<AiFeature, Permission> = {
  dailyBrief: "dashboard.view",
  repairAssistant: "repairs.manage",
  customerMessages: "customers.view",
  invoiceExtraction: "purchasing.manage",
  inventoryInsights: "inventory.view",
  askFido: "reports.view",
  anomalyReview: "reports.view",
  marketingCopy: "inventory.view",
};

const envelopeSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("run"),
    feature: aiRequestSchema.shape.feature,
    input: aiRequestSchema.shape.input,
    language: aiRequestSchema.shape.language,
    image: aiRequestSchema.shape.image,
  }),
  z.object({
    operation: z.literal("test"),
    apiKey: z.string().trim().max(500).optional(),
    model: z
      .string()
      .regex(/^gemini-[a-z0-9.-]+$/i)
      .max(100)
      .optional(),
  }),
]);

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

function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function sanitizedProviderError(value: unknown) {
  const message = value instanceof Error ? value.message : "Unknown AI error";
  return message
    .replace(/([?&](?:key|api_key)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, "[REDACTED API KEY]")
    .slice(0, 300);
}

function publicError(value: unknown) {
  if (value instanceof AuthError)
    return response({ error: value.message }, value.status);
  if (value instanceof BusinessError)
    return response({ error: value.message }, 422);
  if (value instanceof z.ZodError)
    return response({ error: "Check the AI request and try again." }, 400);
  const message = sanitizedProviderError(value);
  console.error("AI request failed", message);
  if (/429|resource.?exhausted|rate.?limit/i.test(message))
    return response(
      {
        error:
          "Gemini is rate-limited. The fallback model was also unavailable; try again later.",
      },
      429,
    );
  if (/api.?key|permission|unauthenticated|401|403/i.test(message))
    return response(
      { error: "Gemini rejected the configured API key or project access." },
      502,
    );
  return response(
    {
      error: "AI is temporarily unavailable. No business records were changed.",
    },
    502,
  );
}

function configuredKey(
  settings: Awaited<ReturnType<typeof readWorkspace>>["data"]["settings"],
) {
  const encrypted = settings.ai.apiKeyCiphertext;
  if (!settings.ai.apiKeyConfigured || !encrypted)
    throw new BusinessError("Configure a Gemini API key in Settings first.");
  return decryptSecret(encrypted);
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return response({ error: "Cross-origin request rejected." }, 403);
  try {
    const user = await authenticateRequest(req);
    const body = await req.text();
    if (body.length > 6_000_000)
      return response({ error: "AI request is too large." }, 413);
    let raw: unknown;
    try {
      raw = JSON.parse(body);
    } catch {
      return response({ error: "Invalid JSON." }, 400);
    }
    const parsed = envelopeSchema.parse(raw);
    const current = await readWorkspace(user!);

    if (parsed.operation === "test") {
      if (!hasPermission(user!, "settings.manage"))
        throw new AuthError("You cannot configure AI settings.", 403);
      const apiKey = parsed.apiKey || configuredKey(current.data.settings);
      const result = await testAiConnection(
        apiKey,
        parsed.model || current.data.settings.ai.primaryModel,
      );
      return response({ connected: true, ...result });
    }

    const request = aiRequestSchema.parse(parsed);
    const permission = featurePermission[request.feature];
    if (!hasPermission(user!, permission))
      throw new AuthError(
        "You do not have permission for this AI feature.",
        403,
      );
    const settings = current.data.settings.ai;
    if (!settings.enabled)
      throw new BusinessError("AI is disabled in Settings.");
    if (!settings.features[request.feature])
      throw new BusinessError("This AI feature is disabled in Settings.");
    if (
      [
        "repairAssistant",
        "customerMessages",
        "askFido",
        "marketingCopy",
      ].includes(request.feature) &&
      !request.input
    )
      throw new BusinessError("Enter the details you want AI to work with.");
    if (
      request.feature === "invoiceExtraction" &&
      !request.input &&
      !request.image
    )
      throw new BusinessError("Attach an invoice image or enter invoice text.");

    const apiKey = configuredKey(current.data.settings);
    const reserved = await mutateWorkspace(
      {
        type: "recordAiRequest",
        requestId: crypto.randomUUID(),
        payload: { usageDate: aiUsageDate() },
      },
      user!,
    );
    try {
      const result = await runAiAssistant(
        apiKey,
        {
          primary: settings.primaryModel,
          fallback: settings.fallbackModel,
        },
        current.data,
        request,
      );
      await mutateWorkspace(
        {
          type: "recordAiResult",
          requestId: crypto.randomUUID(),
          payload: { success: true },
        },
        user!,
      );
      return response({
        result,
        usage: {
          requestsToday: reserved.data.settings.ai.requestsToday,
          dailyRequestLimit: reserved.data.settings.ai.dailyRequestLimit,
        },
      });
    } catch (error) {
      await mutateWorkspace(
        {
          type: "recordAiResult",
          requestId: crypto.randomUUID(),
          payload: {
            success: false,
            error: sanitizedProviderError(error),
          },
        },
        user!,
      );
      throw error;
    }
  } catch (value) {
    return publicError(value);
  }
}

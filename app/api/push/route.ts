import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/auth";
import { mutateWorkspace } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await authenticateRequest(req);
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) return NextResponse.json({ configured: false });
    return NextResponse.json(
      { configured: true, publicKey },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sign in required." },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    const origin = req.headers.get("origin");
    if (
      origin &&
      new URL(origin).host !==
        (req.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
          req.headers.get("host"))
    )
      throw new AuthError("Cross-origin request rejected.", 403);
    const body = (await req.json()) as {
      endpoint?: unknown;
      keys?: { p256dh?: unknown; auth?: unknown };
    };
    await mutateWorkspace(
      {
        type: "subscribePush",
        payload: {
          endpoint: body.endpoint,
          p256dh: body.keys?.p256dh,
          auth: body.keys?.auth,
        },
        requestId: crypto.randomUUID(),
      },
      user!,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to enable push notifications.",
      },
      { status: error instanceof AuthError ? error.status : 422 },
    );
  }
}

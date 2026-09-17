import { NextRequest, NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthError,
  hasPermission,
  listAuthEvents,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!hasPermission(user!, "users.manage"))
      throw new AuthError(
        "You do not have permission to view security events.",
        403,
      );
    return NextResponse.json(
      { events: await listAuthEvents() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json(
      {
        error:
          error instanceof AuthError
            ? error.message
            : "Unable to load security events.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}

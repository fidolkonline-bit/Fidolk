import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError, hasPermission } from "@/lib/auth";
import { decryptSecret } from "@/lib/secrets";
import { readWorkspace, mutateWorkspace } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!hasPermission(user!, "repairs.credentials"))
      throw new AuthError(
        "You do not have permission to reveal device access details.",
        403,
      );
    const origin = req.headers.get("origin");
    if (
      origin &&
      new URL(origin).host !==
        (req.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
          req.headers.get("host"))
    )
      throw new AuthError("Cross-origin request rejected.", 403);
    const body = (await req.json()) as { repairId?: unknown };
    if (typeof body.repairId !== "string")
      throw new AuthError("Repair not found.", 404);
    const workspace = await readWorkspace(user!);
    const repair = workspace.data.repairs.find(
      (item) => item.id === body.repairId,
    );
    if (!repair?.credentialCiphertext)
      throw new AuthError(
        "No device access detail is stored for this repair.",
        404,
      );
    const credential = decryptSecret(repair.credentialCiphertext);
    await mutateWorkspace(
      {
        type: "recordCredentialReveal",
        payload: { repairNumber: repair.number },
        requestId: crypto.randomUUID(),
      },
      user!,
    );
    return NextResponse.json(
      { credential },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    return NextResponse.json(
      {
        error:
          error instanceof AuthError
            ? error.message
            : "Unable to reveal the access detail.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}

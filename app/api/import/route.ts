import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError, hasPermission } from "@/lib/auth";
import { BusinessError } from "@/lib/business";
import { parseCsv } from "@/lib/csv";
import { mutateWorkspace } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const data = await req.formData();
    const requestedKind = String(data.get("kind") ?? "");
    const permission =
      requestedKind === "stock"
        ? "purchasing.manage"
        : requestedKind === "products" || requestedKind === "legacyProducts"
          ? "inventory.manage"
          : "customers.manage";
    if (!hasPermission(user!, permission))
      throw new AuthError("You do not have permission for this import.", 403);
    const file = data.get("file");
    if (!(file instanceof File) || file.size > 2_000_000)
      throw new BusinessError("Choose a CSV file smaller than 2 MB.");
    const rows = parseCsv(await file.text());
    const looksLikeLegacyProductExport = rows.some(
      (row) =>
        Object.hasOwn(row, "Product") &&
        Object.hasOwn(row, "Unit Purchase Price") &&
        Object.hasOwn(row, "Current stock"),
    );
    const kind =
      requestedKind === "legacyProducts" ||
      (requestedKind === "products" && looksLikeLegacyProductExport)
        ? "legacyProducts"
        : requestedKind;
    const imported =
      kind === "legacyProducts"
        ? rows.filter(
            (row) =>
              row.Product?.trim() &&
              row.SKU?.trim() &&
              !/add to location/i.test(row.Product),
          ).length
        : rows.length;
    await mutateWorkspace(
      {
        type: "importCsv",
        payload: { kind, rows },
        requestId: crypto.randomUUID(),
      },
      user!,
    );
    return NextResponse.json({
      ok: true,
      imported,
      skipped: rows.length - imported,
      format: kind,
    });
  } catch (error) {
    const status =
      error instanceof AuthError
        ? error.status
        : error instanceof BusinessError
          ? 422
          : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed." },
      { status },
    );
  }
}

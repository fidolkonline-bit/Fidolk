import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, AuthError, hasPermission } from "@/lib/auth";
import { BusinessError } from "@/lib/business";
import { mutateWorkspace } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted && char === '"' && text[i + 1] === '"') {
      field += '"';
      i++;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  if (quoted) throw new BusinessError("CSV contains an unclosed quoted value.");
  const headers = rows.shift()?.map((value) => value.trim());
  if (!headers?.length) throw new BusinessError("CSV header row is missing.");
  return rows.map((values) =>
    Object.fromEntries(
      headers.map((header, index) => [header, values[index]?.trim() ?? ""]),
    ),
  );
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
    const data = await req.formData();
    const kind = String(data.get("kind") ?? "");
    const permission =
      kind === "stock"
        ? "purchasing.manage"
        : kind === "products"
          ? "inventory.manage"
          : "customers.manage";
    if (!hasPermission(user!, permission))
      throw new AuthError("You do not have permission for this import.", 403);
    const file = data.get("file");
    if (!(file instanceof File) || file.size > 2_000_000)
      throw new BusinessError("Choose a CSV file smaller than 2 MB.");
    const rows = parseCsv(await file.text());
    await mutateWorkspace(
      {
        type: "importCsv",
        payload: { kind, rows },
        requestId: crypto.randomUUID(),
      },
      user!,
    );
    return NextResponse.json({ ok: true, imported: rows.length });
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

import { NextResponse } from "next/server";
import { getPool, initializeDatabase, mode } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  if (mode() !== "database")
    return NextResponse.json(
      { status: "degraded", database: "not configured" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  try {
    await initializeDatabase();
    const result = await getPool().query(
      "SELECT version,updated_at FROM fido_workspace WHERE id=$1",
      ["main"],
    );
    if (!result.rowCount) throw new Error("Workspace unavailable");
    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
        latencyMs: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable", database: "unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

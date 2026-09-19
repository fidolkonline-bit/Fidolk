import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticateRequest,
  AuthError,
  createUser,
  hasPermission,
  listUsers,
  updateUser,
  recordAuthEvent,
} from "@/lib/auth";
import { readWorkspace, mutateWorkspace, mode } from "@/lib/store";
import { BusinessError } from "@/lib/business";
import type { Permission, WorkspaceResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionPermissions: Record<string, Permission> = {
  createSale: "sales.manage",
  returnSale: "sales.manage",
  returnItems: "sales.manage",
  collectPayment: "sales.manage",
  createCustomer: "customers.manage",
  newProduct: "inventory.manage",
  updateProductPricing: "inventory.manage",
  updateBatchPricing: "purchasing.manage",
  setProductActive: "inventory.manage",
  receiveStock: "purchasing.manage",
  createPurchaseOrder: "purchasing.manage",
  receivePurchaseOrder: "purchasing.manage",
  createRepair: "repairs.manage",
  repairStatus: "repairs.manage",
  repairPayment: "repairs.manage",
  updateRepairEstimate: "repairs.manage",
  createWarrantyClaim: "repairs.manage",
  addExpense: "expenses.manage",
  addCheque: "purchasing.manage",
  chequeStatus: "purchasing.manage",
  addShipment: "cod.manage",
  shipmentStatus: "cod.manage",
  settleCod: "cod.manage",
  collectCodBatch: "cod.manage",
  addReload: "reloads.manage",
  setProviderRule: "settings.manage",
  staffAdvance: "payroll.manage",
  payroll: "payroll.manage",
  editStaff: "payroll.manage",
  updateSettings: "settings.manage",
  configureSms: "settings.manage",
  retrySms: "settings.manage",
  addSupplier: "purchasing.manage",
  supplierPayment: "purchasing.manage",
  createSupplierReturn: "purchasing.manage",
  addSupplierReturn: "purchasing.manage",
  settleSupplierReturn: "purchasing.manage",
  addAgent: "payroll.manage",
  payCommission: "payroll.manage",
  createAlert: "alerts.manage",
  acknowledgeAlert: "alerts.view",
  collectAlert: "alerts.view",
  cancelAlert: "alerts.manage",
  escalateAlert: "alerts.manage",
  clearRepairCredential: "repairs.credentials",
  readNotifications: "dashboard.view",
  createUser: "users.manage",
  updateUser: "users.manage",
};

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

function error(value: unknown) {
  if (value instanceof AuthError)
    return response({ error: value.message }, value.status);
  if (value instanceof BusinessError)
    return response({ error: value.message }, 422);
  if (value instanceof z.ZodError)
    return response({ error: "Invalid request. Check the form values." }, 400);
  console.error(
    "Workspace request failed",
    value instanceof Error ? value.message : "Unknown error",
  );
  return response(
    {
      error:
        "Unable to complete this operation. Your changes were not saved. Please try again.",
    },
    500,
  );
}

async function prepare(result: WorkspaceResponse) {
  for (const repair of result.data.repairs) delete repair.credentialCiphertext;
  delete result.data.settings.smsApiKeyCiphertext;
  if (
    mode() === "database" &&
    (hasPermission(result.user, "users.manage") ||
      hasPermission(result.user, "alerts.manage"))
  ) {
    const users = await listUsers();
    result.data.users = hasPermission(result.user, "users.manage")
      ? users
      : users.map(({ id, name, username, role, active }) => ({
          id,
          name,
          username,
          role,
          active,
          permissions: [],
        }));
  } else delete result.data.users;
  return result;
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    return response(await prepare(await readWorkspace(user!)));
  } catch (value) {
    return error(value);
  }
}

const schema = z.object({
  type: z.string().min(1).max(80),
  payload: z.record(z.string(), z.unknown()),
  requestId: z.uuid(),
});

export async function POST(req: NextRequest) {
  if (!sameOrigin(req))
    return response({ error: "Cross-origin request rejected." }, 403);
  try {
    const user = await authenticateRequest(req);
    const body = await req.text();
    if (body.length > 100000)
      return response({ error: "Request is too large." }, 413);
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return response({ error: "Invalid JSON." }, 400);
    }
    const action = schema.parse(parsed);
    const permission = actionPermissions[action.type];
    if (!permission)
      throw new AuthError("This operation is not available.", 403);
    if (!hasPermission(user!, permission))
      throw new AuthError(
        "You do not have permission for this operation.",
        403,
      );
    if (
      action.type === "createAlert" &&
      typeof action.payload.assigneeUserId === "string"
    ) {
      const assignee =
        mode() === "database"
          ? (await listUsers()).find(
              (item) => item.id === action.payload.assigneeUserId,
            )
          : user?.id === action.payload.assigneeUserId
            ? user
            : undefined;
      if (
        action.payload.assigneeUserId &&
        (!assignee ||
          !assignee.active ||
          !hasPermission(assignee, "alerts.view"))
      )
        throw new BusinessError(
          "Choose an active user with permission to view alerts.",
        );
      if (assignee) action.payload.assigneeName = assignee.name;
    }
    if (
      ["createUser", "updateUser"].includes(action.type) &&
      typeof action.payload.staffId === "string" &&
      action.payload.staffId
    ) {
      const workspace = await readWorkspace(user!);
      if (
        !workspace.data.staff.some(
          (staff) => staff.id === action.payload.staffId,
        )
      )
        throw new BusinessError("The linked staff record no longer exists.");
    }
    if (action.type === "createUser") {
      await createUser(action.payload, user!);
      await recordAuthEvent({
        event: "user.created",
        success: true,
        username:
          typeof action.payload.username === "string"
            ? action.payload.username
            : undefined,
        actorId: user!.id,
      });
    } else if (action.type === "updateUser") {
      await updateUser(action.payload, user!);
      await recordAuthEvent({
        event: "user.updated",
        success: true,
        userId:
          typeof action.payload.id === "string" ? action.payload.id : undefined,
        actorId: user!.id,
      });
    } else return response(await prepare(await mutateWorkspace(action, user!)));
    return response(await prepare(await readWorkspace(user!)));
  } catch (value) {
    return error(value);
  }
}

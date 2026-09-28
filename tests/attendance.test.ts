import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { applyAction } from "../lib/business";
import { createEmptyWorkspace } from "../lib/seed";
import { approvedLeaveDays } from "../lib/attendance";
import type { AuthUser, Workspace } from "../lib/types";

const staff: AuthUser = {
  id: "user-1",
  name: "Sales person",
  username: "sales",
  role: "Sales",
  permissions: [],
  active: true,
};
const admin: AuthUser = {
  id: "user-2",
  name: "Admin",
  username: "admin",
  role: "Admin",
  permissions: ["users.manage"],
  active: true,
};
const run = (
  space: Workspace,
  type: string,
  payload: Record<string, unknown>,
  actor: AuthUser,
  now = "2026-09-28T03:00:00.000Z",
) => applyAction(space, { type, payload, requestId: randomUUID() }, now, actor);

test("a user checks in and out once per Sri Lanka day", () => {
  const space = createEmptyWorkspace();
  run(space, "checkIn", {}, staff);
  assert.equal(space.attendance[0].day, "2026-09-28");
  assert.throws(() => run(space, "checkIn", {}, staff), /already checked in/);
  run(space, "setVisitNote", { note: "Customer delivery" }, staff);
  run(space, "checkOut", {}, staff, "2026-09-28T10:00:00.000Z");
  assert.equal(space.attendance[0].visitNote, "Customer delivery");
  assert.equal(space.attendance[0].checkOutAt, "2026-09-28T10:00:00.000Z");
  assert.throws(() => run(space, "checkOut", {}, staff), /already checked out/);
});

test("leave requires an admin decision and rejects overlapping requests", () => {
  const space = createEmptyWorkspace();
  run(
    space,
    "requestLeave",
    {
      fromDay: "2026-10-02",
      toDay: "2026-10-02",
      portion: "Half day",
      reason: "Appointment",
    },
    staff,
  );
  assert.equal(space.leaveRequests[0].status, "Pending");
  assert.equal(space.notifications[0].recipientPermission, "users.manage");
  assert.throws(
    () =>
      run(
        space,
        "requestLeave",
        {
          fromDay: "2026-10-02",
          toDay: "2026-10-03",
          portion: "Full day",
          reason: "Trip",
        },
        staff,
      ),
    /overlap/,
  );
  assert.throws(
    () =>
      run(
        space,
        "decideLeave",
        { id: space.leaveRequests[0].id, status: "Approved" },
        staff,
      ),
    /Only an admin/,
  );
  run(
    space,
    "decideLeave",
    { id: space.leaveRequests[0].id, status: "Approved" },
    admin,
  );
  assert.equal(space.leaveRequests[0].status, "Approved");
  assert.equal(space.notifications[0].recipientUserId, staff.id);
  assert.equal(
    approvedLeaveDays(space.leaveRequests, staff.id, "2026-10"),
    0.5,
  );
  run(space, "readNotifications", {}, staff);
  assert.equal(
    space.notifications.find((item) => item.recipientPermission)?.readByUserIds,
    undefined,
  );
  run(space, "readNotifications", {}, admin);
  assert.deepEqual(
    space.notifications.find((item) => item.recipientPermission)?.readByUserIds,
    [admin.id],
  );
  assert.throws(
    () =>
      run(
        space,
        "decideLeave",
        { id: space.leaveRequests[0].id, status: "Rejected" },
        admin,
      ),
    /already been decided/,
  );
});

test("attendance corrections require an admin reason and keep payroll unchanged", () => {
  const space = createEmptyWorkspace();
  const before = structuredClone(space.staff);
  run(space, "checkIn", {}, staff);
  const id = space.attendance[0].id;
  assert.throws(
    () =>
      run(
        space,
        "correctAttendance",
        {
          id,
          checkInAt: "2026-09-28T03:00:00.000Z",
          checkOutAt: "2026-09-28T10:00:00.000Z",
          reason: "Forgot",
        },
        staff,
      ),
    /Only an admin/,
  );
  run(
    space,
    "correctAttendance",
    {
      id,
      checkInAt: "2026-09-28T03:00:00.000Z",
      checkOutAt: "2026-09-28T10:00:00.000Z",
      reason: "Forgot to check out",
    },
    admin,
  );
  assert.equal(space.attendance[0].correctedBy, admin.name);
  assert.deepEqual(space.staff, before);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldAlarm, startAlarm } from "../lib/alerts";
import { applyAction } from "../lib/business";
import { createEmptyWorkspace } from "../lib/seed";
import type { Alert, AuthUser } from "../lib/types";
const due = Date.parse("2026-09-17T12:00:00Z");
const alert: Alert = {
  id: "a",
  title: "Collect display",
  type: "Bus arrival",
  dueAt: new Date(due).toISOString(),
  minutesBefore: 10,
  assigneeUserId: "staff",
  status: "Scheduled",
  createdAt: new Date(due).toISOString(),
};
const staff: AuthUser = {
  id: "staff",
  name: "Sales",
  username: "sales",
  role: "Sales",
  active: true,
  permissions: ["alerts.view"],
};
const owner: AuthUser = {
  ...staff,
  id: "owner",
  name: "Owner",
  permissions: ["*"],
};
test("arrival alarm starts ten minutes before arrival, escalates to owner, and stops only on terminal status", () => {
  assert.equal(shouldAlarm(alert, staff, due - 600001), false);
  assert.equal(shouldAlarm(alert, staff, due - 600000), true);
  assert.equal(shouldAlarm(alert, owner, due - 1), false);
  assert.equal(shouldAlarm(alert, owner, due), true);
  assert.equal(shouldAlarm(alert, { ...staff, id: "other" }, due), false);
  for (const status of ["Acknowledged", "Cancelled"] as const)
    assert.equal(shouldAlarm({ ...alert, status }, staff, due + 60000), false);
});
test("acknowledgement rejects unrelated staff and preserves the first acknowledgement", () => {
  const s = createEmptyWorkspace();
  s.alerts = [{ ...alert }];
  assert.throws(
    () =>
      applyAction(
        s,
        {
          requestId: crypto.randomUUID(),
          type: "acknowledgeAlert",
          payload: { id: "a" },
        },
        undefined,
        { ...staff, id: "other" },
      ),
    /assigned/,
  );
  applyAction(
    s,
    {
      requestId: crypto.randomUUID(),
      type: "acknowledgeAlert",
      payload: { id: "a" },
    },
    undefined,
    staff,
  );
  const saved = { ...s.alerts[0] };
  applyAction(
    s,
    {
      requestId: crypto.randomUUID(),
      type: "acknowledgeAlert",
      payload: { id: "a" },
    },
    undefined,
    owner,
  );
  assert.deepEqual(s.alerts[0], saved);
  assert.equal(saved.acknowledgedById, "staff");
  applyAction(
    s,
    { requestId: crypto.randomUUID(), type: "processAlerts", payload: {} },
    undefined,
    owner,
  );
  assert.equal(s.alerts[0].status, "Acknowledged");
});
test("creating an arrival retains its assigned user when users are stored separately", () => {
  const s = createEmptyWorkspace();
  s.users = [];
  applyAction(
    s,
    {
      requestId: crypto.randomUUID(),
      type: "createAlert",
      payload: {
        title: "Part",
        dueAt: alert.dueAt,
        assigneeUserId: "staff",
        assigneeName: "Sales",
      },
    },
    undefined,
    owner,
  );
  assert.equal(s.alerts[0].assigneeUserId, "staff");
});
test("audio graph continues until explicitly stopped and cleanup is idempotent", () => {
  let starts = 0,
    stops = 0;
  const node = () => ({
    frequency: { value: 0 },
    gain: { value: 0 },
    connect() {},
    disconnect() {},
    start() {
      starts++;
    },
    stop() {
      stops++;
    },
  });
  const context = {
    createOscillator: node,
    createGain: node,
    destination: {},
  } as unknown as AudioContext;
  const stop = startAlarm(context, 0.6);
  assert.equal(starts, 2);
  assert.equal(stops, 0);
  stop();
  stop();
  assert.equal(stops, 2);
});

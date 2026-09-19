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
test("arrival alarm starts ten minutes before arrival, escalates to owner, and stops on accepted or terminal status", () => {
  assert.equal(shouldAlarm(alert, staff, due - 600001), false);
  assert.equal(shouldAlarm(alert, staff, due - 600000), true);
  assert.equal(shouldAlarm(alert, owner, due - 1), false);
  assert.equal(shouldAlarm(alert, owner, due), true);
  assert.equal(shouldAlarm(alert, { ...staff, id: "other" }, due), false);
  for (const status of ["Acknowledged", "Collected", "Cancelled"] as const)
    assert.equal(shouldAlarm({ ...alert, status }, staff, due + 60000), false);
});
test("collection requires acceptance, enforces assignment, and is idempotent", () => {
  const s = createEmptyWorkspace();
  s.alerts = [{ ...alert }];
  const collect = (actor: AuthUser, actualAmountPaid = 125000) =>
    applyAction(
      s,
      {
        requestId: crypto.randomUUID(),
        type: "collectAlert",
        payload: { id: "a", actualAmountPaid, collectionNote: "Box intact" },
      },
      "2026-09-17T12:05:00.000Z",
      actor,
    );
  assert.throws(() => collect(staff), /Accept collection responsibility/);
  applyAction(
    s,
    {
      requestId: crypto.randomUUID(),
      type: "acknowledgeAlert",
      payload: { id: "a" },
    },
    "2026-09-17T11:55:00.000Z",
    staff,
  );
  assert.throws(() => collect({ ...staff, id: "other" }), /assigned/);
  collect(staff);
  const saved = { ...s.alerts[0] };
  collect(owner, 999999);
  assert.deepEqual(s.alerts[0], saved);
  assert.equal(saved.status, "Collected");
  assert.equal(saved.actualAmountPaid, 125000);
  assert.equal(saved.collectedById, "staff");
  applyAction(
    s,
    { requestId: crypto.randomUUID(), type: "processAlerts", payload: {} },
    "2026-09-17T13:00:00.000Z",
    owner,
  );
  assert.equal(s.alerts[0].status, "Collected");
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
test("creating a parcel journey validates and stores operational fields", () => {
  const s = createEmptyWorkspace();
  applyAction(
    s,
    {
      requestId: crypto.randomUUID(),
      type: "createAlert",
      payload: {
        title: "Samsung A55 display",
        parcelDescription: "Black OLED service pack",
        busRegistration: "NB-4821",
        busRoute: "Kandy to Matale",
        originLocation: "Kandy",
        arrivalLocation: "Matale Central Bus Stand",
        contactName: "Sunil",
        contactPhone: "071 234-5678",
        secondaryPhone: "+94 77-123 4567",
        pickupInstructions: "Main entrance near the clock",
        packageTraits: ["Fragile", "Urgent"],
        paymentState: "Due on collection",
        amountDue: 125000,
        dueAt: alert.dueAt,
      },
    },
    undefined,
    owner,
  );
  assert.equal(s.alerts[0].busRegistration, "NB-4821");
  assert.equal(s.alerts[0].contactPhone, "0712345678");
  assert.equal(s.alerts[0].secondaryPhone, "+94771234567");
  assert.deepEqual(s.alerts[0].packageTraits, ["Fragile", "Urgent"]);
  assert.equal(s.alerts[0].amountDue, 125000);
  assert.throws(
    () =>
      applyAction(
        createEmptyWorkspace(),
        {
          requestId: crypto.randomUUID(),
          type: "createAlert",
          payload: {
            title: "Invalid payment",
            dueAt: alert.dueAt,
            paymentState: "Paid",
            amountDue: 100,
          },
        },
        undefined,
        owner,
      ),
    /fully paid/,
  );
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

import assert from "node:assert/strict";
import test from "node:test";
import {
  expandPatternPath,
  filterRepairs,
  normalizeSriLankanPhone,
} from "../lib/repairs";
import type { Repair } from "../lib/types";

test("pattern paths include an unvisited crossed midpoint", () => {
  assert.deepEqual(expandPatternPath([1], 3), [1, 2, 3]);
  assert.deepEqual(expandPatternPath([9], 1), [9, 5, 1]);
  assert.deepEqual(expandPatternPath([7], 3), [7, 5, 3]);
  assert.deepEqual(expandPatternPath([1, 2], 3), [1, 2, 3]);
  assert.deepEqual(expandPatternPath([1, 2, 3], 1), [1, 2, 3]);
});

test("Sri Lankan mobile numbers normalize for WhatsApp", () => {
  assert.equal(normalizeSriLankanPhone("077 123 4567"), "94771234567");
  assert.equal(normalizeSriLankanPhone("+94 77 123 4567"), "94771234567");
  assert.equal(normalizeSriLankanPhone("07123"), null);
});

const repair = (
  id: string,
  status: Repair["status"],
  createdAt: string,
): Repair => ({
  id,
  number: `REP-${id}`,
  customerName: "Kasun Perera",
  phone: "0771234567",
  device: "Samsung A14",
  imei: "",
  issue: "Display",
  condition: "Used",
  accessories: [],
  notes: "",
  estimate: 0,
  partsCost: 0,
  staffPercent: 50,
  status,
  warrantyDays: 0,
  createdAt,
  commission: 0,
  paid: 0,
});

test("repair filtering defaults to active and combines search and sorting", () => {
  const rows = [
    repair("1", "Received", "2026-09-17T10:00:00Z"),
    repair("2", "Collected", "2026-09-18T10:00:00Z"),
    { ...repair("3", "In progress", "2026-09-16T10:00:00Z"), device: "iPhone" },
  ];
  assert.deepEqual(
    filterRepairs(rows, { status: "Active" }).map((row) => row.id),
    ["1", "3"],
  );
  assert.deepEqual(
    filterRepairs(rows, {
      status: "All",
      query: "iphone",
      sort: "Oldest",
    }).map((row) => row.id),
    ["3"],
  );
});

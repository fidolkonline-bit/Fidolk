import type { Repair, RepairStatus } from "./types";

export type RepairStatusFilter = RepairStatus | "Active" | "All";
export type RepairPeriodFilter =
  "All time" | "Today" | "Last 7 days" | "This month";
export type RepairSort = "Newest" | "Oldest" | "Longest waiting";

const TERMINAL_REPAIR_STATUSES = new Set<RepairStatus>([
  "Collected",
  "Declined",
]);

export function expandPatternPath(path: number[], next: number): number[] {
  if (next < 1 || next > 9 || path.includes(next)) return path;
  const previous = path.at(-1);
  if (!previous) return [...path, next];

  const row = (dot: number) => Math.floor((dot - 1) / 3);
  const column = (dot: number) => (dot - 1) % 3;
  const rowDelta = row(next) - row(previous);
  const columnDelta = column(next) - column(previous);
  const crossesCenter =
    Math.abs(rowDelta) === 2 &&
    (columnDelta === 0 || Math.abs(columnDelta) === 2);
  const crossesRowMidpoint = rowDelta === 0 && Math.abs(columnDelta) === 2;

  if (crossesCenter || crossesRowMidpoint) {
    const midpoint =
      ((row(previous) + row(next)) / 2) * 3 +
      (column(previous) + column(next)) / 2 +
      1;
    if (!path.includes(midpoint)) return [...path, midpoint, next];
  }

  return [...path, next];
}

export function normalizeSriLankanPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("94")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return /^7\d{8}$/.test(digits) ? `94${digits}` : null;
}

export function isActiveRepair(repair: Repair): boolean {
  return !TERMINAL_REPAIR_STATUSES.has(repair.status);
}

export function filterRepairs(
  repairs: Repair[],
  options: {
    query?: string;
    status?: RepairStatusFilter;
    technicianId?: string;
    period?: RepairPeriodFilter;
    sort?: RepairSort;
    now?: Date;
  },
): Repair[] {
  const {
    query = "",
    status = "Active",
    technicianId = "All technicians",
    period = "All time",
    sort = "Newest",
    now = new Date(),
  } = options;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastSevenDays = new Date(startOfToday);
  lastSevenDays.setDate(lastSevenDays.getDate() - 6);

  const result = repairs.filter((repair) => {
    if (status === "Active" && !isActiveRepair(repair)) return false;
    if (status !== "All" && status !== "Active" && repair.status !== status)
      return false;
    if (
      technicianId !== "All technicians" &&
      repair.technicianStaffId !== technicianId
    )
      return false;
    const created = new Date(repair.createdAt);
    if (period === "Today" && created < startOfToday) return false;
    if (period === "Last 7 days" && created < lastSevenDays) return false;
    if (period === "This month" && created < startOfMonth) return false;
    if (
      normalizedQuery &&
      ![
        repair.number,
        repair.customerName,
        repair.phone,
        repair.device,
        repair.imei,
        repair.issue,
        repair.status,
        repair.technicianName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    )
      return false;
    return true;
  });

  return result.sort((left, right) => {
    const delta =
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    return sort === "Newest" ? delta : -delta;
  });
}

import type { LeaveRequest } from "./types";

export function approvedLeaveDays(
  requests: LeaveRequest[],
  userId: string,
  month: string,
) {
  const first = `${month}-01`;
  const last = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  )
    .toISOString()
    .slice(0, 10);
  return requests
    .filter(
      (item) =>
        item.userId === userId &&
        item.status === "Approved" &&
        item.fromDay <= last &&
        item.toDay >= first,
    )
    .reduce((total, item) => {
      const start = Math.max(
        Date.parse(`${item.fromDay}T00:00:00Z`),
        Date.parse(`${first}T00:00:00Z`),
      );
      const end = Math.min(
        Date.parse(`${item.toDay}T00:00:00Z`),
        Date.parse(`${last}T00:00:00Z`),
      );
      return (
        total +
        (item.portion === "Half day" ? 0.5 : (end - start) / 86400000 + 1)
      );
    }, 0);
}

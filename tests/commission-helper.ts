import type { Workspace } from "../lib/types";

/** Accessories earn 2% of profit: 1% to the salesperson and 1% to agent-1. */
export function withCommission(s: Workspace) {
  s.settings.categoryCommissions = [
    { category: "Accessories", ratePercent: 2, salespersonPercent: 1 },
  ];
  s.agents.push({
    id: "agent-1",
    name: "Nimal",
    phone: "0771234567",
    paidCommission: 0,
    active: true,
  });
  return s;
}

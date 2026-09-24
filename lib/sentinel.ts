// Fraud & Shrinkage Sentinel - Automated Store Loss Prevention Engine for Fido LK

import type { Workspace } from "./types";

export interface SentinelFinding {
  id: string;
  severity: "High" | "Medium" | "Low";
  category:
    "Shrinkage" | "Cashier Fraud" | "Margin Erosion" | "Off-Hours Activity";
  title: string;
  description: string;
  metric?: string;
  actorName?: string;
  recommendedAction: string;
}

export interface SentinelReport {
  scannedAt: string;
  findings: SentinelFinding[];
  overallRiskScore: "Low" | "Medium" | "High";
  totalShrinkageValue: number; // in LKR cents
  totalMarginEroded: number; // in LKR cents
}

function getColomboHour(dateIso: string): number {
  const date = new Date(dateIso);
  const colomboStr = date.toLocaleString("en-US", {
    timeZone: "Asia/Colombo",
    hour: "numeric",
    hour12: false,
  });
  return parseInt(colomboStr, 10) || 0;
}

export function runStoreSentinel(workspace: Workspace): SentinelReport {
  const findings: SentinelFinding[] = [];
  let totalShrinkageValue = 0;
  let totalMarginEroded = 0;

  // 1. Detect Physical Cycle Count Shortages (Shrinkage)
  for (const count of workspace.inventoryCounts || []) {
    if (count.status === "Approved") {
      let countShortage = 0;
      const missingItems: string[] = [];

      for (const line of count.lines) {
        if (line.counted < line.expected) {
          const diff = line.expected - line.counted;
          const loss = diff * line.unitCost;
          countShortage += loss;
          missingItems.push(`${line.productName} (-${diff} units)`);
        }
      }

      if (countShortage > 0) {
        totalShrinkageValue += countShortage;
        const rsLost = (countShortage / 100).toLocaleString("en-LK", {
          minimumFractionDigits: 2,
        });

        findings.push({
          id: `shrink-${count.id}`,
          severity: countShortage > 500000 ? "High" : "Medium", // > Rs. 5,000
          category: "Shrinkage",
          title: `Stock count variance shortage: Rs. ${rsLost}`,
          description: `Cycle count ${count.number} recorded missing inventory across: ${missingItems.slice(0, 3).join(", ")}${missingItems.length > 3 ? "..." : ""}.`,
          metric: `-Rs. ${rsLost}`,
          actorName: count.approvedByName || count.createdByName,
          recommendedAction:
            "Audit shelf security and review CCTV footage for the affected stock category.",
        });
      }
    }
  }

  // 2. Detect Cashier Return / Void Anomalies
  const returnsByStaff: Record<
    string,
    { count: number; totalAmount: number; name: string }
  > = {};
  for (const ret of workspace.returns || []) {
    const sale = workspace.sales.find((s) => s.id === ret.saleId);
    const staffId = sale?.staffId || "unassigned";
    const staffName = sale?.staffName || "Staff";

    if (!returnsByStaff[staffId]) {
      returnsByStaff[staffId] = { count: 0, totalAmount: 0, name: staffName };
    }
    returnsByStaff[staffId].count++;
    returnsByStaff[staffId].totalAmount += ret.total;
  }

  for (const [staffId, stats] of Object.entries(returnsByStaff)) {
    if (stats.count >= 3 && stats.totalAmount > 1000000) {
      // 3+ returns totaling > Rs. 10,000
      const rsTotal = (stats.totalAmount / 100).toLocaleString("en-LK", {
        minimumFractionDigits: 2,
      });

      findings.push({
        id: `fraud-return-${staffId}`,
        severity: "High",
        category: "Cashier Fraud",
        title: `Frequent cash invoice returns by ${stats.name}`,
        description: `${stats.name} has processed ${stats.count} customer returns totaling Rs. ${rsTotal}. Verify whether customer signatures or proof of return exist.`,
        metric: `${stats.count} returns (Rs. ${rsTotal})`,
        actorName: stats.name,
        recommendedAction:
          "Cross-examine return receipts with physical returned stock in the shop bin.",
      });
    }
  }

  // 3. Detect Margin Erosion & Deep Below-Cost Sales
  const salesWithOverrides = (workspace.sales || []).filter(
    (sale) =>
      sale.status !== "Returned" &&
      sale.lines?.some(
        (l) => l.overrideReason || (l.unitDiscount && l.unitDiscount > 0),
      ),
  );

  let overrideCount = 0;
  let lostProfit = 0;
  for (const sale of salesWithOverrides) {
    for (const line of sale.lines || []) {
      if (line.originalPrice && line.price < line.originalPrice) {
        const lineLoss = (line.originalPrice - line.price) * line.quantity;
        lostProfit += lineLoss;
        overrideCount++;
      }
    }
  }

  if (lostProfit > 500000) {
    // > Rs. 5,000
    totalMarginEroded += lostProfit;
    const rsLost = (lostProfit / 100).toLocaleString("en-LK", {
      minimumFractionDigits: 2,
    });

    findings.push({
      id: "margin-erosion-general",
      severity: lostProfit > 2000000 ? "High" : "Medium",
      category: "Margin Erosion",
      title: `Manual price overrides reduced profit by Rs. ${rsLost}`,
      description: `${overrideCount} line items had prices discounted or manually overridden below standard pricing tiers.`,
      metric: `-Rs. ${rsLost}`,
      recommendedAction:
        "Check Team permissions for 'sales.priceOverride' and enforce discount ceilings.",
    });
  }

  // 4. Detect Off-Hours Stock Adjustments & Movements
  const suspiciousMovements = (workspace.inventoryMovements || []).filter(
    (m) => {
      if (
        m.type !== "Damage" &&
        m.type !== "Loss" &&
        m.type !== "Count adjustment"
      ) {
        return false;
      }
      const hour = getColomboHour(m.createdAt);
      return hour >= 21 || hour < 8; // Between 9:00 PM and 8:00 AM
    },
  );

  if (suspiciousMovements.length > 0) {
    findings.push({
      id: "off-hours-movement",
      severity: "Medium",
      category: "Off-Hours Activity",
      title: `${suspiciousMovements.length} stock write-offs / adjustments during off-hours`,
      description: `Stock was modified outside regular business hours (between 9:00 PM and 8:00 AM) by: ${Array.from(new Set(suspiciousMovements.map((m) => m.actorName || "Unknown"))).join(", ")}.`,
      metric: `${suspiciousMovements.length} off-hour adjustments`,
      recommendedAction:
        "Verify why inventory was adjusted outside operational shop hours.",
    });
  }

  // Calculate Overall Risk Score
  const highCount = findings.filter((f) => f.severity === "High").length;
  const mediumCount = findings.filter((f) => f.severity === "Medium").length;
  const overallRiskScore =
    highCount > 0 ? "High" : mediumCount > 0 ? "Medium" : "Low";

  return {
    scannedAt: new Date().toISOString(),
    findings,
    overallRiskScore,
    totalShrinkageValue,
    totalMarginEroded,
  };
}

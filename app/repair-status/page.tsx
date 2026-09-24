"use client";

import { useEffect, useState } from "react";
import { Check, Clock, Wrench, PackageCheck, AlertCircle } from "lucide-react";

type PublicRepair = {
  number: string;
  device: string;
  issue: string;
  status: string;
  estimate: number;
  paid: number;
  estimateRevision: number;
  warrantyDays: number;
  createdAt: string;
  completedAt?: string;
  canDecide: boolean;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(
    amount / 100,
  );

const STAGES = [
  { id: "received", label: "Received", icon: Clock },
  { id: "diagnosing", label: "Diagnosis", icon: Wrench },
  { id: "approval", label: "Approval", icon: Check },
  { id: "progress", label: "In Repair", icon: Wrench },
  { id: "ready", label: "Ready", icon: PackageCheck },
];

function getStageIndex(status: string): number {
  switch (status) {
    case "Received":
      return 0;
    case "Diagnosing":
      return 1;
    case "Awaiting approval":
    case "Approved":
    case "Declined":
      return 2;
    case "In progress":
      return 3;
    case "Ready for collection":
      return 4;
    case "Collected":
      return 5;
    default:
      return 0;
  }
}

export default function RepairStatusPage() {
  const [token, setToken] = useState("");
  const [repair, setRepair] = useState<PublicRepair | null>(null);
  const [message, setMessage] = useState("Opening your secure repair link…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const value =
      new URLSearchParams(location.hash.slice(1)).get("token") || "";
    history.replaceState(null, "", "/repair-status");
    setToken(value);
    if (!value) return setMessage("This repair link is missing or invalid.");
    fetch("/api/repair-portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "status", token: value }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Unable to open this repair link.");
        setRepair(data.repair);
        setMessage("");
      })
      .catch((error) => setMessage(error.message));
  }, []);

  async function decide(decision: "Approved" | "Declined") {
    if (
      !repair ||
      !confirm(
        `Confirm that you want to ${decision.toLowerCase()} this estimate?`,
      )
    )
      return;
    setBusy(true);
    const response = await fetch("/api/repair-portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "decision",
        token,
        decision,
        estimateRevision: repair.estimateRevision,
      }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok)
      return setMessage(data.error || "Unable to record your decision.");
    setRepair({ ...repair, status: decision, canDecide: false });
    setMessage(
      `Your estimate was ${decision.toLowerCase()}. The shop has been updated.`,
    );
  }

  const currentStage = repair ? getStageIndex(repair.status) : 0;
  const isDeclined = repair?.status === "Declined";

  return (
    <main className="public-repair-page">
      <section className="public-repair-card">
        <div className="public-repair-brand">
          fido <span>LK</span>
        </div>
        {repair ? (
          <>
            <p className="eyebrow">REPAIR STATUS</p>
            <h1>{repair.device}</h1>
            <strong className="public-repair-number">{repair.number}</strong>

            {/* Visual Stepper */}
            <div
              style={{
                margin: "24px 0 16px 0",
                padding: "16px 12px",
                background: "#f8fafc",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  position: "relative",
                  marginBottom: "8px",
                }}
              >
                {/* Connecting track line */}
                <div
                  style={{
                    position: "absolute",
                    top: "14px",
                    left: "20px",
                    right: "20px",
                    height: "3px",
                    background: "#e2e8f0",
                    zIndex: 0,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "14px",
                    left: "20px",
                    width: `${Math.min(100, Math.max(0, (currentStage / (STAGES.length - 1)) * 100))}%`,
                    height: "3px",
                    background: isDeclined ? "#ef4444" : "#2563eb",
                    zIndex: 0,
                    transition: "width 0.4s ease",
                  }}
                />

                {STAGES.map((stage, idx) => {
                  const isDone = currentStage > idx;
                  const isCurrent = currentStage === idx;
                  return (
                    <div
                      key={stage.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        position: "relative",
                        zIndex: 1,
                        width: "60px",
                      }}
                    >
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "50%",
                          background:
                            isDeclined && isCurrent
                              ? "#ef4444"
                              : isDone || isCurrent
                                ? "#2563eb"
                                : "#fff",
                          border: `2px solid ${
                            isDeclined && isCurrent
                              ? "#ef4444"
                              : isDone || isCurrent
                                ? "#2563eb"
                                : "#cbd5e1"
                          }`,
                          color: isDone || isCurrent ? "#fff" : "#94a3b8",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "12px",
                          fontWeight: 700,
                          boxShadow: isCurrent
                            ? "0 0 0 4px rgba(37,99,235,0.18)"
                            : "none",
                        }}
                      >
                        {isDone ? (
                          <Check size={14} strokeWidth={3} />
                        ) : isDeclined && isCurrent ? (
                          <AlertCircle size={14} />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: isCurrent ? 700 : 500,
                          color: isCurrent ? "#0f172a" : "#64748b",
                          marginTop: "6px",
                          textAlign: "center",
                          lineHeight: "1.2",
                        }}
                      >
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="public-repair-status"
              style={{
                background: isDeclined
                  ? "#fef2f2"
                  : repair.status === "Ready for collection"
                    ? "#ecfdf5"
                    : "#eaf1ff",
                color: isDeclined
                  ? "#991b1b"
                  : repair.status === "Ready for collection"
                    ? "#065f46"
                    : "#2459d6",
              }}
            >
              {repair.status === "Ready for collection"
                ? "✨ Ready for Collection at Shop"
                : isDeclined
                  ? "Estimate Declined"
                  : repair.status}
            </div>

            <dl>
              <div>
                <dt>Reported issue</dt>
                <dd>{repair.issue}</dd>
              </div>
              <div>
                <dt>Current estimate</dt>
                <dd>{money(repair.estimate)}</dd>
              </div>
              <div>
                <dt>Recorded payments</dt>
                <dd>{money(repair.paid)}</dd>
              </div>
              <div>
                <dt>Warranty</dt>
                <dd>
                  {repair.warrantyDays
                    ? `${repair.warrantyDays} days`
                    : "Not included"}
                </dd>
              </div>
            </dl>
            {repair.canDecide && (
              <div className="public-repair-actions">
                <p>
                  Review the estimate above before deciding. Approval authorizes
                  the shop to proceed.
                </p>
                <button
                  disabled={busy}
                  className="primary"
                  onClick={() => decide("Approved")}
                >
                  Approve estimate
                </button>
                <button
                  disabled={busy}
                  className="secondary"
                  onClick={() => decide("Declined")}
                >
                  Decline
                </button>
              </div>
            )}
          </>
        ) : null}
        {message && (
          <p className="public-repair-message" role="status">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}

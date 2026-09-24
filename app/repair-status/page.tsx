"use client";

import { useEffect, useState } from "react";

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
            <div className="public-repair-status">{repair.status}</div>
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

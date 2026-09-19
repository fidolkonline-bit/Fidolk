"use client";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BusFront,
  MapPin,
  Phone,
  Volume2,
  WalletCards,
} from "lucide-react";
import type { Alert } from "@/lib/types";
import { shouldAlarm, startAlarm } from "@/lib/alerts";
import styles from "./arrival-alarm.module.css";

const money = (amount: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount / 100);

export function ArrivalAlarm({
  alerts,
  user,
  acknowledge,
  openAlerts,
  compact = false,
}: {
  alerts: Alert[];
  user: { id: string; permissions: string[] };
  acknowledge: (id: string) => Promise<boolean>;
  openAlerts: () => void;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(0.6);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const context = useRef<AudioContext | null>(null);
  const notified = useRef(new Set<string>());
  const active = alerts
    .filter((a) => shouldAlarm(a, user, now))
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const ringing = active.length > 0;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    return () => {
      void context.current?.close();
      context.current = null;
    };
  }, []);
  useEffect(() => {
    if (!testing) return;
    const timer = setTimeout(() => setTesting(false), 3000);
    return () => clearTimeout(timer);
  }, [testing]);
  useEffect(() => {
    if (!enabled || (!ringing && !testing) || !context.current) return;
    return startAlarm(context.current, volume);
  }, [enabled, ringing, testing, volume]);
  useEffect(() => {
    for (const alert of active) {
      if (notified.current.has(alert.id)) continue;
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(alert.title, {
            body: `${alert.busRoute || "Arrival"} · ${alert.arrivalLocation || "Open Fido LK to acknowledge"}`,
            tag: alert.id,
            requireInteraction: true,
          });
        } catch {
          /* Mobile browsers use registered background push instead. */
        }
      }
      notified.current.add(alert.id);
    }
  }, [active]);
  async function enable(test = false) {
    setError("");
    try {
      if (!context.current || context.current.state === "closed") {
        context.current = new AudioContext();
        context.current.onstatechange = () => {
          if (context.current?.state !== "running") setEnabled(false);
        };
      }
      await context.current.resume();
      if (context.current.state !== "running")
        throw Error(
          "Sound was paused by the browser. Click Enable alarm again.",
        );
      setEnabled(true);
      if (test) setTesting(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "This browser cannot enable alarm audio.",
      );
    }
  }
  return (
    <section
      className={`${styles.alarm} ${ringing ? styles.ringing : styles.idle} ${compact ? styles.compact : ""}`}
      aria-label="Arrival alarm"
    >
      <div className={styles.heading}>
        <div>
          <strong>
            <Bell size={18} />
            {ringing
              ? `${active.length} pickup${active.length === 1 ? "" : "s"} need a collector`
              : "Arrival alarm armed"}
          </strong>
          <p>
            {ringing
              ? "The alarm repeats until collection responsibility is accepted."
              : enabled
                ? "Listening for your assigned parcel arrivals."
                : "Enable sound on this device for repeating pickup reminders."}
          </p>
        </div>
        <button
          type="button"
          className={styles.controlToggle}
          aria-expanded={controlsOpen}
          onClick={() => setControlsOpen((open) => !open)}
        >
          {controlsOpen ? "Hide controls" : "Alarm controls"}
        </button>
        <div
          className={`${styles.controls} ${controlsOpen || ringing ? styles.controlsOpen : ""}`}
        >
          {!enabled && (
            <button className="primary" onClick={() => void enable()}>
              <Volume2 size={16} />
              Enable alarm
            </button>
          )}
          <button
            className="secondary"
            disabled={ringing || testing}
            onClick={() => void enable(true)}
          >
            {testing ? "Testing for 3 seconds…" : "Test alarm"}
          </button>
          <label className="alarm-volume">
            Volume
            <input
              aria-label="Alarm volume"
              type="range"
              min="10"
              max="100"
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
            />
          </label>
          <button className="text-button" onClick={openAlerts}>
            All alerts
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="pricing-error">
          {error}
        </p>
      )}
      {active.map((alert) => {
        const minutes = Math.ceil((Date.parse(alert.dueAt) - now) / 60000);
        const phone = alert.contactPhone?.replace(/[^+\d]/g, "");
        return (
          <div className={styles.pickupCard} key={alert.id}>
            <div className={styles.pickupLead}>
              <span>Expected {minutes > 0 ? "in" : "arrival passed"}</span>
              <strong>{minutes > 0 ? minutes : Math.abs(minutes)}</strong>
              <small>MIN{minutes > 0 ? "" : " LATE"}</small>
            </div>
            <div className={styles.pickupBody}>
              <div className={styles.pickupTitle}>
                <div>
                  <span>Pickup mode</span>
                  <h2>{alert.title}</h2>
                </div>
                <div className={styles.busPlate}>
                  <BusFront size={16} />{" "}
                  {alert.busRegistration || "Bus not recorded"}
                </div>
              </div>
              <div className={styles.pickupFacts}>
                <span>
                  <MapPin size={15} />{" "}
                  {alert.arrivalLocation ||
                    alert.busRoute ||
                    "Collection point not recorded"}
                </span>
                <span>
                  <WalletCards size={15} />{" "}
                  {alert.amountDue
                    ? `${money(alert.amountDue)} due`
                    : alert.paymentState || "Payment not recorded"}
                </span>
              </div>
              <small>
                ETA{" "}
                {new Date(alert.dueAt).toLocaleTimeString("en-GB", {
                  timeZone: "Asia/Colombo",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · {alert.assigneeName || "Shared alert"}
              </small>
            </div>
            <div className={styles.pickupActions}>
              {phone && (
                <a href={`tel:${phone}`} className={styles.call}>
                  <Phone size={16} /> Call conductor
                </a>
              )}
              <button
                className={styles.accept}
                disabled={pending !== null}
                onClick={async () => {
                  setPending(alert.id);
                  setError("");
                  try {
                    if (!(await acknowledge(alert.id)))
                      setError(
                        "Acceptance was not saved. The alarm remains active; check the connection and try again.",
                      );
                  } catch {
                    setError(
                      "Acceptance could not be saved. Check your connection and try again.",
                    );
                  } finally {
                    setPending(null);
                  }
                }}
              >
                {pending === alert.id ? "Saving…" : "I’ll collect it"}
              </button>
            </div>
          </div>
        );
      })}
      <small className={styles.disclaimer}>
        Repeating sound needs an open page and enabled audio. Closed-page push
        uses your device’s notification settings.
      </small>
    </section>
  );
}

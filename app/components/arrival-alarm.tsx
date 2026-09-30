"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, Phone, Volume2 } from "lucide-react";
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
  const soundControls = (
    <div className={styles.sound}>
      {!enabled ? (
        <button
          type="button"
          className={styles.soundOn}
          onClick={() => void enable()}
        >
          <Volume2 size={16} /> Turn on sound
        </button>
      ) : (
        <span className={styles.soundState}>
          <Volume2 size={15} /> Sound on
        </span>
      )}
      <button
        type="button"
        className={styles.soundLink}
        disabled={ringing || testing}
        onClick={() => void enable(true)}
      >
        {testing ? "Testing…" : "Test"}
      </button>
      <label className={styles.volume}>
        <span>Volume</span>
        <input
          aria-label="Alarm volume"
          type="range"
          min="10"
          max="100"
          value={Math.round(volume * 100)}
          onChange={(e) => setVolume(Number(e.target.value) / 100)}
        />
      </label>
    </div>
  );
  if (!ringing)
    return (
      <section
        className={`${styles.idle} ${compact ? styles.compact : ""}`}
        aria-label="Bus alarm"
      >
        <Bell size={17} />
        <span className={styles.idleText}>
          <strong>Bus alarm is on.</strong>{" "}
          {enabled
            ? "It rings here before each bus reaches our stop."
            : "Turn on sound so this device rings before a bus arrives."}
        </span>
        <button
          type="button"
          className={styles.soundLink}
          aria-expanded={controlsOpen}
          onClick={() => setControlsOpen((open) => !open)}
        >
          {controlsOpen ? "Hide" : "Sound settings"}
        </button>
        {(controlsOpen || !enabled) && soundControls}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </section>
    );
  return (
    <section className={styles.ringing} aria-label="Bus alarm" role="alert">
      {active.map((alert) => {
        const minutes = Math.ceil((Date.parse(alert.dueAt) - now) / 60000);
        const phone = alert.contactPhone?.replace(/[^+\d]/g, "");
        return (
          <div className={styles.banner} key={alert.id}>
            <span className={styles.bell} aria-hidden="true">
              <BellRing size={30} />
            </span>
            <div className={styles.text}>
              <strong>
                Bus {alert.busRegistration || alert.title}{" "}
                {minutes > 0
                  ? `arrives in ${minutes} min`
                  : minutes === 0
                    ? "is arriving now"
                    : `is ${Math.abs(minutes)} min late`}
              </strong>
              <span>
                {alert.arrivalLocation || alert.busRoute || "Our stop"} ·{" "}
                {alert.title}
                {alert.assigneeName
                  ? ` · ${alert.assigneeName} to collect`
                  : ""}
                {alert.amountDue && alert.paymentState !== "Paid"
                  ? ` · pay ${money(alert.amountDue)}`
                  : ""}
              </span>
            </div>
            {phone && (
              <a href={`tel:${phone}`} className={styles.call}>
                <Phone size={18} /> Call conductor
              </a>
            )}
            <button
              type="button"
              className={styles.accept}
              disabled={pending !== null}
              onClick={async () => {
                setPending(alert.id);
                setError("");
                try {
                  if (!(await acknowledge(alert.id)))
                    setError(
                      "That was not saved. The alarm keeps ringing; check the connection and try again.",
                    );
                } catch {
                  setError(
                    "That could not be saved. Check your connection and try again.",
                  );
                } finally {
                  setPending(null);
                }
              }}
            >
              {pending === alert.id ? "Saving…" : "I'm on my way"}
            </button>
          </div>
        );
      })}
      <div className={styles.foot}>
        {soundControls}
        <button type="button" className={styles.soundLink} onClick={openAlerts}>
          All parcels
        </button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </section>
  );
}

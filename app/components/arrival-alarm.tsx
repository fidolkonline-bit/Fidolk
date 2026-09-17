"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, Volume2 } from "lucide-react";
import type { Alert } from "@/lib/types";
import { shouldAlarm, startAlarm } from "@/lib/alerts";

export function ArrivalAlarm({
  alerts,
  user,
  acknowledge,
  openAlerts,
}: {
  alerts: Alert[];
  user: { id: string; permissions: string[] };
  acknowledge: (id: string) => Promise<boolean>;
  openAlerts: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(0.6);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
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
      className={`arrival-alarm ${ringing ? "arrival-alarm-active" : ""}`}
      aria-label="Arrival alarm"
    >
      <div className="arrival-alarm-heading">
        <div>
          <strong>
            <Bell size={18} />
            {ringing
              ? `${active.length} alert${active.length === 1 ? "" : "s"} need acknowledgement`
              : "Arrival alarm"}
          </strong>
          <p>
            {ringing
              ? "The alarm repeats until every active alert is acknowledged. Opening this page does not acknowledge it."
              : enabled
                ? "Sound armed for your assigned arrivals. Keep this page open."
                : "Enable alarm on this device to hear repeating arrival reminders."}
          </p>
        </div>
        <div className="row-buttons">
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
        return (
          <div className="arrival-alarm-item" key={alert.id}>
            <div>
              <strong>{alert.title}</strong>
              <p>
                {[alert.busRoute, alert.arrivalLocation]
                  .filter(Boolean)
                  .join(" · ") || "Arrival reminder"}
              </p>
              <small>
                {minutes > 0
                  ? `Expected in ${minutes} minute${minutes === 1 ? "" : "s"}`
                  : `Expected arrival passed · ${Math.abs(minutes)} min ago`}{" "}
                ·{" "}
                {new Date(alert.dueAt).toLocaleTimeString("en-GB", {
                  timeZone: "Asia/Colombo",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · {alert.assigneeName || "Shared alert"}
              </small>
            </div>
            <button
              className="primary"
              disabled={pending !== null}
              onClick={async () => {
                setPending(alert.id);
                setError("");
                try {
                  if (!(await acknowledge(alert.id)))
                    setError(
                      "Acknowledgement was not saved. The alarm remains active; check the connection and try again.",
                    );
                } catch {
                  setError(
                    "Acknowledgement could not be saved. Check your connection and try again.",
                  );
                } finally {
                  setPending(null);
                }
              }}
            >
              {pending === alert.id
                ? "Saving…"
                : "Acknowledge · I’ll collect it"}
            </button>
          </div>
        );
      })}
      <small>
        Repeating sound needs an open page and enabled audio. Closed-page push
        uses your device’s notification settings.
      </small>
    </section>
  );
}

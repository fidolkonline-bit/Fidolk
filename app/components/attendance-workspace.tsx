"use client";

import { useState, type FormEvent } from "react";
import type { AttendanceRecord, Workspace } from "@/lib/types";
import { approvedLeaveDays } from "@/lib/attendance";
import styles from "./attendance-workspace.module.css";

type Props = {
  data: Workspace;
  user: { id: string; name: string };
  canManage: boolean;
  busy: boolean;
  action: (
    type: string,
    payload: Record<string, unknown>,
  ) => Promise<Workspace | null>;
};

const day = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const time = (value?: string) =>
  value
    ? new Date(value).toLocaleTimeString("en-GB", {
        timeZone: "Asia/Colombo",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const localInput = (value?: string) =>
  value
    ? new Date(new Date(value).getTime() + 330 * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
const toIso = (value: string) =>
  value ? new Date(`${value}:00+05:30`).toISOString() : "";

export function AttendanceWorkspace({
  data,
  user,
  canManage,
  busy,
  action,
}: Props) {
  const [month, setMonth] = useState(day().slice(0, 7));
  const [correction, setCorrection] = useState<AttendanceRecord | null>(null);
  const [visitNote, setVisitNote] = useState("");
  const today = day();
  const myToday = data.attendance.find(
    (item) => item.userId === user.id && item.day === today,
  );
  const mine = data.attendance
    .filter((item) => item.userId === user.id)
    .slice()
    .sort((a, b) => b.day.localeCompare(a.day));
  const myLeave = data.leaveRequests
    .filter((item) => item.userId === user.id)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pending = data.leaveRequests
    .filter((item) => item.status === "Pending")
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const monthRecords = data.attendance.filter((item) =>
    item.day.startsWith(month),
  );
  const incomplete = data.attendance
    .filter((item) => !item.checkOutAt)
    .slice()
    .sort((a, b) => b.day.localeCompare(a.day));
  async function requestLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const saved = await action("requestLeave", {
      fromDay: values.get("fromDay"),
      toDay: values.get("toDay"),
      portion: values.get("portion"),
      reason: values.get("reason"),
    });
    if (saved) form.reset();
  }
  async function saveCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!correction) return;
    const values = new FormData(event.currentTarget);
    const saved = await action("correctAttendance", {
      id: correction.id,
      checkInAt: toIso(String(values.get("checkInAt"))),
      checkOutAt: toIso(String(values.get("checkOutAt"))),
      reason: values.get("reason"),
    });
    if (saved) setCorrection(null);
  }
  return (
    <div className={styles.stack}>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>My attendance</h2>
            <p>Times are shown in Sri Lanka time.</p>
          </div>
          <span>{today}</span>
        </div>
        <div className={styles.actions}>
          <button
            className="primary"
            disabled={busy || !!myToday}
            onClick={() => action("checkIn", {})}
          >
            Check in
          </button>
          <button
            className="secondary"
            disabled={busy || !myToday || !!myToday.checkOutAt}
            onClick={() => action("checkOut", {})}
          >
            Check out
          </button>
          <strong>
            {myToday
              ? `${time(myToday.checkInAt)} → ${myToday.checkOutAt ? time(myToday.checkOutAt) : "In progress"}`
              : "Not checked in today"}
          </strong>
        </div>
        {myToday && (
          <form
            className={styles.visit}
            onSubmit={async (event) => {
              event.preventDefault();
              if (await action("setVisitNote", { note: visitNote }))
                setVisitNote("");
            }}
          >
            <label>
              Work visit note{" "}
              <input
                value={visitNote}
                onChange={(event) => setVisitNote(event.target.value)}
                maxLength={300}
                placeholder={myToday.visitNote || "Where did you visit?"}
                required
              />
            </label>
            <button className="secondary" disabled={busy}>
              Save visit
            </button>
          </form>
        )}
        {myToday?.visitNote && (
          <p className={styles.muted}>Work visit: {myToday.visitNote}</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Request leave</h2>
            <p>Leave counts as approved only after an admin accepts it.</p>
          </div>
        </div>
        <form className={styles.form} onSubmit={requestLeave}>
          <label>
            From{" "}
            <input
              type="date"
              name="fromDay"
              min={today}
              defaultValue={today}
              required
            />
          </label>
          <label>
            To{" "}
            <input
              type="date"
              name="toDay"
              min={today}
              defaultValue={today}
              required
            />
          </label>
          <label>
            Duration{" "}
            <select name="portion">
              <option>Full day</option>
              <option>Half day</option>
            </select>
          </label>
          <label className={styles.wide}>
            Reason <input name="reason" maxLength={500} required />
          </label>
          <button className="primary" disabled={busy}>
            Send request
          </button>
        </form>
        <div className={styles.list}>
          <h3>My requests</h3>
          {myLeave.length ? (
            myLeave.map((item) => (
              <div className={styles.row} key={item.id}>
                <span>
                  <strong>
                    {item.fromDay}
                    {item.toDay !== item.fromDay ? ` to ${item.toDay}` : ""}
                  </strong>
                  <small>
                    {item.portion} · {item.reason}
                  </small>
                </span>
                <span>
                  {item.status}
                  {item.decidedBy ? ` · ${item.decidedBy}` : ""}
                  {item.decisionNote ? ` · ${item.decisionNote}` : ""}
                </span>
              </div>
            ))
          ) : (
            <p className={styles.muted}>No leave requests yet.</p>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>My recent days</h2>
        </div>
        <div className={styles.list}>
          {mine.slice(0, 14).length ? (
            mine.slice(0, 14).map((item) => (
              <div className={styles.row} key={item.id}>
                <strong>{item.day}</strong>
                <span>
                  {time(item.checkInAt)} →{" "}
                  {item.checkOutAt ? time(item.checkOutAt) : "Incomplete"}
                  {item.visitNote ? " · Work visit" : ""}
                  {item.correctionReason ? " · Corrected" : ""}
                </span>
              </div>
            ))
          ) : (
            <p className={styles.muted}>No attendance marked yet.</p>
          )}
        </div>
      </section>

      {canManage && (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Leave approvals</h2>
                <p>Pending requests need an admin decision.</p>
              </div>
              <strong>{pending.length} pending</strong>
            </div>
            <div className={styles.list}>
              {pending.length ? (
                pending.map((item) => (
                  <div className={styles.row} key={item.id}>
                    <span>
                      <strong>{item.userName}</strong>
                      <small>
                        {item.fromDay}
                        {item.toDay !== item.fromDay
                          ? ` to ${item.toDay}`
                          : ""}{" "}
                        · {item.portion} · {item.reason}
                      </small>
                    </span>
                    <span className={styles.actions}>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          action("decideLeave", {
                            id: item.id,
                            status: "Rejected",
                          })
                        }
                      >
                        Reject
                      </button>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          action("decideLeave", {
                            id: item.id,
                            status: "Approved",
                          })
                        }
                      >
                        Approve
                      </button>
                    </span>
                  </div>
                ))
              ) : (
                <p className={styles.muted}>No requests waiting.</p>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Today’s team</h2>
            </div>
            <div className={styles.list}>
              {data.attendance
                .filter((item) => item.day === today)
                .map((item) => (
                  <div className={styles.row} key={item.id}>
                    <span>
                      <strong>{item.userName}</strong>
                      <small>
                        {time(item.checkInAt)} →{" "}
                        {item.checkOutAt
                          ? time(item.checkOutAt)
                          : "In progress"}
                        {item.visitNote ? ` · Visit: ${item.visitNote}` : ""}
                      </small>
                    </span>
                    <button
                      className="text-button"
                      onClick={() => setCorrection(item)}
                    >
                      Correct
                    </button>
                  </div>
                ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Incomplete days</h2>
            </div>
            <div className={styles.list}>
              {incomplete.length ? (
                incomplete.slice(0, 30).map((item) => (
                  <div className={styles.row} key={item.id}>
                    <span>
                      <strong>
                        {item.userName} · {item.day}
                      </strong>
                      <small>
                        Checked in {time(item.checkInAt)} · No check-out
                      </small>
                    </span>
                    <button
                      className="text-button"
                      onClick={() => setCorrection(item)}
                    >
                      Correct
                    </button>
                  </div>
                ))
              ) : (
                <p className={styles.muted}>No incomplete days.</p>
              )}
            </div>
          </section>
          {correction && (
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  Correct {correction.userName} · {correction.day}
                </h2>
                <button
                  className="text-button"
                  onClick={() => setCorrection(null)}
                >
                  Cancel
                </button>
              </div>
              <form className={styles.form} onSubmit={saveCorrection}>
                <label>
                  Check in{" "}
                  <input
                    name="checkInAt"
                    type="datetime-local"
                    defaultValue={localInput(correction.checkInAt)}
                    required
                  />
                </label>
                <label>
                  Check out{" "}
                  <input
                    name="checkOutAt"
                    type="datetime-local"
                    defaultValue={localInput(correction.checkOutAt)}
                  />
                </label>
                <label className={styles.wide}>
                  Reason <input name="reason" maxLength={500} required />
                </label>
                <button className="primary" disabled={busy}>
                  Save correction
                </button>
              </form>
            </section>
          )}
        </>
      )}
      {(canManage || data.users?.length) && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Monthly attendance summary</h2>
            <label>
              Month{" "}
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </label>
          </div>
          <div className={styles.list}>
            {(data.users || [])
              .filter((item) => item.active)
              .map((item) => {
                const records = monthRecords.filter(
                  (record) => record.userId === item.id,
                );
                const leave = approvedLeaveDays(
                  data.leaveRequests,
                  item.id,
                  month,
                );
                return (
                  <div className={styles.row} key={item.id}>
                    <strong>{item.name}</strong>
                    <span>
                      {records.length} worked ·{" "}
                      {records.filter((record) => !record.checkOutAt).length}{" "}
                      incomplete · {leave} approved leave day
                      {leave === 1 ? "" : "s"}
                    </span>
                  </div>
                );
              })}
          </div>
          <p className={styles.muted}>
            For review only. Payroll pay is unchanged.
          </p>
        </section>
      )}
    </div>
  );
}

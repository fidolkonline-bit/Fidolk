"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BusFront,
  Check,
  CheckCircle2,
  Phone,
  Plus,
  ReceiptText,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import { canAcknowledgeAlert } from "@/lib/alerts";
import type { Alert, Repair, Sms } from "@/lib/types";
import styles from "./bus-alert-workspace.module.css";

type User = { id: string; name: string; permissions: string[] };
type Filter = "Active" | "Collected" | "All";

function JourneyField({
  label,
  name,
  required,
  type = "text",
  children,
  placeholder,
  min,
  defaultValue,
}: {
  label: string;
  name: string;
  required?: boolean;
  type?: string;
  children?: ReactNode;
  placeholder?: string;
  min?: number;
  defaultValue?: string | number;
}) {
  return (
    <label className={styles.journeyField}>
      <span>{label}</span>
      {children ? (
        <select name={name} required={required} defaultValue={defaultValue}>
          {children}
        </select>
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          min={min}
          defaultValue={defaultValue}
        />
      )}
    </label>
  );
}

export function JourneyFormFields({
  users,
  repairs,
}: {
  users: { id: string; name: string; active: boolean }[];
  repairs: Repair[];
}) {
  return (
    <div className={styles.dispatchForm}>
      <div className={styles.stageRail} aria-label="Journey setup stages">
        {["Parcel", "Bus", "Handover"].map((stage, index) => (
          <div key={stage}>
            <span>{index + 1}</span>
            <strong>{stage}</strong>
          </div>
        ))}
      </div>

      <fieldset className={styles.formStage}>
        <legend>
          <span>01</span>
          <div>
            <strong>Parcel</strong>
            <small>What is travelling?</small>
          </div>
        </legend>
        <div className={styles.formGrid}>
          <JourneyField
            label="Item / journey title"
            name="title"
            defaultValue="Collect incoming spare part"
            required
          />
          <JourneyField label="Linked repair (optional)" name="repairId">
            <option value="">No linked repair</option>
            {repairs
              .filter(
                (repair) => !["Collected", "Declined"].includes(repair.status),
              )
              .map((repair) => (
                <option key={repair.id} value={repair.id}>
                  {repair.number} · {repair.device}
                </option>
              ))}
          </JourneyField>
        </div>
        <label className={styles.journeyField}>
          <span>Parcel description</span>
          <textarea
            name="parcelDescription"
            maxLength={500}
            placeholder="Colour, quantity, packaging or identifying details"
          />
        </label>
        <div className={styles.traitChecks}>
          <span>Handling labels</span>
          <div>
            {["Fragile", "Heavy", "Valuable", "Urgent"].map((trait) => (
              <label key={trait}>
                <input type="checkbox" name="packageTraits" value={trait} />
                <span>{trait}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={styles.formGrid}>
          <JourneyField
            label="Payment state"
            name="paymentState"
            defaultValue="Paid"
          >
            <option>Paid</option>
            <option>Due on collection</option>
            <option>Partial</option>
            <option>Unknown</option>
          </JourneyField>
          <JourneyField
            label="Amount due (LKR)"
            name="amountDue"
            type="number"
            min={0}
            defaultValue={0}
          />
        </div>
      </fieldset>

      <fieldset className={styles.formStage}>
        <legend>
          <span>02</span>
          <div>
            <strong>Bus</strong>
            <small>Recognise the right vehicle</small>
          </div>
        </legend>
        <div className={styles.formGrid}>
          <JourneyField
            label="Bus registration"
            name="busRegistration"
            placeholder="NB-4821"
            required
          />
          <JourneyField
            label="Route / bus details"
            name="busRoute"
            placeholder="Kandy → Matale"
            required
          />
          <JourneyField
            label="Departure location"
            name="originLocation"
            placeholder="Kandy bus stand"
          />
          <JourneyField
            label="Expected arrival (Sri Lanka time)"
            name="dueAt"
            type="datetime-local"
            required
          />
          <JourneyField
            label="Driver / conductor name"
            name="contactName"
            placeholder="Sunil"
          />
          <JourneyField
            label="Primary phone"
            name="contactPhone"
            type="tel"
            placeholder="071 234 5678"
          />
          <JourneyField
            label="Secondary phone"
            name="secondaryPhone"
            type="tel"
            placeholder="Optional backup"
          />
        </div>
      </fieldset>

      <fieldset className={styles.formStage}>
        <legend>
          <span>03</span>
          <div>
            <strong>Handover</strong>
            <small>Who collects, where and when?</small>
          </div>
        </legend>
        <div className={styles.formGrid}>
          <JourneyField
            label="Collection location"
            name="arrivalLocation"
            placeholder="Matale Central Bus Stand"
            required
          />
          <JourneyField
            label="Assigned staff member"
            name="assigneeUserId"
            required
          >
            <option value="">Choose a staff account</option>
            {users
              .filter((user) => user.active)
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
          </JourneyField>
          <JourneyField
            label="Alert before arrival (minutes)"
            name="minutesBefore"
            type="number"
            min={0}
            defaultValue={10}
          />
        </div>
        <label className={styles.journeyField}>
          <span>Pickup instructions</span>
          <textarea
            name="pickupInstructions"
            maxLength={500}
            placeholder="Main entrance, near the clock. Ask for the blue parcel."
          />
        </label>
      </fieldset>
      <p className={styles.formNote}>
        The assigned collector must accept responsibility before collection can
        be verified. Progress is estimated from dispatch and arrival time.
      </p>
    </div>
  );
}

const money = (amount: number) =>
  new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount / 100);

const time = (value: string) =>
  new Date(value).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
  });

function isToday(value?: string) {
  if (!value) return false;
  return (
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(
      new Date(value),
    ) ===
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(
      new Date(),
    )
  );
}

function journeyProgress(alert: Alert, now: number) {
  if (alert.status === "Collected") return 100;
  const start = Date.parse(alert.createdAt);
  const end = Date.parse(alert.dueAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    return alert.status === "Acknowledged" ? 78 : 18;
  return Math.max(5, Math.min(96, ((now - start) / (end - start)) * 100));
}

function relativeArrival(alert: Alert, now: number) {
  if (alert.status === "Collected") return "Verified";
  if (alert.status === "Cancelled") return "Closed";
  const minutes = Math.ceil((Date.parse(alert.dueAt) - now) / 60000);
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return `${hours}h ${remaining}m`;
  }
  if (minutes > 0) return `${minutes} min`;
  if (minutes === 0) return "Due now";
  return `${Math.abs(minutes)} min late`;
}

function tone(alert: Alert, now: number) {
  if (alert.status === "Collected") return "collected";
  if (alert.status === "Cancelled") return "cancelled";
  if (alert.status === "Escalated" || Date.parse(alert.dueAt) < now)
    return "problem";
  if (
    alert.status === "Due" ||
    now >= Date.parse(alert.dueAt) - alert.minutesBefore * 60000
  )
    return "due";
  if (alert.status === "Acknowledged") return "accepted";
  return "scheduled";
}

function statusLabel(alert: Alert, now: number) {
  const state = tone(alert, now);
  if (state === "collected") return "Verified collected";
  if (state === "cancelled") return "Journey cancelled";
  if (state === "problem") return "Needs attention";
  if (state === "due") return "Arriving soon";
  if (state === "accepted") return "Collector en route";
  return "Scheduled";
}

function CollectionPanel({
  alert,
  busy,
  onCollect,
}: {
  alert: Alert;
  busy: boolean;
  onCollect: (id: string, amount: number, note: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(
    alert.amountDue ? String(alert.amountDue / 100) : "0",
  );
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);

  if (!open)
    return (
      <button
        type="button"
        className={styles.collectButton}
        onClick={() => setOpen(true)}
      >
        <CheckCircle2 size={17} />
        Confirm collection
      </button>
    );

  return (
    <form
      className={styles.collectionPanel}
      onSubmit={async (event) => {
        event.preventDefault();
        setConfirming(true);
        await onCollect(
          alert.id,
          Math.max(0, Math.round(Number(amount || 0) * 100)),
          note,
        );
        setConfirming(false);
      }}
    >
      <div className={styles.collectionIntro}>
        <ShieldCheck size={20} />
        <div>
          <strong>Verify the handover</strong>
          <span>Check the parcel and record the actual payment.</span>
        </div>
      </div>
      <div className={styles.collectionFields}>
        <label>
          <span>Amount paid (LKR)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Collection note (optional)</span>
          <input
            value={note}
            maxLength={500}
            placeholder="Box intact, quantity checked…"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>
      <div className={styles.collectionActions}>
        <button
          type="button"
          className="text-button"
          onClick={() => setOpen(false)}
        >
          Back
        </button>
        <button className="primary" disabled={busy || confirming}>
          <Check size={16} />
          {confirming ? "Verifying…" : "Parcel received"}
        </button>
      </div>
    </form>
  );
}

function JourneyCard({
  alert,
  now,
  user,
  canManage,
  busy,
  onAcknowledge,
  onEscalate,
  onCollect,
}: {
  alert: Alert;
  now: number;
  user: User;
  canManage: boolean;
  busy: boolean;
  onAcknowledge: (id: string) => Promise<unknown>;
  onEscalate: (id: string) => Promise<unknown>;
  onCollect: (id: string, amount: number, note: string) => Promise<unknown>;
}) {
  const state = tone(alert, now);
  const progress = journeyProgress(alert, now);
  const canRespond = canAcknowledgeAlert(alert, user);
  const phone = alert.contactPhone?.replace(/[^+\d]/g, "");
  const origin =
    alert.originLocation ||
    alert.busRoute?.split(/\s(?:to|→|-)\s/i)[0] ||
    "Origin";
  const destination = alert.arrivalLocation || "Shop pickup";
  const terminal = ["Collected", "Cancelled"].includes(alert.status);
  const alarmAt = new Date(
    Date.parse(alert.dueAt) - alert.minutesBefore * 60000,
  ).toISOString();
  const paymentLabel =
    alert.status === "Collected"
      ? alert.actualAmountPaid
        ? `Paid ${money(alert.actualAmountPaid)}`
        : alert.paymentState === "Paid"
          ? "Paid before pickup"
          : "Nothing paid"
      : alert.paymentState === "Paid"
        ? "Already paid"
        : alert.amountDue
          ? `Pay ${money(alert.amountDue)}`
          : "Nothing to pay";

  return (
    <article className={`${styles.ticket} ${styles[state]}`}>
      <span
        className={`${styles.notch} ${styles.notchTop}`}
        aria-hidden="true"
      />
      <span
        className={`${styles.notch} ${styles.notchBottom}`}
        aria-hidden="true"
      />
      <div className={styles.stub}>
        <span className={styles.stubLabel}>BUS</span>
        <strong className={styles.reg}>{alert.busRegistration || "—"}</strong>
        <span className={styles.eta}>
          {alert.status === "Collected" && alert.collectedAt
            ? time(alert.collectedAt)
            : relativeArrival(alert, now)}
        </span>
      </div>
      <div className={styles.body}>
        <div className={styles.titleRow}>
          <div>
            <h3>{alert.title}</h3>
            <p>
              {alert.parcelDescription ? `${alert.parcelDescription} · ` : ""}
              {alert.busRoute || `${origin} → ${destination}`}
            </p>
          </div>
          <span className={styles.chip}>
            {state === "problem" && <AlertTriangle size={13} />}
            {statusLabel(alert, now)}
          </span>
        </div>

        {!terminal && (
          <div className={styles.progress}>
            <div className={styles.track}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className={styles.times}>
              <span>left {time(alert.createdAt)}</span>
              <span>alarm {time(alarmAt)}</span>
              <span>
                {destination} {time(alert.dueAt)}
              </span>
            </div>
          </div>
        )}

        {!!alert.packageTraits?.length && (
          <div className={styles.traits} aria-label="Package handling labels">
            {alert.packageTraits.map((trait) => (
              <span key={trait}>{trait}</span>
            ))}
          </div>
        )}

        {alert.status === "Collected" ? (
          <p className={styles.done}>
            <ReceiptText size={16} />
            Collected by {alert.collectedByName || "staff"}
            {alert.collectionNote ? ` · ${alert.collectionNote}` : ""} ·{" "}
            {paymentLabel}
          </p>
        ) : alert.status === "Cancelled" ? (
          <p className={styles.done}>
            <AlertTriangle size={16} /> Journey cancelled · nothing to collect
          </p>
        ) : (
          <div className={styles.footer}>
            <span className={styles.crew}>
              <strong>{alert.contactName || "Conductor"}</strong>
              <small>{alert.contactPhone || "No phone recorded"}</small>
            </span>
            <span className={styles.money}>{paymentLabel}</span>
            <span className={styles.collector}>
              <UserRoundCheck size={16} />
              {alert.assigneeName || "Anyone"}
            </span>
            <div className={styles.actions}>
              {phone && (
                <a className={styles.call} href={`tel:${phone}`}>
                  <Phone size={16} /> Call
                </a>
              )}
              {!["Acknowledged", "Cancelled"].includes(alert.status) &&
                canRespond && (
                  <button
                    type="button"
                    className={styles.accept}
                    disabled={busy}
                    onClick={() => void onAcknowledge(alert.id)}
                  >
                    I'll collect it
                  </button>
                )}
              {alert.status === "Acknowledged" && canRespond && (
                <CollectionPanel
                  alert={alert}
                  busy={busy}
                  onCollect={onCollect}
                />
              )}
              {canManage &&
                !["Acknowledged", "Escalated", "Cancelled"].includes(
                  alert.status,
                ) && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => void onEscalate(alert.id)}
                  >
                    Escalate
                  </button>
                )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function BusAlertWorkspace({
  alerts,
  sms,
  user,
  canManage,
  busy,
  pushControl,
  onNew,
  onAcknowledge,
  onEscalate,
  onCollect,
}: {
  alerts: Alert[];
  sms: Sms[];
  user: User;
  canManage: boolean;
  busy: boolean;
  pushControl: ReactNode;
  onNew: () => void;
  onAcknowledge: (id: string) => Promise<unknown>;
  onEscalate: (id: string) => Promise<unknown>;
  onCollect: (id: string, amount: number, note: string) => Promise<unknown>;
}) {
  const [filter, setFilter] = useState<Filter>("Active");
  const now = Date.now();
  const journeys = useMemo(
    () => alerts.filter((alert) => alert.type === "Bus arrival"),
    [alerts],
  );
  const reminders = alerts.filter((alert) => alert.type !== "Bus arrival");
  const active = journeys.filter(
    (alert) => !["Collected", "Cancelled"].includes(alert.status),
  );
  const collected = journeys.filter((alert) => alert.status === "Collected");
  const visible = journeys
    .filter((alert) =>
      filter === "Active"
        ? !["Collected", "Cancelled"].includes(alert.status)
        : filter === "Collected"
          ? alert.status === "Collected"
          : true,
    )
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const completedToday = collected.filter((alert) =>
    isToday(alert.collectedAt),
  ).length;

  return (
    <main className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <h1>Parcels on the bus</h1>
          <p>
            Stock and parts sent from town. The alarm rings before each bus
            reaches our stop.
          </p>
        </div>
        <div className={styles.headerActions}>
          {pushControl}
          {canManage && (
            <button type="button" className="primary" onClick={onNew}>
              <Plus size={18} /> New parcel
            </button>
          )}
        </div>
      </header>

      <div className={styles.filters} role="tablist" aria-label="Parcels">
        {(
          [
            ["Active", `On the way · ${active.length}`],
            ["Collected", `Collected · ${collected.length}`],
            ["All", `All · ${journeys.length}`],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            role="tab"
            key={value}
            aria-selected={filter === value}
            className={filter === value ? styles.on : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
        <span className={styles.today}>
          <CheckCircle2 size={15} /> {completedToday} collected today
        </span>
      </div>

      <section className={styles.list} aria-live="polite">
        {visible.map((alert) => (
          <JourneyCard
            alert={alert}
            now={now}
            user={user}
            canManage={canManage}
            busy={busy}
            onAcknowledge={onAcknowledge}
            onEscalate={onEscalate}
            onCollect={onCollect}
            key={alert.id}
          />
        ))}
        {!visible.length && (
          <div className={styles.empty}>
            <BusFront size={28} />
            <h2>
              {filter === "Active"
                ? "No parcels on the way"
                : `No ${filter.toLowerCase()} parcels`}
            </h2>
            <p>
              When a shop in town puts a parcel on a bus, add it here with the
              bus number and the conductor's phone. The alarm rings before it
              reaches our stop.
            </p>
            {canManage && (
              <button type="button" className="primary" onClick={onNew}>
                <Plus size={17} /> New parcel
              </button>
            )}
          </div>
        )}
      </section>

      {(reminders.length > 0 || sms.length > 0) && (
        <section className={styles.secondary}>
          {reminders.length > 0 && (
            <div className={styles.panel}>
              <h2>Other reminders</h2>
              {reminders.slice(0, 5).map((alert) => (
                <div className={styles.panelRow} key={alert.id}>
                  <span>
                    <strong>{alert.title}</strong>
                    <small>{alert.type}</small>
                  </span>
                  <span>{time(alert.dueAt)}</span>
                </div>
              ))}
            </div>
          )}
          {sms.length > 0 && (
            <div className={styles.panel}>
              <h2>Latest SMS</h2>
              {sms
                .slice(-5)
                .reverse()
                .map((message) => (
                  <div className={styles.panelRow} key={message.id}>
                    <span>
                      <strong>{message.phone}</strong>
                      <small>{message.message}</small>
                    </span>
                    <span className={styles.smsStatus}>{message.status}</span>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

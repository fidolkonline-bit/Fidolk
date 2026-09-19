"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BusFront,
  Check,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Phone,
  Plus,
  ReceiptText,
  Route,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  WalletCards,
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

function ParcelMonogram({ alert }: { alert: Alert }) {
  const initials = alert.title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <div className={styles.monogram} aria-hidden="true">
      <span>{initials || "PK"}</span>
      <Package size={18} />
    </div>
  );
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
  featured,
  busy,
  onAcknowledge,
  onEscalate,
  onCollect,
}: {
  alert: Alert;
  now: number;
  user: User;
  canManage: boolean;
  featured: boolean;
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
  const paymentLabel =
    alert.status === "Collected"
      ? alert.actualAmountPaid
        ? `${money(alert.actualAmountPaid)} paid`
        : alert.paymentState === "Paid"
          ? "Paid before pickup"
          : "No payment recorded"
      : alert.paymentState === "Paid"
        ? "Already paid"
        : alert.amountDue
          ? `${money(alert.amountDue)} due`
          : alert.paymentState || "Not recorded";

  return (
    <article
      className={`${styles.journeyCard} ${styles[state]} ${featured ? styles.featured : ""}`}
    >
      <div className={styles.cardTopline}>
        <span className={styles.statusPill}>
          {state === "problem" ? (
            <AlertTriangle size={13} />
          ) : (
            <Sparkles size={13} />
          )}
          {statusLabel(alert, now)}
        </span>
        <span className={styles.lastConfirmed}>
          {alert.status === "Acknowledged" && alert.acknowledgedAt
            ? `Accepted ${time(alert.acknowledgedAt)}`
            : alert.status === "Collected" && alert.collectedAt
              ? `Verified ${time(alert.collectedAt)}`
              : `Created ${time(alert.createdAt)}`}
        </span>
      </div>

      <div className={styles.cardHero}>
        <div className={styles.parcelIdentity}>
          <ParcelMonogram alert={alert} />
          <div>
            <span className={styles.microLabel}>
              {alert.status === "Collected"
                ? "Collected parcel"
                : alert.status === "Cancelled"
                  ? "Cancelled journey"
                  : "Incoming parcel"}
            </span>
            <h3>{alert.title}</h3>
            <p>{alert.parcelDescription || "Parcel details not recorded"}</p>
          </div>
        </div>
        <div className={styles.countdown}>
          <span>
            {alert.status === "Collected"
              ? "Collected at"
              : alert.status === "Cancelled"
                ? "Journey"
                : "Expected in"}
          </span>
          <strong>
            {alert.status === "Collected" && alert.collectedAt
              ? time(alert.collectedAt)
              : relativeArrival(alert, now)}
          </strong>
          <small>
            {terminal
              ? alert.status === "Collected"
                ? "Journey completed"
                : "No pickup required"
              : `ETA ${time(alert.dueAt)}`}
          </small>
        </div>
      </div>

      <div className={styles.routeBlock}>
        <div className={styles.routeMeta}>
          <span>
            <Route size={14} />
            {alert.status === "Collected"
              ? "Journey completed"
              : alert.status === "Cancelled"
                ? "Journey closed"
                : "Estimated progress"}
          </span>
          <small>
            {terminal
              ? alert.status === "Collected"
                ? "Parcel handover verified"
                : "Tracking ended"
              : `${Math.round(progress)}% · estimated from arrival time`}
          </small>
        </div>
        <div className={styles.routeRail}>
          <div className={styles.routeTrack} />
          <div className={styles.routeFill} style={{ width: `${progress}%` }} />
          <span className={`${styles.routeNode} ${styles.routeStart}`} />
          <span className={`${styles.routeNode} ${styles.routeEnd}`} />
          <span className={styles.busMarker} style={{ left: `${progress}%` }}>
            {alert.status === "Collected" ? (
              <Check size={15} />
            ) : alert.status === "Cancelled" ? (
              <AlertTriangle size={14} />
            ) : (
              <BusFront size={16} />
            )}
          </span>
        </div>
        <div className={styles.routeLabels}>
          <span>{origin}</span>
          <span>{destination}</span>
        </div>
      </div>

      <div className={styles.detailGrid}>
        <div className={styles.registration}>
          <span>Bus registration</span>
          <strong>{alert.busRegistration || "Not recorded"}</strong>
          <small>{alert.busRoute || `${origin} → ${destination}`}</small>
        </div>
        <div className={styles.detailItem}>
          <MapPin size={17} />
          <div>
            <span>Pickup point</span>
            <strong>{destination}</strong>
            {alert.pickupInstructions && (
              <small>{alert.pickupInstructions}</small>
            )}
          </div>
        </div>
        <div className={styles.detailItem}>
          <WalletCards size={17} />
          <div>
            <span>Payment</span>
            <strong>{paymentLabel}</strong>
            {alert.status === "Collected" && alert.amountDue !== undefined && (
              <small>Originally due {money(alert.amountDue)}</small>
            )}
          </div>
        </div>
        <div className={styles.detailItem}>
          <UserRoundCheck size={17} />
          <div>
            <span>Collector</span>
            <strong>{alert.assigneeName || "Shared assignment"}</strong>
            <small>
              {alert.status === "Collected"
                ? `Verified by ${alert.collectedByName || "staff"}`
                : alert.status === "Acknowledged"
                  ? "Responsibility accepted"
                  : "Waiting for acceptance"}
            </small>
          </div>
        </div>
      </div>

      {!!alert.packageTraits?.length && (
        <div className={styles.traits} aria-label="Package handling labels">
          {alert.packageTraits.map((trait) => (
            <span key={trait}>{trait}</span>
          ))}
        </div>
      )}

      {alert.status === "Collected" ? (
        <div className={styles.receiptLine}>
          <ReceiptText size={18} />
          <div>
            <strong>Collection verified</strong>
            <span>
              {alert.collectedAt
                ? new Date(alert.collectedAt).toLocaleString("en-GB", {
                    timeZone: "Asia/Colombo",
                  })
                : "Complete"}
              {alert.collectionNote ? ` · ${alert.collectionNote}` : ""}
            </span>
          </div>
        </div>
      ) : alert.status === "Cancelled" ? (
        <div className={`${styles.receiptLine} ${styles.cancelledReceipt}`}>
          <AlertTriangle size={18} />
          <div>
            <strong>Journey cancelled</strong>
            <span>Tracking ended · no pickup action required</span>
          </div>
        </div>
      ) : (
        <div className={styles.cardActions}>
          <div className={styles.contactActions}>
            {phone && (
              <a className={styles.callButton} href={`tel:${phone}`}>
                <Phone size={16} />
                Call {alert.contactName || "conductor"}
              </a>
            )}
            {!phone && (
              <span className={styles.noContact}>No phone recorded</span>
            )}
          </div>
          <div className={styles.primaryActions}>
            {!["Acknowledged", "Cancelled"].includes(alert.status) &&
              canRespond && (
                <button
                  type="button"
                  className={styles.acceptButton}
                  disabled={busy}
                  onClick={() => void onAcknowledge(alert.id)}
                >
                  <ArrowRight size={17} /> I’ll collect it
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
  const visible = journeys
    .filter((alert) =>
      filter === "Active"
        ? !["Collected", "Cancelled"].includes(alert.status)
        : filter === "Collected"
          ? alert.status === "Collected"
          : true,
    )
    .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const arriving = active.filter((alert) => {
    const remaining = Date.parse(alert.dueAt) - now;
    return remaining >= 0 && remaining <= 30 * 60000;
  }).length;
  const paymentDue = active.reduce(
    (total, alert) => total + (alert.amountDue || 0),
    0,
  );
  const completedToday = journeys.filter(
    (alert) => alert.status === "Collected" && isToday(alert.collectedAt),
  ).length;

  return (
    <main className={styles.workspace}>
      <header className={styles.missionHeader}>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}>
            <BusFront size={15} /> Parcel mission control
          </span>
          <h1>Parcel journeys</h1>
          <p>
            Track every handover, collector and payment in one clear journey.
          </p>
        </div>
        <div className={styles.headerActions}>
          {pushControl}
          {canManage && (
            <button type="button" className={styles.newJourney} onClick={onNew}>
              <Plus size={18} /> New journey
            </button>
          )}
        </div>
      </header>

      <section className={styles.summaryStrip} aria-label="Journey summary">
        <div>
          <span>
            <BusFront size={15} /> Active journeys
          </span>
          <strong>{active.length}</strong>
          <small>currently in motion</small>
        </div>
        <div className={arriving ? styles.summaryUrgent : ""}>
          <span>
            <Clock3 size={15} /> Arriving soon
          </span>
          <strong>{arriving}</strong>
          <small>within 30 minutes</small>
        </div>
        <div>
          <span>
            <WalletCards size={15} /> Payment due
          </span>
          <strong>{money(paymentDue)}</strong>
          <small>prepare before pickup</small>
        </div>
        <div className={styles.summaryComplete}>
          <span>
            <CheckCircle2 size={15} /> Completed today
          </span>
          <strong>{completedToday}</strong>
          <small>verified handovers</small>
        </div>
      </section>

      <div className={styles.filterRow}>
        <div className={styles.tabs} role="tablist" aria-label="Journey status">
          {(["Active", "Collected", "All"] as const).map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={filter === item}
              className={filter === item ? styles.selectedTab : ""}
              onClick={() => setFilter(item)}
              key={item}
            >
              {item}
              <span>
                {item === "Active"
                  ? active.length
                  : item === "Collected"
                    ? journeys.filter((alert) => alert.status === "Collected")
                        .length
                    : journeys.length}
              </span>
            </button>
          ))}
        </div>
        <span className={styles.updateNote}>
          <BellRing size={14} /> Status refreshes across devices
        </span>
      </div>

      <section className={styles.journeyList} aria-live="polite">
        {visible.length ? (
          visible.map((alert, index) => (
            <JourneyCard
              alert={alert}
              now={now}
              user={user}
              canManage={canManage}
              featured={index === 0 && filter === "Active"}
              busy={busy}
              onAcknowledge={onAcknowledge}
              onEscalate={onEscalate}
              onCollect={onCollect}
              key={alert.id}
            />
          ))
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Package size={28} />
            </div>
            <span>
              {filter === "Active"
                ? "The route is clear"
                : "No journeys here yet"}
            </span>
            <h2>
              {filter === "Active"
                ? "No active parcel journeys"
                : `No ${filter.toLowerCase()} journeys`}
            </h2>
            <p>
              Create a journey when a parcel is handed to a bus. Fido will keep
              the collector, payment and expected arrival in one calm view.
            </p>
            {canManage && (
              <button
                type="button"
                className={styles.newJourney}
                onClick={onNew}
              >
                <Plus size={17} /> Create the first journey
              </button>
            )}
          </div>
        )}
      </section>

      {(reminders.length > 0 || sms.length > 0) && (
        <section className={styles.secondaryArea}>
          {reminders.length > 0 && (
            <div className={styles.secondaryPanel}>
              <div className={styles.secondaryHeading}>
                <div>
                  <BellRing size={17} />
                  <strong>Other reminders</strong>
                </div>
                <span>{reminders.length}</span>
              </div>
              {reminders.slice(0, 5).map((alert) => (
                <div className={styles.secondaryRow} key={alert.id}>
                  <div>
                    <strong>{alert.title}</strong>
                    <span>{alert.type}</span>
                  </div>
                  <span>{time(alert.dueAt)}</span>
                </div>
              ))}
            </div>
          )}
          {sms.length > 0 && (
            <div className={styles.secondaryPanel}>
              <div className={styles.secondaryHeading}>
                <div>
                  <Phone size={17} />
                  <strong>SMS delivery</strong>
                </div>
                <span>Latest</span>
              </div>
              {sms
                .slice(-5)
                .reverse()
                .map((message) => (
                  <div className={styles.secondaryRow} key={message.id}>
                    <div>
                      <strong>{message.phone}</strong>
                      <span>{message.message}</span>
                    </div>
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

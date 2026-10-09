"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Check, Send, Smartphone, Volume2, X } from "lucide-react";
import type {
  Customer,
  PaymentMethod,
  ReloadRequest,
  Sale,
  Workspace,
} from "@/lib/types";
import { playSound, startSound } from "@/lib/alerts";
import { useAlertSound } from "./alert-sound";
import { NETWORKS, localPhone, networkFor } from "./reload-panel";
import styles from "./reload-requests.module.css";

type Act = (
  type: string,
  payload: Record<string, unknown>,
) => Promise<Workspace | null>;

const AMOUNTS = [100, 200, 500, 1000, 2000];
const METHODS: PaymentMethod[] = ["Cash", "Card", "Bank transfer", "Credit"];
const rs = (cents: number) => `Rs. ${(cents / 100).toLocaleString()}`;
const open = (r: ReloadRequest) => r.status === "Sent" || r.status === "Seen";
const what = (r: ReloadRequest) =>
  r.type === "Package" ? `${r.packageName} package` : r.type.toLowerCase();
const ago = (iso: string, now: number) => {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  return minutes < 1
    ? "just now"
    : minutes < 60
      ? `${minutes} min ago`
      : `${Math.round(minutes / 60)} h ago`;
};
const inDays = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

/**
 * The counter side: rings until each request from the owner is seen, then
 * lets the salesperson record the reload, its invoice and the payment.
 */
export function ReloadRequestAlarm({
  requests,
  customers,
  userId,
  providers,
  walletBalance,
  smsReady,
  showIdle,
  act,
  onInvoice,
}: {
  requests: ReloadRequest[];
  customers: Customer[];
  userId: string;
  providers: string[];
  walletBalance: (provider: string) => number;
  smsReady: boolean;
  /** Show the quiet "sound is on" line when nothing is waiting. */
  showIdle: boolean;
  act: Act;
  onInvoice: (sale: Sale) => void;
}) {
  const waiting = requests
    .filter((r) => open(r) && r.requestedById !== userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ringing = waiting.some((r) => r.status === "Sent");
  const [now, setNow] = useState(() => Date.now());
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");
  const sound = useAlertSound();
  const context = useRef<AudioContext | null>(null);
  const notified = useRef(new Set<string>());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  // Browsers only allow sound after a click, so the first click anywhere
  // on the page arms the alarm.
  useEffect(() => {
    const arm = () => void enable(true);
    document.addEventListener("pointerdown", arm, { once: true });
    return () => {
      document.removeEventListener("pointerdown", arm);
      void context.current?.close();
      context.current = null;
    };
  }, []);
  useEffect(() => {
    if (!enabled || !ringing || !context.current) return;
    return startSound(context.current, sound, 0.8);
  }, [enabled, ringing, sound]);
  useEffect(() => {
    for (const r of waiting) {
      if (r.status !== "Sent" || notified.current.has(r.id)) continue;
      notified.current.add(r.id);
      if ("Notification" in window && Notification.permission === "granted")
        try {
          new Notification(`Reload ${rs(r.amount)} to ${r.phone}`, {
            body: `${r.customerName} · from ${r.requestedByName || "the owner"}`,
            tag: r.id,
            requireInteraction: true,
          });
        } catch {
          /* Mobile browsers use registered background push instead. */
        }
    }
  }, [waiting]);

  async function enable(quiet = false) {
    if (!quiet) setError("");
    try {
      if (!context.current || context.current.state === "closed")
        context.current = new AudioContext();
      await context.current.resume();
      setEnabled(context.current.state === "running");
      return context.current.state === "running";
    } catch {
      if (!quiet) setError("This browser cannot play the reload sound.");
      return false;
    }
  }
  async function test() {
    if ((await enable()) && context.current)
      playSound(context.current, sound, 0.8);
  }

  if (!waiting.length)
    return showIdle ? (
      <section className={styles.idle} aria-label="Reload requests">
        <Smartphone size={17} />
        <span>
          <strong>Reload requests from the owner ring here.</strong>{" "}
          {enabled ? "Sound is on." : "Turn on sound so this computer rings."}
        </span>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => void test()}
        >
          <Volume2 size={16} /> {enabled ? "Test sound" : "Turn on sound"}
        </button>
        {error && <p role="alert">{error}</p>}
      </section>
    ) : null;

  return (
    <section
      className={styles.stack}
      aria-label="Reload requests"
      role={ringing ? "alert" : undefined}
    >
      {waiting.map((r) => (
        <RequestCard
          key={r.id}
          request={r}
          customer={customers.find((c) => c.id === r.customerId)}
          now={now}
          providers={providers}
          walletBalance={walletBalance}
          smsReady={smsReady}
          act={act}
          onInvoice={onInvoice}
        />
      ))}
      {!enabled && (
        <button
          type="button"
          className={styles.ghost}
          onClick={() => void test()}
        >
          <Volume2 size={16} /> Turn on sound
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

function RequestCard({
  request: r,
  customer,
  now,
  providers,
  walletBalance,
  smsReady,
  act,
  onInvoice,
}: {
  request: ReloadRequest;
  customer?: Customer;
  now: number;
  providers: string[];
  walletBalance: (provider: string) => number;
  smsReady: boolean;
  act: Act;
  onInvoice: (sale: Sale) => void;
}) {
  const [step, setStep] = useState<"view" | "done" | "decline">("view");
  const [provider, setProvider] = useState(
    r.provider || networkFor(r.phone) || "",
  );
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [dueDate, setDueDate] = useState(inDays(30));
  const [sendSms, setSendSms] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const names = Array.from(
    new Set([...NETWORKS.map((n) => n.name), ...providers]),
  );
  const balance = provider ? walletBalance(provider) : 0;
  const walkIn = r.customerId === "cust-walkin";
  const smsTo = customer?.phone || r.phone;

  async function run(type: string, payload: Record<string, unknown>) {
    setBusy(true);
    try {
      return await act(type, { id: r.id, ...payload });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={`${styles.card} ${r.status === "Sent" ? styles.new : ""}`}
    >
      <div className={styles.head}>
        <span className={styles.bell} aria-hidden="true">
          <BellRing size={26} />
        </span>
        <div className={styles.what}>
          <strong>
            {r.type === "Package" ? r.packageName : r.type} {rs(r.amount)} →{" "}
            <span className={styles.number}>{r.phone}</span>
          </strong>
          <span>
            {r.customerName}
            {r.provider || networkFor(r.phone)
              ? ` · ${r.provider || networkFor(r.phone)}`
              : ""}{" "}
            · from {r.requestedByName || "the owner"} {ago(r.createdAt, now)} ·{" "}
            {r.number}
          </span>
          {r.note && <em>“{r.note}”</em>}
        </div>
        {step === "view" && (
          <div className={styles.actions}>
            {r.status === "Sent" && (
              <button
                type="button"
                className={styles.primary}
                disabled={busy}
                onClick={() => void run("seeReloadRequest", {})}
              >
                Got it
              </button>
            )}
            <button
              type="button"
              className={
                r.status === "Sent" ? styles.secondary : styles.primary
              }
              disabled={busy}
              onClick={() => {
                if (r.status === "Sent") void run("seeReloadRequest", {});
                setStep("done");
              }}
            >
              <Check size={17} /> Done it
            </button>
            <button
              type="button"
              className={styles.link}
              disabled={busy}
              onClick={() => setStep("decline")}
            >
              Can't do
            </button>
          </div>
        )}
      </div>

      {step === "done" && (
        <div className={styles.form}>
          <div className={styles.field}>
            <span>Network</span>
            <div
              className={styles.chips}
              role="radiogroup"
              aria-label="Network"
            >
              {names.map((name) => (
                <button
                  type="button"
                  role="radio"
                  key={name}
                  aria-checked={provider === name}
                  className={provider === name ? styles.on : ""}
                  onClick={() => setProvider(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            {provider && (
              <small className={r.amount > balance ? styles.low : ""}>
                {provider} wallet: {rs(balance)}
                {r.amount > balance && " — too low, top it up first"}
              </small>
            )}
          </div>
          <div className={styles.field}>
            <span>How is it paid?</span>
            <div
              className={styles.chips}
              role="radiogroup"
              aria-label="Payment"
            >
              {METHODS.map((m) => (
                <button
                  type="button"
                  role="radio"
                  key={m}
                  aria-checked={method === m}
                  disabled={m === "Credit" && walkIn}
                  className={method === m ? styles.on : ""}
                  onClick={() => setMethod(m)}
                >
                  {m === "Credit" ? "Credit (pay later)" : m}
                </button>
              ))}
            </div>
            {walkIn && <small>Walk-in customers can't take credit.</small>}
          </div>
          {method === "Credit" && (
            <label className={styles.field}>
              <span>Pay by</span>
              <input
                type="date"
                value={dueDate}
                min={inDays(0)}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          )}
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={sendSms}
              onChange={(e) => setSendSms(e.target.checked)}
            />
            Text the receipt to {localPhone(smsTo)}
            {!smsReady && <small> (goes out once SMS is set up)</small>}
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={busy || !provider || r.amount > balance}
              onClick={async () => {
                const data = await run("completeReloadRequest", {
                  provider,
                  method,
                  dueDate: method === "Credit" ? dueDate : undefined,
                  sendSms,
                });
                const done = data?.reloadRequests.find((x) => x.id === r.id);
                const sale = data?.sales.find((s) => s.id === done?.saleId);
                if (sale) onInvoice(sale);
              }}
            >
              <Check size={17} />
              {busy ? "Saving…" : `Done · make invoice ${rs(r.amount)}`}
            </button>
            <button
              type="button"
              className={styles.link}
              onClick={() => setStep("view")}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {step === "decline" && (
        <div className={styles.form}>
          <label className={styles.field}>
            <span>Why can't it be done? The owner sees this.</span>
            <input
              value={reason}
              autoFocus
              maxLength={300}
              placeholder="e.g. Dialog wallet is empty"
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={busy || !reason.trim()}
              onClick={() => void run("declineReloadRequest", { reason })}
            >
              Tell the owner
            </button>
            <button
              type="button"
              className={styles.link}
              onClick={() => setStep("view")}
            >
              Back
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

const STATUS_LABEL: Record<ReloadRequest["status"], string> = {
  Sent: "Waiting at shop",
  Seen: "Seen at shop",
  Done: "Done",
  "Can't do": "Can't do",
  Cancelled: "Cancelled",
};

/**
 * The owner side: send a reload to the shop from anywhere, and watch it
 * go from waiting to done.
 */
export function SendReloadForm({
  customers,
  requests,
  act,
}: {
  customers: Customer[];
  requests: ReloadRequest[];
  act: Act;
}) {
  const [search, setSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<ReloadRequest["type"]>("Reload");
  const [packageName, setPackageName] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const customer = customers.find((c) => c.id === customerId);
  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    if (!term) return [];
    return customers
      .filter(
        (c) =>
          c.id !== "cust-walkin" &&
          (c.name.toLowerCase().includes(term) ||
            (digits.length >= 3 &&
              localPhone(c.phone).includes(localPhone(digits)))),
      )
      .slice(0, 6);
  }, [customers, search]);
  const value = amount ?? Math.round(Number(other || 0) * 100);
  const target = localPhone(phone);
  const ready =
    (!!customer ||
      (adding && newName.trim() && localPhone(newPhone).length === 10)) &&
    target.length === 10 &&
    value > 0 &&
    (type !== "Package" || packageName.trim());
  const recent = [...requests]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 15);

  function pick(c: Customer) {
    setCustomerId(c.id);
    setAdding(false);
    setSearch("");
    if (!phone) setPhone(localPhone(c.phone));
  }
  function reset() {
    setCustomerId("");
    setAdding(false);
    setNewName("");
    setNewPhone("");
    setPhone("");
    setType("Reload");
    setPackageName("");
    setAmount(null);
    setOther("");
    setNote("");
  }

  return (
    <div className={styles.owner}>
      <section className={styles.panel} aria-labelledby="send-reload-title">
        <div>
          <h2 id="send-reload-title">Send a reload to the shop</h2>
          <p>The counter beeps until someone at the shop sees it.</p>
        </div>

        <div className={styles.field}>
          <span>Customer</span>
          {customer ? (
            <div className={styles.picked}>
              <strong>{customer.name}</strong>
              <small>{localPhone(customer.phone)}</small>
              <button
                type="button"
                className={styles.link}
                onClick={() => setCustomerId("")}
              >
                Change
              </button>
            </div>
          ) : adding ? (
            <div className={styles.pair}>
              <input
                placeholder="Name"
                value={newName}
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
              />
              <input
                type="tel"
                inputMode="tel"
                placeholder="Phone 07X XXX XXXX"
                value={newPhone}
                onChange={(e) => {
                  setNewPhone(e.target.value);
                  if (!phone || phone === localPhone(newPhone))
                    setPhone(localPhone(e.target.value));
                }}
              />
              <button
                type="button"
                className={styles.link}
                onClick={() => setAdding(false)}
              >
                Search instead
              </button>
            </div>
          ) : (
            <>
              <input
                placeholder="Search name or phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {matches.length > 0 && (
                <ul className={styles.matches}>
                  {matches.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => pick(c)}>
                        <strong>{c.name}</strong>
                        <small>{localPhone(c.phone)}</small>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  setAdding(true);
                  const digits = search.replace(/\D/g, "");
                  if (digits.length >= 9) setNewPhone(search);
                  else setNewName(search);
                }}
              >
                + New customer
              </button>
            </>
          )}
        </div>

        <label className={styles.field}>
          <span>Number to reload</span>
          <span className={styles.phoneBox}>
            <input
              type="tel"
              inputMode="tel"
              placeholder="07X XXX XXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {networkFor(phone) && <small>{networkFor(phone)}</small>}
          </span>
        </label>

        <div className={styles.field}>
          <span>What</span>
          <div className={styles.chips} role="radiogroup" aria-label="Type">
            {(["Reload", "Package", "Bill payment"] as const).map((t) => (
              <button
                type="button"
                role="radio"
                key={t}
                aria-checked={type === t}
                className={type === t ? styles.on : ""}
                onClick={() => setType(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {type === "Package" && (
            <input
              placeholder="Package name, e.g. Anytime 30-day 50GB"
              value={packageName}
              maxLength={100}
              onChange={(e) => setPackageName(e.target.value)}
            />
          )}
        </div>

        <div className={styles.field}>
          <span>Amount (Rs.)</span>
          <div className={styles.amounts}>
            {AMOUNTS.map((a) => (
              <button
                type="button"
                key={a}
                aria-pressed={amount === a * 100}
                className={amount === a * 100 ? styles.on : ""}
                onClick={() => {
                  setAmount(a * 100);
                  setOther("");
                }}
              >
                {a.toLocaleString()}
              </button>
            ))}
            <input
              aria-label="Other amount in rupees"
              inputMode="decimal"
              placeholder="Other"
              value={other}
              onChange={(e) => {
                setOther(e.target.value);
                setAmount(null);
              }}
            />
          </div>
        </div>

        <label className={styles.field}>
          <span>Note for the shop (optional)</span>
          <input
            value={note}
            maxLength={500}
            placeholder="e.g. He'll pay on Friday"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <button
          type="button"
          className={styles.send}
          disabled={!ready || busy}
          onClick={async () => {
            setBusy(true);
            try {
              const data = await act("sendReloadRequest", {
                ...(customer
                  ? { customerId: customer.id }
                  : {
                      customerName: newName,
                      customerPhone: localPhone(newPhone),
                    }),
                phone: target,
                provider: networkFor(target),
                type,
                packageName: type === "Package" ? packageName : undefined,
                amount: value,
                note,
              });
              if (data) reset();
            } finally {
              setBusy(false);
            }
          }}
        >
          <Send size={19} />
          {busy
            ? "Sending…"
            : ready
              ? `Send ${rs(value)} ${type === "Package" ? "package" : type.toLowerCase()} to the shop`
              : "Fill in customer, number and amount"}
        </button>
      </section>

      {recent.length > 0 && (
        <section className={styles.panel} aria-labelledby="sent-title">
          <h3 id="sent-title">Sent to the shop</h3>
          <ul className={styles.sent}>
            {recent.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>
                    {rs(r.amount)} {what(r)} → {r.phone}
                  </strong>
                  <small>
                    {r.customerName} · {r.number} ·{" "}
                    {new Date(r.createdAt).toLocaleString("en-GB", {
                      timeZone: "Asia/Colombo",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {r.status === "Done" &&
                      ` · ${r.method === "Credit" ? "on credit" : r.method} · ${r.saleNumber}`}
                    {r.closedByName && ` · ${r.closedByName}`}
                    {r.declineReason && ` · ${r.declineReason}`}
                  </small>
                </div>
                <span
                  className={`${styles.status} ${styles[`s${r.status.replace(/\W/g, "")}`] || ""}`}
                >
                  {STATUS_LABEL[r.status]}
                </span>
                {open(r) && (
                  <button
                    type="button"
                    className={styles.link}
                    aria-label={`Cancel ${r.number}`}
                    onClick={() =>
                      void act("cancelReloadRequest", { id: r.id })
                    }
                  >
                    <X size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

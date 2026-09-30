"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import styles from "./counter-home.module.css";

export type Verb = {
  key: string;
  label: string;
  hint: string;
  icon: ReactNode;
  primary?: boolean;
  onClick: () => void;
};
export type NowGroup = "handover" | "needs" | "overdue" | "moving";
export type NowTicket = {
  id: string;
  kind: string;
  reference: string;
  title: string;
  detail: string;
  status: string;
  tone: "ready" | "needs" | "overdue" | "neutral";
  group: NowGroup;
  amount?: string;
  action: string;
  primary?: boolean;
  onAction: () => void;
};

const groupLabels: Record<NowGroup | "all", string> = {
  all: "All",
  handover: "Hand over",
  needs: "Needs you",
  overdue: "Overdue",
  moving: "On the way",
};

/** The home screen: what to do, what's waiting, how today is going. */
export function CounterHome({
  verbs,
  now,
  today,
  shift,
  recent,
}: {
  verbs: Verb[];
  now: NowTicket[];
  today: {
    date: string;
    sales: string;
    salesCount: number;
    targetLabel?: string;
    progress?: number;
    rows: { label: string; value: string }[];
  };
  shift: { name: string; initials: string; detail: string }[];
  recent: {
    id: string;
    title: string;
    detail: string;
    amount: string;
    onOpen: () => void;
  }[];
}) {
  const [filter, setFilter] = useState<NowGroup | "all">("all");
  const counts = now.reduce<Record<string, number>>((map, t) => {
    map[t.group] = (map[t.group] || 0) + 1;
    return map;
  }, {});
  const visible = now.filter((t) => filter === "all" || t.group === filter);
  const groups = (
    ["all", "handover", "needs", "overdue", "moving"] as const
  ).filter((g) => g === "all" || counts[g]);

  return (
    <div className={styles.home}>
      <nav className={styles.verbs} aria-label="Start something">
        {verbs.map((verb) => (
          <button
            key={verb.key}
            type="button"
            className={verb.primary ? styles.primaryVerb : ""}
            onClick={verb.onClick}
          >
            <span className={styles.verbIcon}>{verb.icon}</span>
            <span className={styles.verbText}>
              <strong>{verb.label}</strong>
              <small>{verb.hint}</small>
            </span>
          </button>
        ))}
      </nav>

      <div className={styles.columns}>
        <section className={styles.now} aria-labelledby="now-title">
          <div className={styles.nowHead}>
            <div>
              <h2 id="now-title">Now</h2>
              <p>
                {now.length
                  ? `${now.length} thing${now.length === 1 ? "" : "s"} waiting on the counter, most urgent first`
                  : "Nothing is waiting on the counter."}
              </p>
            </div>
            {now.length > 0 && (
              <div className={styles.chips} role="tablist" aria-label="Filter">
                {groups.map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="tab"
                    aria-selected={filter === g}
                    className={filter === g ? styles.on : ""}
                    onClick={() => setFilter(g)}
                  >
                    {groupLabels[g]} · {g === "all" ? now.length : counts[g]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.list}>
            {visible.map((ticket) => (
              <article className={styles.ticket} key={ticket.id}>
                <span
                  className={`${styles.notch} ${styles.top}`}
                  aria-hidden="true"
                />
                <span
                  className={`${styles.notch} ${styles.bottom}`}
                  aria-hidden="true"
                />
                <div className={styles.stub}>
                  <span>{ticket.kind}</span>
                  <strong>{ticket.reference}</strong>
                </div>
                <div className={styles.body}>
                  <div className={styles.what}>
                    <strong>{ticket.title}</strong>
                    <small>{ticket.detail}</small>
                  </div>
                  <span className={`${styles.chip} ${styles[ticket.tone]}`}>
                    {ticket.status}
                  </span>
                  {ticket.amount && (
                    <span className={styles.amount}>{ticket.amount}</span>
                  )}
                  <button
                    type="button"
                    className={ticket.primary ? styles.go : styles.goOutline}
                    onClick={ticket.onAction}
                  >
                    {ticket.action}
                  </button>
                </div>
              </article>
            ))}
            {!now.length && (
              <div className={styles.clear}>
                <strong>All clear.</strong>
                <span>
                  Repairs to hand over, parcels arriving, overdue balances and
                  low stock will show up here.
                </span>
              </div>
            )}
          </div>
        </section>

        <aside className={styles.side}>
          <section className={styles.receipt} aria-labelledby="today-title">
            <div className={styles.receiptHead}>
              <span id="today-title">TODAY · {today.date}</span>
              <span>
                {today.salesCount} sale{today.salesCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className={styles.big}>
              <small>Sales so far</small>
              <strong>{today.sales}</strong>
            </div>
            {today.targetLabel && today.progress !== undefined && (
              <div className={styles.target}>
                <div className={styles.bar}>
                  <span style={{ width: `${today.progress}%` }} />
                </div>
                <small>{today.targetLabel}</small>
              </div>
            )}
            <div className={styles.rule} />
            {today.rows.map((row) => (
              <div className={styles.row} key={row.label}>
                <span>{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
          </section>

          {shift.length > 0 && (
            <section className={styles.card} aria-labelledby="shift-title">
              <span className={styles.eyebrow} id="shift-title">
                ON SHIFT
              </span>
              <div className={styles.people}>
                {shift.map((person) => (
                  <span key={person.name} className={styles.person}>
                    <i>{person.initials}</i>
                    <span>
                      <strong>{person.name}</strong>
                      <small>{person.detail}</small>
                    </span>
                  </span>
                ))}
              </div>
            </section>
          )}

          {recent.length > 0 && (
            <section className={styles.card} aria-labelledby="recent-title">
              <span className={styles.eyebrow} id="recent-title">
                RECENT SALES
              </span>
              {recent.map((sale) => (
                <button
                  type="button"
                  key={sale.id}
                  className={styles.recent}
                  onClick={sale.onOpen}
                >
                  <span>
                    <strong>{sale.title}</strong>
                    <small>{sale.detail}</small>
                  </span>
                  <span className={styles.amount}>{sale.amount}</span>
                  <ArrowRight size={15} />
                </button>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

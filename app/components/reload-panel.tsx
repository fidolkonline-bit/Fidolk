"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import styles from "./reload-panel.module.css";

export type BillReload = {
  provider: string;
  type: "Reload" | "Bill payment";
  phone: string;
  amount: number;
};

const NETWORKS = [
  { name: "Dialog", prefixes: ["076", "077", "074"] },
  { name: "Mobitel", prefixes: ["070", "071"] },
  { name: "Hutch", prefixes: ["072", "078"] },
  { name: "Airtel", prefixes: ["075"] },
];
const AMOUNTS = [100, 200, 500, 1000, 2000];

const digits = (value: string) => value.replace(/\D/g, "");
const local = (value: string) => {
  const d = digits(value);
  return d.startsWith("94") ? `0${d.slice(2)}` : d;
};
export function networkFor(phone: string) {
  const prefix = local(phone).slice(0, 3);
  return NETWORKS.find((n) => n.prefixes.includes(prefix))?.name;
}

/** Sell a reload or bill payment on the same bill as everything else. */
export function ReloadPanel({
  providers,
  walletBalance,
  onAdd,
}: {
  /** Providers set up in Settings; the four Sri Lankan networks are always offered. */
  providers: string[];
  walletBalance: (provider: string) => number;
  onAdd: (reload: BillReload) => void;
}) {
  const names = Array.from(
    new Set([...NETWORKS.map((n) => n.name), ...providers]),
  );
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [other, setOther] = useState("");
  const [type, setType] = useState<BillReload["type"]>("Reload");
  const phoneRef = useRef<HTMLInputElement>(null);
  useEffect(() => phoneRef.current?.focus(), []);

  const detected = networkFor(phone);
  const chosen = provider || detected || "";
  const value = amount ?? Math.round(Number(other || 0) * 100);
  const validPhone = local(phone).length === 10;
  const balance = chosen ? walletBalance(chosen) : 0;
  const lowWallet = !!chosen && value > balance;
  const ready = validPhone && !!chosen && value > 0 && !lowWallet;

  return (
    <section className={styles.panel} aria-labelledby="reload-title">
      <div>
        <h2 id="reload-title">Reload</h2>
        <p>Adds to this bill, so a phone and a reload are paid together.</p>
      </div>

      <label className={styles.phone}>
        <span>Mobile number</span>
        <span className={styles.phoneBox}>
          <input
            ref={phoneRef}
            type="tel"
            inputMode="tel"
            value={phone}
            placeholder="07X XXX XXXX"
            onChange={(e) => setPhone(e.target.value)}
          />
          {detected && !provider && <small>Looks like {detected}</small>}
        </span>
      </label>

      <div className={styles.group}>
        <span>Network</span>
        <div className={styles.networks} role="radiogroup" aria-label="Network">
          {names.map((name) => (
            <button
              type="button"
              role="radio"
              key={name}
              aria-checked={chosen === name}
              className={chosen === name ? styles.on : ""}
              onClick={() => setProvider(name)}
            >
              <strong>{name}</strong>
              <small>
                {NETWORKS.find((n) => n.name === name)?.prefixes.join(" · ") ||
                  "Other"}
              </small>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
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

      <div className={styles.row}>
        <div className={styles.segment} role="radiogroup" aria-label="Type">
          {(["Reload", "Bill payment"] as const).map((t) => (
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
        {chosen && (
          <small className={lowWallet ? styles.low : ""}>
            {chosen} wallet: Rs. {(balance / 100).toLocaleString()}
            {lowWallet && " — too low, top it up on the Reloads page"}
          </small>
        )}
      </div>

      <button
        type="button"
        className={styles.add}
        disabled={!ready}
        onClick={() => {
          onAdd({ provider: chosen, type, phone: local(phone), amount: value });
          setPhone("");
          setProvider("");
          setAmount(null);
          setOther("");
          phoneRef.current?.focus();
        }}
      >
        <Plus size={20} />
        {ready
          ? `Add ${chosen} ${(value / 100).toLocaleString()} to bill`
          : !validPhone
            ? "Enter a 10-digit number"
            : !chosen
              ? "Pick the network"
              : !value
                ? "Pick an amount"
                : "Wallet too low"}
      </button>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";

type DisplayState = {
  lines: { name: string; quantity: number; unitPrice: number; total: number }[];
  total: number;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(
    amount / 100,
  );

export default function CustomerDisplayPage() {
  const [display, setDisplay] = useState<DisplayState>({ lines: [], total: 0 });
  useEffect(() => {
    const load = () => {
      try {
        setDisplay(
          JSON.parse(localStorage.getItem("fido-customer-display") || "{}"),
        );
      } catch {
        setDisplay({ lines: [], total: 0 });
      }
    };
    load();
    const timer = setInterval(load, 500);
    window.addEventListener("storage", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("storage", load);
    };
  }, []);
  return (
    <main className="customer-display-page">
      <header>
        <strong>
          fido <span>LK</span>
        </strong>
        <p>Your purchase</p>
      </header>
      {display.lines?.length ? (
        <>
          <div className="customer-display-lines">
            {display.lines.map((line, index) => (
              <div key={`${line.name}-${index}`}>
                <span>
                  <strong>{line.name}</strong>
                  <small>
                    {line.quantity} × {money(line.unitPrice)}
                  </small>
                </span>
                <strong>{money(line.total)}</strong>
              </div>
            ))}
          </div>
          <footer>
            <span>Total</span>
            <strong>{money(display.total || 0)}</strong>
          </footer>
        </>
      ) : (
        <div className="customer-display-empty">
          <h1>Welcome to Fido LK</h1>
          <p>Your items will appear here.</p>
        </div>
      )}
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Smartphone, ShoppingBag, Gift, QrCode } from "lucide-react";

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
        <strong className="cd-brand">
          fido
          <i />
        </strong>
        <p>Thank you for shopping with us</p>
      </header>

      {display.lines?.length ? (
        <section className="cd-bill" aria-label="Your bill">
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
            <span>Total to pay</span>
            <strong>{money(display.total || 0)}</strong>
          </footer>
        </section>
      ) : (
        <section className="customer-display-empty">
          <h1>Welcome to Fido LK</h1>
          <p>Phones · Repairs · Clothing · Gifts</p>
          <div className="cd-tiles">
            <div>
              <span className="cd-icon" data-shop="phones">
                <Smartphone size={22} />
              </span>
              <span>
                <strong>Phones &amp; repairs</strong>
                <small>Express fix, genuine parts</small>
              </span>
            </div>
            <div>
              <span className="cd-icon" data-shop="clothing">
                <ShoppingBag size={22} />
              </span>
              <span>
                <strong>Clothing</strong>
                <small>Apparel and casual wear</small>
              </span>
            </div>
            <div>
              <span className="cd-icon" data-shop="gifts">
                <Gift size={22} />
              </span>
              <span>
                <strong>Gifts</strong>
                <small>Gift packs and greeting cards</small>
              </span>
            </div>
            <div>
              <span className="cd-icon">
                <QrCode size={22} />
              </span>
              <span>
                <strong>Pay your way</strong>
                <small>Cash, cards and LankaQR</small>
              </span>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

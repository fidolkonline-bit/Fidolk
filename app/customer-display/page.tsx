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
        <strong>
          fido <span>LK</span>
        </strong>
        <p>Customer Counter Display</p>
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
            <span>Total Payable</span>
            <strong
              style={{ fontSize: "2rem", color: "var(--primary, #2563eb)" }}
            >
              {money(display.total || 0)}
            </strong>
          </footer>
        </>
      ) : (
        <div
          className="customer-display-empty"
          style={{
            textAlign: "center",
            padding: "3rem 1rem",
            maxWidth: "600px",
            margin: "auto",
          }}
        >
          <h1
            style={{
              fontSize: "2.2rem",
              fontWeight: 700,
              color: "#ffffff",
              marginBottom: "0.5rem",
              letterSpacing: "-0.02em",
            }}
          >
            Welcome to Fido LK
          </h1>
          <p
            style={{
              color: "#94a3b8",
              fontSize: "15px",
              marginBottom: "2.5rem",
            }}
          >
            Smartphones · Repairs · Fashion · Curated Gifts
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "14px",
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px",
                background: "rgba(255, 255, 255, 0.05)",
                borderRadius: "12px",
                border: "1px solid #24354e",
              }}
            >
              <div
                style={{
                  padding: "8px",
                  background: "rgba(37, 99, 235, 0.15)",
                  borderRadius: "8px",
                }}
              >
                <Smartphone size={22} color="#60a5fa" />
              </div>
              <div style={{ fontSize: "13px" }}>
                <strong style={{ color: "#f8fafc", display: "block" }}>
                  Phones & Repairs
                </strong>
                <small style={{ color: "#94a3b8" }}>
                  Express fix & genuine parts
                </small>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px",
                background: "rgba(255, 255, 255, 0.05)",
                borderRadius: "12px",
                border: "1px solid #24354e",
              }}
            >
              <div
                style={{
                  padding: "8px",
                  background: "rgba(16, 185, 129, 0.15)",
                  borderRadius: "8px",
                }}
              >
                <ShoppingBag size={22} color="#34d399" />
              </div>
              <div style={{ fontSize: "13px" }}>
                <strong style={{ color: "#f8fafc", display: "block" }}>
                  Quality Clothing
                </strong>
                <small style={{ color: "#94a3b8" }}>
                  Apparel & casual wear
                </small>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px",
                background: "rgba(255, 255, 255, 0.05)",
                borderRadius: "12px",
                border: "1px solid #24354e",
              }}
            >
              <div
                style={{
                  padding: "8px",
                  background: "rgba(245, 158, 11, 0.15)",
                  borderRadius: "8px",
                }}
              >
                <Gift size={22} color="#fbbf24" />
              </div>
              <div style={{ fontSize: "13px" }}>
                <strong style={{ color: "#f8fafc", display: "block" }}>
                  Curated Gifts
                </strong>
                <small style={{ color: "#94a3b8" }}>
                  Gift packs & greeting cards
                </small>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "16px",
                background: "rgba(255, 255, 255, 0.05)",
                borderRadius: "12px",
                border: "1px solid #24354e",
              }}
            >
              <div
                style={{
                  padding: "8px",
                  background: "rgba(168, 85, 247, 0.15)",
                  borderRadius: "8px",
                }}
              >
                <QrCode size={22} color="#c084fc" />
              </div>
              <div style={{ fontSize: "13px" }}>
                <strong style={{ color: "#f8fafc", display: "block" }}>
                  Fast Checkout
                </strong>
                <small style={{ color: "#94a3b8" }}>
                  Cash, Cards & LankaQR
                </small>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

import type { Metadata } from "next";
import {
  Hanken_Grotesk,
  Bricolage_Grotesque,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import "./responsive-fixes.css";
import "./modern-theme.css";
import "./reference-theme.css";
import "./counter-theme.css";

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Fido LK · Business workspace",
  description: "Sales, stock and service, all in one place.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}

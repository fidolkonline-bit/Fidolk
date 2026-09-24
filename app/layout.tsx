import type { Metadata } from "next";
import {
  Plus_Jakarta_Sans,
  Newsreader,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import "./responsive-fixes.css";
import "./modern-theme.css";
import "./reference-theme.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});
const display = Newsreader({
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

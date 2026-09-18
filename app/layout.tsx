import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "./responsive-fixes.css";
import "./modern-theme.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

export const metadata: Metadata = {
  title: "Fido LK · Business workspace",
  description: "Sales, stock and service, all in one place.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import "./responsive-fixes.css";
export const metadata: Metadata = {
  title: "Fido LK · Business workspace",
  description: "Sales, stock and service, all in one place.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

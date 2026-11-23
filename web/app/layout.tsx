import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monkyfi NOC Assistant",
  description: "NOC incident assistant demo with synthetic data / Demo de asistente de incidentes NOC con datos sintéticos",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

// app/layout.tsx
import type { Metadata } from "next";
import { DM_Mono, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "600", "700"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-dm-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "TrustPay Agent — Verificación Inteligente de Pagos",
  description: "Motor de riesgo con IA local para verificar pagos con stablecoins en Arbitrum. Dashboard de análisis en tiempo real.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${syne.variable} ${dmMono.variable}`}>
      <body className="noise-overlay">
        <div className="gradient-mesh" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}

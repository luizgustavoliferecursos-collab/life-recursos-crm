import "./globals.css";
import type { Metadata } from "next";
import { Manrope, Space_Grotesk, JetBrains_Mono } from "next/font/google";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-mono-raw", display: "swap" });

export const metadata: Metadata = {
  title: "LIFE Recursos CRM",
  description: "Central de operações LIFE Recursos",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${manrope.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>{children}</body>
    </html>
  );
}

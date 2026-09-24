import "./globals.css";
import type { Metadata } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";

const sora = Sora({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-mono-raw", display: "swap" });

export const metadata: Metadata = {
  title: "LIFE Recursos CRM",
  description: "Central de operações LIFE Recursos",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${sora.variable} ${jetbrainsMono.variable}`}>{children}</body>
    </html>
  );
}

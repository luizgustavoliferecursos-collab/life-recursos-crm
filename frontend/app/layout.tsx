import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LIFE Recursos CRM",
  description: "Central de operações LIFE Recursos",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

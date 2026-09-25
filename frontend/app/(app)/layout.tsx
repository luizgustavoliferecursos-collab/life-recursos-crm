"use client";

import { CrmProvider } from "../lib/CrmContext";
import { AppShell } from "../components/AppShell";

export default function AppGroupLayout({children}: {children: React.ReactNode}) {
  return (
    <CrmProvider>
      <AppShell>{children}</AppShell>
    </CrmProvider>
  );
}

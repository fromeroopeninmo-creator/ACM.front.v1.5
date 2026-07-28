"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import PublicHeader from "./PublicHeader";
import PublicSidebar from "./PublicSidebar";
import WhatsAppFloat from "./WhatsAppFloat";

export default function PublicShell({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const openMobileMenu = useCallback(() => setMobileMenuOpen(true), []);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <PublicHeader onOpenMenu={openMobileMenu} />
      <PublicSidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={closeMobileMenu}
      />
      <main className="min-h-screen pt-16 md:pl-[72px]">{children}</main>
      <WhatsAppFloat />
    </div>
  );
}

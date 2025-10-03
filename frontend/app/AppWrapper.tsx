// app/AppWrapper.tsx
"use client";

import { useAuth } from "./context/AuthContext";
import { usePathname } from "next/navigation";
import Header from "./components/Header";

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  // ❌ No renderizar header en login ni en register
  const hideHeader = pathname === "/login" || pathname === "/register";

  return (
    <>
      {!hideHeader && user && <Header />}
      {children}
    </>
  );
}

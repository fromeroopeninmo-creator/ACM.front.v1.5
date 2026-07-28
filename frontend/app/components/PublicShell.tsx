import type { ReactNode } from "react";
import PublicSidebar from "./PublicSidebar";

export default function PublicShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen overflow-x-hidden bg-black text-white"><PublicSidebar/><main className="min-h-screen pt-16 md:pl-[72px] md:pt-0">{children}</main></div>;
}

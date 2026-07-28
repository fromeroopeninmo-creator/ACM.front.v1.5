import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
  analyze: <><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/><path d="M8 11h6M11 8v6"/></>,
  manage: <><path d="M4 6h16M4 12h16M4 18h10"/><circle cx="18" cy="18" r="2"/></>,
  measure: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  plans: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,
  resources: <><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  login: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h7v18h-7"/></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
  close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  check: <><path d="m5 12 4 4L19 6"/></>,
};

export function PublicIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name] ?? paths.home}</svg>;
}

"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // @ts-ignore
    if (typeof window.gtag !== "function") return;

    const query = searchParams?.toString();
    const url = pathname + (query ? `?${query}` : "");

    // Enviar pageview a GA4 en cada cambio de ruta
    // @ts-ignore
    window.gtag("config", "G-DBZ71JRP47", {
      page_path: url,
    });
  }, [pathname, searchParams]);

  return null;
}

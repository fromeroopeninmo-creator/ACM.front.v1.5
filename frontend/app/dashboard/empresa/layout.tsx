"use client";

import React from "react";

export default function EmpresaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 👇 Esto garantiza que Next.js herede correctamente el layout padre
  return (
    <div className="w-full h-full">
      {children}
    </div>
  );
}

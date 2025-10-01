// app/(protected)/layout.tsx
"use client";

import ProtectedRoute from "@/app/context/ProtectedRoute";
import Header from "@/app/components/Header";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <Header />
      {children}
    </ProtectedRoute>
  );
}


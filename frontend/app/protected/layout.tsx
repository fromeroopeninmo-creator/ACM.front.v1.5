"use client";

import ProtectedRoute from "@/context/ProtectedRoute";
import Header from "@/components/Header";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-white">
        <Header />
        <main>{children}</main>
      </div>
    </ProtectedRoute>
  );
}

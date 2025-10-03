"use client";

import ProtectedRoute from "@/context/ProtectedRoute";
import Header from "@/components/Header";
import { ReactNode } from "react";

interface ProtectedLayoutProps {
  children: ReactNode;
}

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-white">
        <Header />
        <main>{children}</main>
      </div>
    </ProtectedRoute>
  );
}

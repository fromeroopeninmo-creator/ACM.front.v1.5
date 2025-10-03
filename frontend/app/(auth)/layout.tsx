"use client";

import { AuthProvider } from "../context/AuthContext";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AuthProvider>{children}</AuthProvider>
    </div>
  );
}

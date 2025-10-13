// app/dashboard/layout.tsx
"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import DashboardSidebar from "@/components/DashboardSidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { primaryColor } = useTheme();
  const router = useRouter();

  // Redirigir si no hay usuario
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen text-gray-500">
        Cargando...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <DashboardSidebar role={user.role || "empresa"} color={primaryColor} />

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <DashboardHeader user={user} logout={logout} color={primaryColor} />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

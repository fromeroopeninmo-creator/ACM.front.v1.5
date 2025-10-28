"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";

interface SidebarProps {
  role: string;
  color?: string;
}

export default function DashboardSidebar({ role, color }: SidebarProps) {
  const pathname = usePathname();
  const { primaryColor } = useTheme();

  // ==============================
  // 🔹 Menú por roles
  // ==============================
  const menuByRole: Record<string, { name: string; href: string }[]> = {
    super_admin_root: [
      { name: "Inicio", href: "/dashboard/admin" },
      { name: "Empresas", href: "/dashboard/admin/empresas" },
      { name: "Soporte", href: "/dashboard/admin/soporte" },
      { name: "Planes", href: "/dashboard/admin/planes" },
      { name: "Cashflow / Pagos", href: "/dashboard/admin/cashflow" },
      { name: "Admins", href: "/dashboard/admin/usuarios" }, // NUEVO
      { name: "Configuración", href: "/dashboard/admin/cuenta" },
    ],
    super_admin: [
      { name: "Inicio", href: "/dashboard/admin" },
      { name: "Empresas", href: "/dashboard/admin/empresas" },
      { name: "Soporte", href: "/dashboard/admin/soporte" },
      { name: "Planes", href: "/dashboard/admin/planes" },
      { name: "Cashflow / Pagos", href: "/dashboard/admin/cashflow" },
      { name: "Admins", href: "/dashboard/admin/usuarios" }, // NUEVO
      { name: "Configuración", href: "/dashboard/admin/cuenta" },
    ],
    soporte: [
      { name: "Inicio", href: "/dashboard/soporte" },
      { name: "Empresas", href: "/dashboard/soporte/empresas" },
      { name: "Registros", href: "/dashboard/soporte/logs" },
      { name: "Configuración", href: "/dashboard/soporte/cuenta" },
    ],
    empresa: [
      { name: "Inicio", href: "/dashboard/empresa" },
      { name: "Asesores", href: "/dashboard/empresa/asesores" },
      { name: "Informes", href: "/dashboard/empresa/informes" },
      { name: "Planes", href: "/dashboard/empresa/planes" },
      { name: "Configuración", href: "/dashboard/empresa/cuenta" },
    ],
    asesor: [
      { name: "Inicio", href: "/dashboard/asesor" },
      { name: "Mis Informes", href: "/dashboard/asesor/informes" },
      { name: "Configuración", href: "/dashboard/asesor/cuenta" },
    ],
  };

  const links = menuByRole[role] || menuByRole["empresa"];

  // ==============================
  // 🎨 Color de fondo (heredado)
  // ==============================
  const bgColor =
    role === "asesor" || role === "empresa"
      ? primaryColor || color || "#004AAD"
      : "#004AAD";

  // ==============================
  // 📱 Estado Mobile Drawer
  // ==============================
  const [open, setOpen] = useState(false);

  // Toggle por evento emitido desde el Header
  useEffect(() => {
    const handler = () => setOpen((v) => !v);
    window.addEventListener("vai:toggleSidebar", handler as any);
    return () => window.removeEventListener("vai:toggleSidebar", handler as any);
  }, []);

  // Cerrar al navegar (mobile)
  useEffect(() => {
    if (open) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Cerrar con ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // ==============================
  // 🔹 Render helpers
  // ==============================
  const NavList = useMemo(
    () => (
      <nav className="w-full space-y-2" role="navigation" aria-label="Menú principal">
        {links.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm font-medium transition ${
                active ? "bg-white text-gray-900" : "text-white hover:bg-white/20"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    ),
    [links, pathname]
  );

  const sidebarClasses =
    "w-52 min-h-screen text-white p-5 space-y-4 flex flex-col items-center shadow-md transition-colors duration-300";

  return (
    <>
      {/* 🖥️ Desktop (igual que siempre) */}
      <aside className={`hidden md:flex ${sidebarClasses}`} style={{ backgroundColor: bgColor }}>
        {NavList}
      </aside>

      {/* 📱 Mobile Drawer */}
      <div className="md:hidden">
        {/* Overlay */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Drawer */}
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Menú lateral"
          className={`fixed z-50 top-0 left-0 h-full w-64 transform transition-transform duration-200 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ backgroundColor: bgColor }}
        >
          <div className="p-4 flex items-center justify-between">
            <span className="text-white font-semibold text-sm">Menú</span>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-md bg-white/10 hover:bg-white/20 text-white"
              aria-label="Cerrar menú"
            >
              {/* X icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="px-4 pb-6">{NavList}</div>
        </aside>
      </div>
    </>
  );
}

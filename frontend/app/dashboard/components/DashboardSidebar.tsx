"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";

interface SidebarProps {
  role: string;
  color?: string; // opcional: compat con layouts anteriores
}

export default function DashboardSidebar({ role, color }: SidebarProps) {
  const pathname = usePathname();
  const { primaryColor } = useTheme();

  // ==============================
  // 🔹 Menú por roles (según pedido)
  // ==============================
  const menuByRole: Record<string, { name: string; href: string }[]> = {
    // Admins (opcional, por si los usás)
    super_admin_root: [
      { name: "Inicio", href: "/dashboard/admin" },
      { name: "Empresas", href: "/dashboard/admin/empresas" },
      { name: "Soporte", href: "/dashboard/admin/soporte" },
      { name: "Planes", href: "/dashboard/admin/planes" },
    ],
    super_admin: [
      { name: "Inicio", href: "/dashboard/admin" },
      { name: "Empresas", href: "/dashboard/admin/empresas" },
      { name: "Soporte", href: "/dashboard/admin/soporte" },
    ],
    soporte: [
      { name: "Inicio", href: "/dashboard/soporte" },
      { name: "Empresas", href: "/dashboard/soporte/empresas" },
      { name: "Registros", href: "/dashboard/soporte/logs" },
    ],

    // Empresa → Inicio / Plan / Asesores / Configuración
    empresa: [
      { name: "Inicio", href: "/dashboard/empresa" },
      { name: "Plan", href: "/dashboard/empresa/planes" },
      { name: "Asesores", href: "/dashboard/empresa/asesores" },
      { name: "Configuración", href: "/dashboard/empresa/cuenta" },
    ],

    // Asesor → Inicio / Mis Informes / Configuración
    asesor: [
      { name: "Inicio", href: "/dashboard/asesor" },
      { name: "Mis Informes", href: "/dashboard/asesor/informes" },
      { name: "Configuración", href: "/dashboard/asesor/cuenta" },
    ],
  };

  const links = menuByRole[role] || menuByRole["empresa"];

  // ==============================
  // 🎨 Color de fondo (heredado del ThemeContext)
  // ==============================
  const bgColor =
    role === "asesor" || role === "empresa"
      ? (color || primaryColor || "#004AAD")
      : "#004AAD";

  // ==============================
  // 🔹 Render principal
  // ==============================
  const sidebarClasses =
    "w-52 min-h-screen text-white p-5 space-y-4 flex flex-col items-center shadow-md transition-colors duration-300";

  // helper: activo si la ruta actual empieza con el href
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className={sidebarClasses} style={{ backgroundColor: bgColor }}>
      {/* Navegación */}
      <nav className="w-full space-y-2">
        {links.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm font-medium transition ${
                active ? "bg-white text-gray-900" : "text-white hover:bg-white/20"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

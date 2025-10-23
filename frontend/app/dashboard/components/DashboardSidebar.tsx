"use client";

import Link from "next/link";
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
    empresa: [
      { name: "Inicio", href: "/dashboard/empresa" },
      { name: "Asesores", href: "/dashboard/empresa/asesores" },
      { name: "Informes", href: "/dashboard/empresa/informes" }, // 👈 agregado acá
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
  // 🔹 Render principal
  // ==============================
  const sidebarClasses =
    "w-52 min-h-screen text-white p-5 space-y-4 flex flex-col items-center shadow-md transition-colors duration-300";

  return (
    <aside className={sidebarClasses} style={{ backgroundColor: bgColor }}>
      <nav className="w-full space-y-2">
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
    </aside>
  );
}

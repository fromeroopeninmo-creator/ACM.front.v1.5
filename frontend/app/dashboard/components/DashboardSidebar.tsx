"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  role: string;
  color?: string;
}

export default function DashboardSidebar({ role, color }: SidebarProps) {
  const pathname = usePathname();

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
      { name: "Informes", href: "/dashboard/empresa/informes" },
      { name: "Cuenta", href: "/dashboard/empresa/cuenta" },
    ],
    asesor: [
      { name: "Inicio", href: "/dashboard/asesor" },
      { name: "Mis Informes", href: "/dashboard/asesor/informes" },
      { name: "Nuevo Informe", href: "/dashboard/asesor/nuevo" },
    ],
  };

  const links = menuByRole[role] || menuByRole["empresa"];

  return (
    <aside
      className="w-64 min-h-screen text-white p-5 space-y-4"
      style={{ backgroundColor: color }}
    >
      <nav className="space-y-2">
        {links.map((item) => {
          const active = pathname === item.href;
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

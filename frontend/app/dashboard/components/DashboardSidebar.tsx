"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useTheme } from "@/context/ThemeContext";

interface SidebarProps {
  role: string;
  color?: string;
}

export default function DashboardSidebar({ role, color }: SidebarProps) {
  const pathname = usePathname();
  const { logoUrl, primaryColor } = useTheme(); // ✅ traemos también el color del contexto

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

  // ==============================
  // 🔹 Estilo visual según rol
  // ==============================
  const bgColor =
    role === "asesor" || role === "empresa"
      ? primaryColor || color || "#004AAD" // ✅ lee color realtime del contexto
      : "#004AAD"; // roles neutros (admin, soporte)

  const sidebarClasses =
    "w-64 min-h-screen text-white p-5 space-y-4 flex flex-col items-center shadow-md transition-colors duration-300";

  return (
    <aside className={sidebarClasses} style={{ backgroundColor: bgColor }}>
      {/* ==============================
          🔸 Logo (solo asesores o empresa con herencia visual)
         ============================== */}
      {(role === "asesor" || role === "empresa") && logoUrl && (
        <div className="w-full flex justify-center mb-4">
          <Image
            src={logoUrl}
            alt="Logo Empresa"
            width={140}
            height={60}
            className="object-contain rounded-md bg-white/10 p-2"
          />
        </div>
      )}

      {/* ==============================
          🔸 Navegación
         ============================== */}
      <nav className="w-full space-y-2">
        {links.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm font-medium transition ${
                active
                  ? "bg-white text-gray-900"
                  : "text-white hover:bg-white/20"
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

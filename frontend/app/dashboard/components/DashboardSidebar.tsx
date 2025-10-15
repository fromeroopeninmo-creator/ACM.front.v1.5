"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useTheme } from "@/context/ThemeContext";
import { Menu, X } from "lucide-react";

interface SidebarProps {
  role: string;
  color?: string;
}

export default function DashboardSidebar({ role, color }: SidebarProps) {
  const pathname = usePathname();
  const { logoUrl, primaryColor } = useTheme();
  const [isOpen, setIsOpen] = useState(false); // ✅ controla visibilidad en móviles

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
  // 🎨 Color y estilo visual
  // ==============================
  const bgColor =
    role === "asesor" || role === "empresa"
      ? primaryColor || color || "#004AAD"
      : "#004AAD";

  // ==============================
  // 📱 Responsividad
  // ==============================
  const sidebarWidth = "w-[60%] sm:w-64"; // ✅ 60% en móviles, 256px (64) en desktop

  const sidebarClasses = `
    fixed top-0 left-0 h-full ${sidebarWidth}
    text-white p-5 space-y-4 flex flex-col items-center shadow-md
    transition-all duration-300 z-40
    ${isOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}
  `;

  const toggleMenu = () => setIsOpen(!isOpen);

  // Cierra el menú al navegar en móviles
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // ==============================
  // 🔹 Render principal
  // ==============================
  return (
    <>
      {/* 🟢 Botón hamburguesa visible solo en móviles */}
      <button
        onClick={toggleMenu}
        className="sm:hidden fixed top-4 left-4 z-50 text-white bg-black/40 rounded-md p-1.5 backdrop-blur-md"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* 🟣 Sidebar */}
      <aside className={sidebarClasses} style={{ backgroundColor: bgColor }}>
        {/* Logo de empresa */}
        {(role === "asesor" || role === "empresa") && logoUrl && (
          <div className="w-full flex justify-center mb-4">
            <Image
              src={logoUrl}
              alt="Logo Empresa"
              width={130}
              height={55}
              className="object-contain rounded-md bg-white/10 p-2"
            />
          </div>
        )}

        {/* Navegación */}
        <nav className="w-full space-y-2">
          {links.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition ${
                  active
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-white hover:bg-white/20"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Fondo semitransparente al abrir menú en móvil */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 sm:hidden"
          onClick={toggleMenu}
        />
      )}
    </>
  );
}

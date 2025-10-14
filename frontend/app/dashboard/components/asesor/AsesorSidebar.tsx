"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";

export default function AsesorSidebar() {
  const pathname = usePathname();
  const { logoUrl, primaryColor } = useTheme();
  const { logout } = useAuth();

  const links = [
    { name: "Inicio", href: "/dashboard/asesor" },
    { name: "Valuador", href: "/app/acmforms" },
    { name: "Mis Informes", href: "/dashboard/asesor/informes" },
    { name: "Mi Cuenta", href: "/dashboard/asesor/cuenta" },
  ];

  const sidebarClasses =
    "w-64 min-h-screen text-white p-5 space-y-4 flex flex-col items-center shadow-md transition-colors duration-300";

  return (
    <aside className={sidebarClasses} style={{ backgroundColor: primaryColor }}>
      {/* 🔹 Logo */}
      {logoUrl && (
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

      {/* 🔹 Navegación */}
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

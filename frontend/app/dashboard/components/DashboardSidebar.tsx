"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/context/ThemeContext";

interface SidebarProps {
  role: string;
  color?: string;
}

type MenuItem = {
  name: string;
  href: string;
  icon: string;
};

function SidebarIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
    team: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    reports: <><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5"/><path d="M9 13h6M9 17h6M9 9h2"/></>,
    plans: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88L4.2 6.66l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.37.2.7.48 1 .8.28.3.45.7.5 1.1v.1H21v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
    faq: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 1 1 4.5 2c-1 .8-2 1.2-2 2.5M12 17h.01"/></>,
    tutorials: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 9 5 3-5 3z"/></>,
    companies: <><path d="M3 21h18M5 21V5l7-3v19M12 8h7v13M8 8h1M8 12h1M8 16h1M15 12h1M15 16h1"/></>,
    support: <><path d="M4 13a8 8 0 0 1 16 0M4 13v5a2 2 0 0 0 2 2h2v-7H4ZM20 13v5a2 2 0 0 1-2 2h-2v-7h4ZM16 20h-4"/></>,
    cashflow: <><path d="M3 3v18h18M7 15l4-4 3 3 5-6M15 8h4v4"/></>,
    users: <><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 8h5M19.5 5.5v5"/></>,
    logs: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {icons[name] ?? icons.home}
    </svg>
  );
}

export default function DashboardSidebar({ role, color }: SidebarProps) {
  const pathname = usePathname();
  const { primaryColor } = useTheme();

  const menuByRole: Record<string, MenuItem[]> = {
    super_admin_root: [
      { name: "Inicio", href: "/dashboard/admin", icon: "home" },
      { name: "Empresas", href: "/dashboard/admin/empresas", icon: "companies" },
      { name: "Soporte", href: "/dashboard/admin/soporte", icon: "support" },
      { name: "Planes", href: "/dashboard/admin/planes", icon: "plans" },
      { name: "Cashflow / Pagos", href: "/dashboard/admin/cashflow", icon: "cashflow" },
      { name: "Admins", href: "/dashboard/admin/usuarios", icon: "users" },
      { name: "Configuración", href: "/dashboard/admin/cuenta", icon: "settings" },
      { name: "FAQs", href: "/dashboard/faqs", icon: "faq" },
      { name: "Tutoriales", href: "/landing/tutoriales", icon: "tutorials" },
    ],
    super_admin: [
      { name: "Inicio", href: "/dashboard/admin", icon: "home" },
      { name: "Empresas", href: "/dashboard/admin/empresas", icon: "companies" },
      { name: "Soporte", href: "/dashboard/admin/soporte", icon: "support" },
      { name: "Planes", href: "/dashboard/admin/planes", icon: "plans" },
      { name: "Cashflow / Pagos", href: "/dashboard/admin/cashflow", icon: "cashflow" },
      { name: "Configuración", href: "/dashboard/admin/cuenta", icon: "settings" },
      { name: "FAQs", href: "/dashboard/faqs", icon: "faq" },
      { name: "Tutoriales", href: "/landing/tutoriales", icon: "tutorials" },
    ],
    soporte: [
      { name: "Inicio", href: "/dashboard/soporte", icon: "home" },
      { name: "Empresas", href: "/dashboard/soporte/empresas", icon: "companies" },
      { name: "Registros", href: "/dashboard/soporte/logs", icon: "logs" },
      { name: "Configuración", href: "/dashboard/soporte/cuenta", icon: "settings" },
      { name: "FAQs", href: "/dashboard/faqs", icon: "faq" },
      { name: "Tutoriales", href: "/landing/tutoriales", icon: "tutorials" },
    ],
    empresa: [
      { name: "Inicio", href: "/dashboard/empresa", icon: "home" },
      { name: "Gestión de Equipo", href: "/dashboard/empresa/asesores", icon: "team" },
      { name: "Informes", href: "/dashboard/empresa/informes", icon: "reports" },
      { name: "Planes", href: "/dashboard/empresa/planes", icon: "plans" },
      { name: "Configuración", href: "/dashboard/empresa/cuenta", icon: "settings" },
      { name: "FAQs", href: "/dashboard/faqs", icon: "faq" },
      { name: "Tutoriales", href: "/landing/tutoriales", icon: "tutorials" },
    ],
    asesor: [
      { name: "Inicio", href: "/dashboard/asesor", icon: "home" },
      { name: "Mis Informes", href: "/dashboard/asesor/informes", icon: "reports" },
      { name: "Configuración", href: "/dashboard/asesor/cuenta", icon: "settings" },
      { name: "FAQs", href: "/dashboard/faqs", icon: "faq" },
      { name: "Tutoriales", href: "/landing/tutoriales", icon: "tutorials" },
    ],
  };

  const links = menuByRole[role] || menuByRole.empresa;

  const bgColor =
    role === "asesor" || role === "empresa"
      ? primaryColor || color || "#004AAD"
      : "#004AAD";

  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen((value) => !value);
    window.addEventListener("vai:toggleSidebar", handler as EventListener);
    return () =>
      window.removeEventListener("vai:toggleSidebar", handler as EventListener);
  }, []);

  useEffect(() => {
    if (open) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const renderLinks = (mobile = false) => (
    <nav className="w-full space-y-1.5" aria-label="Menú principal">
      {links.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            title={!mobile ? item.name : undefined}
            aria-current={active ? "page" : undefined}
            className={`group/item relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-white/80 ${
              active
                ? "bg-white text-gray-900 shadow-sm"
                : "text-white/90 hover:bg-white/15 hover:text-white"
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                active
                  ? "bg-black/5 text-gray-900"
                  : "text-white group-hover/item:bg-white/10"
              }`}
            >
              <SidebarIcon name={item.icon} />
            </span>

            <span
              className={
                mobile
                  ? "truncate"
                  : "pointer-events-none max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/sidebar:max-w-[180px] group-hover/sidebar:opacity-100"
              }
            >
              {item.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop: barra compacta que se despliega al acercar el mouse */}
      <div className="relative hidden w-[72px] shrink-0 md:block">
        <aside
          className="group/sidebar fixed bottom-0 left-0 top-16 z-30 flex w-[72px] flex-col overflow-hidden px-3 py-5 text-white shadow-[4px_0_20px_rgba(15,23,42,0.12)] transition-[width,box-shadow] duration-300 ease-out hover:w-60 hover:shadow-[8px_0_30px_rgba(15,23,42,0.18)]"
          style={{ backgroundColor: bgColor }}
          aria-label="Barra lateral"
        >
          <div className="mb-5 flex min-h-10 items-center gap-3 px-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-sm font-bold shadow-sm ring-1 ring-white/15">
              V
            </div>

            <div className="pointer-events-none max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/sidebar:max-w-[160px] group-hover/sidebar:opacity-100">
              <div className="text-sm font-semibold leading-tight">VAI Prop</div>
              <div className="text-[11px] text-white/65">Panel de navegación</div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            {renderLinks(false)}
          </div>
        </aside>
      </div>

      {/* Mobile: conserva el menú hamburguesa */}
      <div className="md:hidden">
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Menú lateral"
          className={`fixed bottom-0 left-0 top-0 z-50 w-72 max-w-[86vw] transform overflow-y-auto shadow-2xl transition-transform duration-200 ease-out ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ backgroundColor: bgColor }}
        >
          <div className="flex items-center justify-between border-b border-white/15 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-sm font-bold ring-1 ring-white/15">
                V
              </div>
              <div>
                <div className="text-sm font-semibold text-white">VAI Prop</div>
                <div className="text-[11px] text-white/65">Menú principal</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl bg-white/10 p-2 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label="Cerrar menú"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="px-4 py-5">{renderLinks(true)}</div>
        </aside>
      </div>
    </>
  );
}

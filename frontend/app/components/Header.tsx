"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "#lib/supabaseClient";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type EmpresaHeader = {
  id: string;
  nombre_comercial: string | null;
  razon_social: string | null;
  matriculado: string | null;
  cpi: string | null;
  user_id: string | null;
};

export default function Header() {
  const { user } = useAuth();
  const { primaryColor } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [empresa, setEmpresa] = useState<EmpresaHeader | null>(null);

  useEffect(() => {
    if (!user) {
      setEmpresa(null);
      return;
    }

    let cancelled = false;

    const fetchEmpresa = async () => {
      try {
        const role = (user as any).role;
        const empresaId = (user as any).empresa_id;

        if (role !== "empresa" && !(role === "asesor" && empresaId)) {
          if (!cancelled) setEmpresa(null);
          return;
        }

        let query = supabase
          .from("empresas")
          .select(
            "id, nombre_comercial, razon_social, matriculado, cpi, user_id"
          );

        if (role === "empresa") {
          query = query.eq("user_id", (user as any).id);
        } else {
          query = query.eq("id", empresaId);
        }

        const { data, error } = await query.maybeSingle();

        if (error) {
          console.error("Error al obtener datos de empresa:", error);
          return;
        }

        if (!cancelled) {
          setEmpresa((data as EmpresaHeader | null) ?? null);
        }
      } catch (error) {
        console.error("Error al obtener datos de empresa:", error);
      }
    };

    fetchEmpresa();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const role = (user as any)?.role || "empresa";
  const safeUser = user as any;

  const getDashboardRoute = () => {
    switch (role) {
      case "empresa":
        return "/dashboard/empresa";
      case "asesor":
        return "/dashboard/asesor";
      case "soporte":
        return "/dashboard/soporte";
      case "super_admin":
      case "super_admin_root":
        return "/dashboard/admin";
      default:
        return "/dashboard";
    }
  };

  const dashboardRoute = getDashboardRoute();

  const isDashboardHome = pathname === dashboardRoute;

  const matriculado = empresa?.matriculado || "—";
  const cpi = empresa?.cpi || "—";

  const nombreAsesor =
    role === "asesor"
      ? `${safeUser?.nombre ?? ""} ${safeUser?.apellido ?? ""}`.trim() || "—"
      : "—";

  const nombreCompleto =
    `${safeUser?.nombre ?? ""} ${safeUser?.apellido ?? ""}`.trim() || "—";

  const isSoporte = role === "soporte";
  const isAdmin = role === "super_admin" || role === "super_admin_root";

  const userLabel = useMemo(() => {
    if (isSoporte) {
      return {
        title: "Soporte",
        primary: nombreCompleto,
        secondary: null,
      };
    }

    if (isAdmin) {
      return {
        title: "Administración",
        primary: nombreCompleto,
        secondary: null,
      };
    }

    if (role === "asesor") {
      return {
        title: "Asesor",
        primary: nombreAsesor,
        secondary:
          matriculado !== "—" || cpi !== "—"
            ? `Profesional ${matriculado} · Matrícula ${cpi}`
            : null,
      };
    }

    return {
      title: "Profesional",
      primary: matriculado,
      secondary: cpi !== "—" ? `Matrícula N.º ${cpi}` : null,
    };
  }, [
    cpi,
    isAdmin,
    isSoporte,
    matriculado,
    nombreAsesor,
    nombreCompleto,
    role,
  ]);

  if (!user) return null;

  return (
    <header
      className="
        sticky top-0 z-50
        flex h-20 w-full items-center
        border-b border-white/10
        bg-black/95 px-3 shadow-[0_5px_24px_rgba(0,0,0,0.20)]
        backdrop-blur-md
        sm:px-4 md:px-6
      "
    >
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4">
        {/* IZQUIERDA: acceso al panel principal */}
        <div className="flex min-w-0 items-center justify-start">
          {!isDashboardHome ? (
            <button
              type="button"
              onClick={() => router.push(dashboardRoute)}
              className="
                group inline-flex h-10 items-center gap-2
                rounded-xl border border-white/15
                bg-white/10 px-3
                text-xs font-semibold text-white
                shadow-sm transition-all duration-200
                hover:border-white/25 hover:bg-white/15
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70
                sm:text-sm
              "
              aria-label="Volver al panel principal"
              title="Volver al panel principal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5"
                aria-hidden="true"
              >
                <path d="m3 11 9-8 9 8" />
                <path d="M5 10v10h14V10" />
                <path d="M9 20v-6h6v6" />
              </svg>

              <span className="hidden sm:inline">Panel principal</span>
              <span className="sm:hidden">Panel</span>
            </button>
          ) : (
            <div
              className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.04]"
              aria-hidden="true"
            />
          )}
        </div>

        {/* CENTRO: logo */}
        <div className="flex items-center justify-center">
          <img
            src="/logo-vai7.png"
            alt="Logo VAI"
            className="
              h-12 w-auto max-w-[150px] object-contain
              sm:h-14 sm:max-w-[180px]
              md:h-16 md:max-w-[210px]
            "
          />
        </div>

        {/* DERECHA: identidad del usuario */}
        <div className="flex min-w-0 items-center justify-end">
          <div
            className="
              flex max-w-full items-center gap-2.5
              rounded-xl border border-white/10
              bg-white/[0.06] px-2.5 py-2
              text-white shadow-sm
              sm:px-3
            "
          >
            <div
              className="
                hidden h-9 w-9 shrink-0 items-center justify-center
                rounded-lg border border-white/10 bg-white/10
                text-sm font-bold sm:flex
              "
              style={{
                color: primaryColor || "#E6A930",
              }}
              aria-hidden="true"
            >
              {userLabel.primary !== "—"
                ? userLabel.primary.charAt(0).toUpperCase()
                : "V"}
            </div>

            <div className="min-w-0 text-right">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/55 sm:text-[11px]">
                {userLabel.title}
              </p>

              <p className="max-w-[120px] truncate text-xs font-semibold text-white sm:max-w-[210px] sm:text-sm">
                {userLabel.primary}
              </p>

              {userLabel.secondary ? (
                <p className="hidden max-w-[230px] truncate text-[11px] text-white/60 md:block">
                  {userLabel.secondary}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  // 🔹 Ruta dinámica del dashboard según el rol
  const getDashboardRoute = () => {
    switch (user.role) {
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

  return (
    <header
      className="
        flex flex-col md:flex-row justify-between items-center
        px-4 md:px-6 py-2 md:py-3
        bg-gray-100 border-b shadow-sm sticky top-0 z-50
        w-full transition-all duration-300
      "
      style={{
        height: "auto", // flexible solo en mobile
        overflow: "hidden",
      }}
    >
      {/* 🔹 MOBILE */}
      <div className="flex w-full items-center justify-between md:hidden">
        {/* Izquierda */}
        <div className="flex flex-col text-[11px] sm:text-sm font-semibold text-gray-700 leading-tight">
          <p>Matriculado/a: {user.matriculado_nombre || "—"}</p>
          <p>CPI: {user.cpi || "—"}</p>
          <p>
            Asesor: {user.nombre} {user.apellido}
          </p>

          {/* Botones en mobile */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => router.push(getDashboardRoute())}
              className="
                px-3 py-1 text-[11px] sm:text-xs border rounded bg-white
                font-medium text-gray-700 hover:bg-gray-200 transition
              "
            >
              ⬅️ Volver al Dashboard
            </button>

            <button
              onClick={logout}
              className="
                px-3 py-1 text-[11px] sm:text-xs border rounded bg-white
                font-medium text-gray-700 hover:bg-gray-200 transition
              "
            >
              🚪 Cerrar sesión
            </button>
          </div>
        </div>

        {/* Derecha (logo más grande y equilibrado) */}
        <div className="flex items-center justify-center">
          <img
            src="/logo-vai4.png"
            alt="Logo VAI"
            className="
              object-contain
              h-[88px] sm:h-[96px]
              w-auto
              transition-transform duration-300
            "
            style={{
              maxHeight: "104px",
              transformOrigin: "center center",
            }}
          />
        </div>
      </div>

      {/* 🔹 DESKTOP */}
      <div className="hidden md:flex w-full justify-between items-center">
        {/* Izquierda: botones */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push(getDashboardRoute())}
            className="
              px-4 py-2 text-sm font-semibold text-gray-700 bg-white
              border rounded-lg shadow hover:bg-gray-200 transition
            "
          >
            ⬅️ Volver al Dashboard
          </button>

          <button
            onClick={logout}
            className="
              px-4 py-2 text-sm font-semibold text-gray-700 bg-white
              border rounded-lg shadow hover:bg-gray-200 transition
            "
          >
            🚪 Cerrar Sesión
          </button>
        </div>

        {/* Centro: logo */}
        <div className="flex justify-center items-center h-full order-first md:order-none">
          <img
            src="/logo-vai4.png"
            alt="Logo VAI"
            className="
              object-contain
              h-full max-h-[72px] w-auto
              scale-[1.8] sm:scale-[2] md:scale-[2.2]
              transition-transform duration-300
            "
            style={{
              transformOrigin: "center center",
              maxWidth: "none",
            }}
          />
        </div>

        {/* Derecha: datos */}
        <div className="flex flex-col items-end gap-1 text-xs sm:text-sm font-semibold text-gray-700 leading-tight">
          <p>Matriculado/a: {user.matriculado_nombre || "—"}</p>
          <p>CPI: {user.cpi || "—"}</p>
          <p>
            Asesor: {user.nombre} {user.apellido}
          </p>
        </div>
      </div>
    </header>
  );
}

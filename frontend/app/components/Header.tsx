"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Header() {
  const { user, logoBase64, primaryColor, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const matriculado = user?.matriculado_nombre || "—";
  const cpi = user?.cpi || "—";
  const asesorNombre =
    user?.nombre && user?.apellido
      ? `${user.nombre} ${user.apellido}`
      : "—";

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 2rem",
        backgroundColor: primaryColor || "#f5f5f5",
        borderBottom: "1px solid #ddd",
        color: "#fff",
      }}
    >
      {/* Izquierda: Logo + Matriculado */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        {logoBase64 && (
          <img
            src={logoBase64}
            alt="Logo"
            style={{ height: 40, borderRadius: 6 }}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{matriculado}</span>
          <span style={{ fontSize: 14 }}>CPI: {cpi}</span>
        </div>
      </div>

      {/* Derecha: Asesor + Logout */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ fontWeight: "bold", fontSize: 16 }}>
          Asesor: {asesorNombre}
        </span>
        {user && (
          <button
            onClick={handleLogout}
            style={{
              padding: "6px 12px",
              border: "none",
              borderRadius: 6,
              background: "#fff",
              color: "#333",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Cerrar sesión
          </button>
        )}
      </div>
    </header>
  );
}

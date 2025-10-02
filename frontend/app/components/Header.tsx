"use client";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (err) {
      console.error("❌ Error al cerrar sesión:", err);
    }
  };

  const matriculado = user?.matriculado_nombre || "—";
  const cpi = user?.cpi || "—";
  const asesorNombre =
    user?.nombre && user?.apellido
      ? `${user.nombre} ${user.apellido}`
      : "—";
  const inmobiliaria = user?.inmobiliaria || "—";

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 2rem",
        backgroundColor: "#f5f5f5", // Gris claro fijo
        borderBottom: "1px solid #ddd",
      }}
    >
      {/* Izquierda: Matriculado + CPI + Inmobiliaria */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {matriculado}
        </span>
        <span style={{ fontSize: 14, color: "#555" }}>
          CPI: {cpi}
        </span>
        <span style={{ fontSize: 14, color: "#333" }}>
          {inmobiliaria}
        </span>
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
              border: "1px solid #ccc",
              borderRadius: 6,
              background: "#fff",
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

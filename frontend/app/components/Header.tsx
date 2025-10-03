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

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 2rem",
        backgroundColor: "#f5f5f5", // gris claro
        borderBottom: "1px solid #ddd",
      }}
    >
      {/* IZQUIERDA */}
      <div style={{ textAlign: "left" }}>
        <div style={{ fontWeight: "bold" }}>{matriculado}</div>
        <div style={{ fontSize: "0.9rem", color: "#555" }}>CPI: {cpi}</div>
      </div>

      {/* CENTRO (luego pondrás el logo VMI) */}
      <div style={{ fontWeight: "bold", fontSize: "1.2rem" }}>VMI</div>

      {/* DERECHA */}
      <div style={{ textAlign: "right" }}>
        <div>Asesor: {asesorNombre}</div>
        <button
          onClick={handleLogout}
          style={{
            marginTop: "0.5rem",
            padding: "0.4rem 0.8rem",
            backgroundColor: "#e53935",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Cerrar Sesión
        </button>
      </div>
    </header>
  );
}

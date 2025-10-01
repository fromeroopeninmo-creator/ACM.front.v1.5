"use client";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Header() {
  const { user } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login"); // Redirige a login después de cerrar sesión
  };

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "1rem 2rem",
        backgroundColor: "#f5f5f5",
        borderBottom: "1px solid #ddd",
      }}
    >
      {/* Izquierda: Matriculado y CPI */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          Matriculado/a: {user?.matriculado || "-"}
        </span>
        <span style={{ fontSize: 14, color: "#555" }}>
          CPI: {user?.cpi || "-"}
        </span>
      </div>

      {/* Centro: logo o texto ACM */}
      <div style={{ fontWeight: "bold", fontSize: 16 }}>
        ACM
      </div>

      {/* Derecha: asesor + logout */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ fontWeight: "bold", fontSize: 16 }}>
          {user?.nombre
            ? `${user.nombre}${user.apellido ? " " + user.apellido : ""}`
            : user?.email || "Invitado"}
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

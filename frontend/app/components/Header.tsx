"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function Header() {
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const session = supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) {
        setUserEmail(data.session.user.email);
      }
    });
  }, []);

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "1rem",
        backgroundColor: "#f5f5f5",
      }}
    >
      <div style={{ fontWeight: "bold" }}>ACM - Análisis Comparativo</div>
      <div>{userEmail ? `Bienvenido/a: ${userEmail}` : "No logueado"}</div>
    </header>
  );
}

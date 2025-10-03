"use client";

export default function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Columna izquierda con banner */}
      <div
        style={{
          flex: 1,
          backgroundImage: "url('/banner.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      {/* Columna derecha con tarjeta */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            display: "grid",
            gap: "12px",
            background: "#fff",
            padding: "24px",
            borderRadius: 8,
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{title}</h1>
            <p style={{ margin: "6px 0 0 0", color: "#555" }}>{subtitle}</p>
          </div>

          {/* Aquí va el formulario */}
          {children}
        </div>
      </div>
    </div>
  );
}

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
    <div
      style={{
        display: "flex",
        flexWrap: "wrap", // ✅ permite que el contenido se apile en móviles
        minHeight: "100vh",
      }}
    >
      {/* 🖼️ Columna izquierda con banner */}
      <div
        style={{
          flex: 1,
          minWidth: "300px", // ✅ evita colapsar en pantallas muy pequeñas
          backgroundImage: "url('/banner.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "block",
        }}
        className="hidden sm:block" // ✅ oculta el banner en pantallas pequeñas
      />

      {/* 🧾 Columna derecha con formulario */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
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
          {/* 🔹 Logo arriba del formulario */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "12px",
            }}
          >
            <img
              src="/logo-vai4.png"
              alt="Logo VAI"
              style={{
                height: "120px", // ✅ tamaño ajustado al layout
                width: "auto",
                objectFit: "contain",
              }}
            />
          </div>

          {/* Título y subtítulo */}
          <div
            style={{
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{title}</h1>
            <p style={{ margin: "6px 0 0 0", color: "#555" }}>{subtitle}</p>
          </div>

          {/* Formulario */}
          {children}
        </div>
      </div>
    </div>
  );
}

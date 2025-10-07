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
    <div className="flex flex-col sm:flex-row min-h-screen w-full">
      {/* 🖼️ Columna izquierda con banner — se oculta solo en mobile */}
      <div
        className="
          hidden sm:block sm:flex-1
          bg-cover bg-center
        "
        style={{
          backgroundImage: "url('/banner.jpg')",
        }}
      />

      {/* 🧾 Columna derecha con formulario (logo visible SIEMPRE) */}
      <div
        className="
          flex flex-1 items-center justify-center
          p-4 sm:p-6 lg:p-10
          bg-gray-50
        "
      >
        <div
          className="
            w-full max-w-sm sm:max-w-md lg:max-w-lg
            bg-white rounded-xl shadow-lg
            p-6 sm:p-8 space-y-4
            transition-all duration-300
          "
        >
          {/* 🔹 Logo arriba del formulario — visible en todas las resoluciones */}
          <div className="flex justify-center mb-4 overflow-hidden">
            <img
              src="/logo-vai4.png"
              alt="Logo VAI"
              className="
                object-contain
                h-24 sm:h-28 md:h-32 lg:h-36 xl:h-40
                scale-[1.3] sm:scale-[1.5] md:scale-[1.6]
                transition-transform duration-300
              "
              style={{
                transformOrigin: "center center",
                maxWidth: "95%", // 🔒 evita overflow horizontal
              }}
            />
          </div>

          {/* 🔹 Título y subtítulo */}
          <div className="text-center mb-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              {title}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              {subtitle}
            </p>
          </div>

          {/* 🔹 Formulario */}
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

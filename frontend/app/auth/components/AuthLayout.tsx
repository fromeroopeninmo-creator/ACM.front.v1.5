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
          backgroundImage: "url('/banner1.png')",
        }}
      />

      {/* 🧾 Columna derecha con formulario (logo visible SIEMPRE) */}
      <div
        className="
          flex flex-1 items-center justify-center
          p-4 sm:p-6 lg:p-10
          bg-slate-100
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
          <div
            className="
              flex items-center justify-center
              mb-6 sm:mb-4
              h-24 sm:h-28 md:h-32 lg:h-36
              overflow-hidden
            "
          >
            <img
              src="/logo-vai7.png"
              alt="Logo VAI"
              className="
                h-full w-auto
                max-w-[220px] sm:max-w-[260px] md:max-w-[280px]
                object-contain
                transition-transform duration-300
              "
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

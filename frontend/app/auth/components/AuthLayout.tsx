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
      {/* 🖼️ Columna izquierda con banner (solo visible en sm y +) */}
      <div
        className="
          hidden sm:block sm:flex-1
          bg-cover bg-center
        "
        style={{
          backgroundImage: "url('/banner.jpg')",
        }}
      />

      {/* 🧾 Columna derecha con formulario */}
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
          {/* 🔹 Logo solo visible en versión móvil */}
          <div className="flex justify-center mb-4 sm:hidden">
            <img
              src="/logo-vai4.png"
              alt="Logo VAI"
              className="object-contain h-20 transition-all duration-300"
            />
          </div>

          {/* Título y subtítulo */}
          <div className="text-center mb-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              {title}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              {subtitle}
            </p>
          </div>

          {/* Formulario */}
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

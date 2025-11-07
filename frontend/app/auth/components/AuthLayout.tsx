"use client";

import React from "react";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  variant?: "narrow" | "wide";
  hideLogoOnMobile?: boolean;
  showMobileBanner?: boolean;
}

export default function AuthLayout({
  children,
  title,
  subtitle,
  variant = "narrow",
  hideLogoOnMobile = false,
  showMobileBanner = false,
}: AuthLayoutProps) {
  const cardWidthClasses =
    variant === "wide"
      ? "max-w-xl sm:max-w-2xl"
      : "max-w-sm sm:max-w-md lg:max-w-lg";

  return (
    <div className="flex flex-col sm:flex-row min-h-screen w-full bg-black">
      {/* 🖼️ Banner SOLO mobile (arriba de la card) */}
      {showMobileBanner && (
        <div
          className="
            block sm:hidden
            w-full h-56
            bg-cover bg-center
          "
          style={{
            backgroundImage: "url('/banner1.png')",
          }}
        />
      )}

      {/* 🖼️ Banner desktop (columna izquierda) */}
      <div
        className="hidden sm:block sm:w-1/3 lg:w-2/5 h-screen bg-cover bg-center"
        style={{
          backgroundImage: "url('/banner1.png')",
        }}
      />

      {/* 🧾 Columna derecha con formulario sobre fondo negro */}
      <div
        className={`
          flex flex-1
          ${showMobileBanner
            ? "items-start justify-center pt-4 sm:items-center sm:pt-0"
            : "items-center justify-center"}
          p-4 sm:p-8 lg:p-10
          bg-black
        `}
      >
        <div
          className={`
            w-full
            ${cardWidthClasses}
            bg-white rounded-xl shadow-2xl
            p-6 sm:p-8 lg:p-10
            space-y-4
            transition-all duration-300
          `}
        >
          {/* 🔹 Logo arriba del formulario */}
          <div
            className={`
              ${hideLogoOnMobile ? "hidden md:flex" : "flex"}
              items-center justify-center
              mb-6 sm:mb-4
              h-24 sm:h-28 md:h-32 lg:h-40
              overflow-hidden
            `}
          >
            <img
              src="/logo-vai7.png"
              alt="Logo VAI"
              className="
                h-full w-auto
                max-w-[220px] sm:max-w-[260px] md:max-w-[320px]
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

          {/* 🔹 Contenido (formularios) */}
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

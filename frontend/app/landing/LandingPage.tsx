// app/landing/LandingPage.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

const PRIMARY = "#E6A930";

const carouselImages = [
  {
    src: "/images/landing/screen-valuador-1.png",
    alt: "Flujo de valuación de activos inmobiliarios en VAI Prop",
  },
  {
    src: "/images/landing/screen-factibilidad-1.png",
    alt: "Informe de factibilidad constructiva en VAI Prop",
  },
  {
    src: "/images/landing/screen-dashboard-1.png",
    alt: "Dashboard principal de VAI Prop",
  },
];

export default function LandingPage() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Carrusel automático
  useEffect(() => {
    const id = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % carouselImages.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* NAVBAR */}
      <header className="w-full border-b bg-white/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo + nombre */}
          <div className="flex items-center gap-3">
            <img
              src="/images/logo-vaiprop.svg" // TODO: ajustá el path/nombre si es distinto
              alt="VAI Prop"
              className="h-9 w-auto"
            />
            <span className="text-sm font-semibold tracking-wide text-slate-700 uppercase">
              VAI Prop
            </span>
          </div>

          {/* Navegación desktop */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
            <a href="#herramientas" className="hover:text-slate-900">
              Herramientas
            </a>
            <a href="#como-funciona" className="hover:text-slate-900">
              Cómo funciona
            </a>
            <a href="#proximamente" className="hover:text-slate-900">
              Próximamente
            </a>
            <a href="#planes" className="hover:text-slate-900">
              Planes
            </a>
            <Link
              href="/auth/login"
              className="px-3 py-1.5 rounded-full border border-slate-300 text-xs font-semibold hover:bg-slate-100"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-white shadow-sm"
              style={{ backgroundColor: PRIMARY }}
            >
              Crear cuenta
            </Link>
          </nav>

          {/* Botón hamburguesa (mobile) */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-300 text-slate-700"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Abrir menú"
          >
            {mobileOpen ? (
              <span className="text-lg">&times;</span>
            ) : (
              <span className="text-xl">&#9776;</span>
            )}
          </button>
        </div>

        {/* Menú mobile */}
        {mobileOpen && (
          <div className="md:hidden border-t bg-white">
            <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-3 text-sm text-slate-700">
              <a
                href="#herramientas"
                onClick={() => setMobileOpen(false)}
                className="py-1"
              >
                Herramientas
              </a>
              <a
                href="#como-funciona"
                onClick={() => setMobileOpen(false)}
                className="py-1"
              >
                Cómo funciona
              </a>
              <a
                href="#proximamente"
                onClick={() => setMobileOpen(false)}
                className="py-1"
              >
                Próximamente
              </a>
              <a
                href="#planes"
                onClick={() => setMobileOpen(false)}
                className="py-1"
              >
                Planes
              </a>
              <div className="h-px bg-slate-200 my-1" />
              <Link
                href="/auth/login"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold hover:bg-slate-100"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/auth/register"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center px-3 py-2 rounded-lg text-xs font-semibold text-white shadow-sm"
                style={{ backgroundColor: PRIMARY }}
              >
                Crear cuenta
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* CONTENIDO */}
      <main className="flex-1">
        {/* HERO */}
        <section className="bg-gradient-to-b from-white to-slate-50">
          <div className="max-w-6xl mx-auto px-4 py-10 md:py-16 grid md:grid-cols-2 gap-10 items-center">
            {/* Hero text */}
            <div>
              <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1 rounded-full mb-4">
                Nuevo
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                Plataforma para inmobiliarias y desarrolladores
              </span>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-900 mb-4 leading-tight">
                Soluciones Digitales para el Real Estate
              </h1>

              <p className="text-slate-600 text-sm md:text-base mb-6 max-w-lg">
                Centralizá tus valuaciones, informes de factibilidad y el
                trabajo de tu equipo en una sola plataforma. Menos planillas
                sueltas, más decisiones claras y rápidas.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md"
                  style={{ backgroundColor: PRIMARY }}
                >
                  Empezar gratis con el Plan Trial
                </Link>
                <Link
                  href="/dashboard/empresa/planes"
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-semibold border border-slate-300 text-slate-800 bg-white hover:bg-slate-50"
                >
                  Ver planes y precios
                </Link>
              </div>

              <p className="text-xs text-slate-500">
                Sin tarjeta de crédito para el plan Trial. Ideal para probar la
                herramienta con tu equipo.
              </p>
            </div>

            {/* Hero visual: carrusel + badge video */}
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                <div className="relative h-64 md:h-72 overflow-hidden">
                  {carouselImages.map((img, idx) => (
                    <img
                      key={img.src}
                      src={img.src}
                      alt={img.alt}
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                        idx === activeSlide ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  ))}
                </div>
                <div className="px-4 py-3 flex items-center justify-between text-xs text-slate-600">
                  <span>VAI Prop – Vista de trabajo</span>
                  <div className="flex gap-1.5">
                    {carouselImages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveSlide(idx)}
                        className={`w-2.5 h-2.5 rounded-full ${
                          idx === activeSlide
                            ? "bg-amber-500"
                            : "bg-slate-200 hover:bg-slate-300"
                        }`}
                        aria-label={`Ir al slide ${idx + 1}`}
                        type="button"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Badge video */}
              <div className="absolute -bottom-6 -right-2 md:-right-6 w-40 bg-slate-900 text-white rounded-xl shadow-lg p-3 text-xs">
                <p className="font-semibold mb-1">Ver demo en video</p>
                <p className="text-[11px] text-slate-200 mb-2">
                  Un recorrido rápido por el flujo de valuación y factibilidad.
                </p>
                <a
                  href="#video-demo"
                  className="inline-flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200"
                >
                  Reproducir ahora
                  <span>▶</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* HERRAMIENTAS */}
        <section
          id="herramientas"
          className="max-w-6xl mx-auto px-4 py-12 md:py-16"
        >
          <div className="max-w-3xl mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
              Una plataforma, dos herramientas clave para tu día a día
            </h2>
            <p className="text-sm md:text-base text-slate-600">
              VAI Prop te acompaña en las dos decisiones más frecuentes del
              negocio: ¿cuánto vale esta propiedad? ¿Qué puedo hacer en este
              lote?
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Valuador */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full w-fit">
                🏠 Valuador de Activos Inmobiliarios
              </div>
              <p className="text-sm text-slate-600">
                Cargá los datos clave de la propiedad y generá un informe
                prolijo en minutos. Ideal para tasaciones comerciales,
                presentaciones a propietarios y comparaciones de oportunidades.
              </p>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Flujo guiado y consistente para todo el equipo</li>
                <li>• Campos pensados para el día a día inmobiliario</li>
                <li>• Informes listos para compartir o exportar</li>
              </ul>
            </div>

            {/* Factibilidad */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col gap-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full w-fit">
                📐 Informe de Factibilidad Constructiva
              </div>
              <p className="text-sm text-slate-600">
                Evaluá el potencial constructivo de un lote: FOT, FOS, alturas,
                retiros, superficies construibles y vendibles. Todo en un solo
                informe.
              </p>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Estructura ordenada para normativa y parámetros</li>
                <li>• Cálculos automáticos de superficies y costos estimados</li>
                <li>• Oportunidades y riesgos claros para decidir rápido</li>
              </ul>
            </div>
          </div>
        </section>

        {/* VIDEO DEMO */}
        <section
          id="video-demo"
          className="bg-slate-900 py-12 md:py-16 px-4"
        >
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
                Mirá cómo funciona VAI Prop en la práctica
              </h2>
              <p className="text-sm md:text-base text-slate-200 mb-4">
                En este breve video te mostramos el recorrido completo: desde
                crear una cuenta, cargar una propiedad y generar un informe,
                hasta usar el módulo de factibilidad.
              </p>
              <p className="text-xs text-slate-300">
                Podés reemplazar este video por tu versión final cuando la
                tengas lista.
              </p>
            </div>
            <div className="bg-black/70 rounded-2xl overflow-hidden border border-slate-700 shadow-lg">
              <video
                className="w-full h-56 md:h-64 object-cover"
                controls
                poster="/images/landing/video-poster.png" // TODO: reemplazar
              >
                {/* TODO: reemplazar src por tu video real */}
                <source src="/videos/demo-vaiprop.mp4" type="video/mp4" />
                Tu navegador no soporta video HTML5.
              </video>
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section
          id="como-funciona"
          className="max-w-6xl mx-auto px-4 py-12 md:py-16"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">
            ¿Cómo funciona?
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Creás tu cuenta",
                text: "Registrás tu empresa, configurás tus datos fiscales y tu logo. Arrancás con un plan Trial.",
              },
              {
                step: "2",
                title: "Sumás a tu equipo",
                text: "Invitás a tus asesores y todos trabajan bajo la misma marca y estructura.",
              },
              {
                step: "3",
                title: "Generás informes",
                text: "Usás el Valuador y la Factibilidad para crear informes claros en minutos.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-2"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-slate-900"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {item.step}
                </div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PRÓXIMAMENTE */}
        <section
          id="proximamente"
          className="bg-white border-y border-slate-200"
        >
          <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                Roadmap de producto
              </p>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
              Próximamente, más herramientas dentro de VAI Prop
            </h2>
            <p className="text-sm md:text-base text-slate-600 mb-8 max-w-3xl">
              VAI Prop va a seguir creciendo con nuevas funcionalidades pensadas
              específicamente para el trabajo diario de inmobiliarias, brokers
              y desarrolladoras.
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  Tracker de trabajo
                </h3>
                <p className="text-sm text-slate-600">
                  Una vista clara del estado de tus operaciones, lotes e
                  informes. En qué está trabajando cada asesor, todo en un solo
                  lugar.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  Agente con IA
                </h3>
                <p className="text-sm text-slate-600">
                  Un asistente integrado que te ayuda a preparar argumentos
                  comerciales, resúmenes de informes y respuestas rápidas a
                  consultas frecuentes.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  Manual del Inmobiliario
                </h3>
                <p className="text-sm text-slate-600">
                  Una biblioteca viva con buenas prácticas, procesos y guías
                  para profesionalizar el trabajo del equipo.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PLANES / CTA FINAL */}
        <section
          id="planes"
          className="max-w-6xl mx-auto px-4 py-12 md:py-16"
        >
          <div className="bg-slate-900 rounded-3xl px-6 py-8 md:px-10 md:py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Empezá hoy a ordenar tus valuaciones y factibilidades
              </h2>
              <p className="text-sm md:text-base text-slate-200 max-w-xl">
                Creá tu cuenta, probá VAI Prop con el plan Trial y, cuando tu
                equipo esté listo, pasá al plan que mejor se adapte a tu
                operación.
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Podés cambiar de plan más adelante según la cantidad de
                asesores que tengas.
              </p>
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg text-sm font-semibold text-slate-900 bg-white shadow-md"
              >
                Crear mi cuenta gratis
              </Link>
              <Link
                href="/dashboard/empresa/planes"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg text-sm font-semibold border border-slate-500 text-slate-100 hover:bg-slate-800"
              >
                Ver planes en detalle
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t bg-white">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <img
              src="/images/logo-vaiprop.svg"
              alt="VAI Prop"
              className="h-5 w-auto"
            />
            <span>© {year} VAI Prop. Todos los derechos reservados.</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/legal/terminos" className="hover:text-slate-800">
              Términos y Condiciones
            </Link>
            <Link href="/legal/privacidad" className="hover:text-slate-800">
              Política de Privacidad
            </Link>
            <Link href="/legal/faqs" className="hover:text-slate-800">
              Preguntas frecuentes
            </Link>
            <Link href="/legal/disclaimer" className="hover:text-slate-800">
              Disclaimer
            </Link>
            <a
              href="mailto:soporte@vaiprop.com"
              className="hover:text-slate-800"
            >
              Contacto
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

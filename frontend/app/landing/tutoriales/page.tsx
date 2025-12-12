// app/landing/tutoriales/page.tsx
"use client";

import SiteNavbar from "@/components/SiteNavbar";

export default function LandingTutorialesPage() {
  return (
    <div className="min-h-screen bg-black text-neutral-50 flex flex-col">
      {/* NAVBAR GLOBAL */}
      <SiteNavbar />

      {/* CONTENIDO */}
      <main className="flex-1 bg-black">
        {/* HEADER DE LA PÁGINA */}
        <section
          className="border-b border-neutral-900"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(230,169,48,0.12), transparent 55%), radial-gradient(circle at bottom right, rgba(230,169,48,0.1), transparent 45%), #050505",
          }}
        >
          <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(230,169,48,0.3)] bg-[rgba(230,169,48,0.08)] px-3 py-1 text-xs font-medium tracking-wide text-[rgba(230,169,48,0.96)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                Centro de tutoriales
              </span>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-50 sm:text-4xl">
                Tutoriales en video para aprovechar VAI Prop al máximo
              </h1>
              <p className="mt-3 text-sm text-neutral-300 sm:text-base">
                Acá vas a encontrar videos cortos con recorridos guiados de cada
                herramienta principal: Valuador de Activos Inmobiliarios,
                Factibilidad Constructiva, Business Tracker y Business Analytics.
                Ideal para capacitar a tu equipo y estandarizar la forma de
                trabajar.
              </p>
            </div>
          </div>
        </section>

        {/* LISTA DE TUTORIALES */}
        <section className="border-b border-neutral-900 bg-[#050505]">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16 space-y-8">
            {/* Valuador de Activos Inmobiliarios */}
            <article className="rounded-3xl border border-neutral-800 bg-neutral-950/80 p-5 md:p-6 shadow-[0_22px_60px_rgba(0,0,0,0.9)]">
              <div className="flex flex-col gap-5 md:grid md:grid-cols-[1.2fr_minmax(0,1fr)] md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(230,169,48,0.9)]">
                    Tutorial 01
                  </p>
                  <h2 className="mt-1 text-lg md:text-xl font-semibold text-neutral-50">
                    Cómo utilizar el Valuador de Activos Inmobiliarios
                  </h2>
                  <p className="mt-2 text-sm text-neutral-300">
                    En este video vemos el paso a paso para cargar un inmueble,
                    sumar comparables, subir imágenes y generar un Informe VAI
                    prolijo y listo para enviar a tu cliente. También repasamos
                    cómo guardar borradores y duplicar informes existentes para
                    ganar tiempo.
                  </p>
                  <ul className="mt-3 text-sm text-neutral-300 space-y-1">
                    <li>• Alta de una nueva valuación.</li>
                    <li>• Carga de comparables y fotos.</li>
                    <li>• Generación del informe final para el cliente.</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-black/80 overflow-hidden">
                  <div className="aspect-video">
                    <iframe
                      className="h-full w-full"
                      src="https://www.youtube.com/embed/oMVdw8uFu2E"
                      title="Como utilizar el Valuador de Activos Inmobiliarios - VAI Prop"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            </article>

            {/* Factibilidad Constructiva */}
            <article className="rounded-3xl border border-neutral-800 bg-neutral-950/80 p-5 md:p-6 shadow-[0_22px_60px_rgba(0,0,0,0.9)]">
              <div className="flex flex-col gap-5 md:grid md:grid-cols-[1.2fr_minmax(0,1fr)] md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(230,169,48,0.9)]">
                    Tutorial 02
                  </p>
                  <h2 className="mt-1 text-lg md:text-xl font-semibold text-neutral-50">
                    Cómo valuar un lote por Factibilidad Constructiva
                  </h2>
                  <p className="mt-2 text-sm text-neutral-300">
                    En este tutorial recorremos el módulo de Factibilidad
                    Constructiva: cómo cargar un lote, parámetros urbanísticos,
                    FOT/FOS (según aplique), estimar m² construibles y ver
                    escenarios de negocio para analizar si un proyecto es
                    viable.
                  </p>
                  <ul className="mt-3 text-sm text-neutral-300 space-y-1">
                    <li>• Carga de datos del lote y normativa.</li>
                    <li>• Simulación de m² construibles y usos posibles.</li>
                    <li>• Lectura del cuadro de indicadores y resultados.</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-black/80 overflow-hidden">
                  <div className="aspect-video">
                    <iframe
                      className="h-full w-full"
                      src="https://www.youtube.com/embed/UdCCU-Axbk0"
                      title="Como valuar un lote por Factibilidad Constructiva - VAI Prop"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            </article>

            {/* Business Tracker */}
            <article className="rounded-3xl border border-neutral-800 bg-neutral-950/80 p-5 md:p-6 shadow-[0_22px_60px_rgba(0,0,0,0.9)]">
              <div className="flex flex-col gap-5 md:grid md:grid-cols-[1.2fr_minmax(0,1fr)] md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(230,169,48,0.9)]">
                    Tutorial 03
                  </p>
                  <h2 className="mt-1 text-lg md:text-xl font-semibold text-neutral-50">
                    Business Tracker: seguimiento de contactos y oportunidades
                  </h2>
                  <p className="mt-2 text-sm text-neutral-300">
                    Acá vemos cómo usar el Business Tracker para registrar
                    contactos, propiedades, actividades y estados de cada
                    oportunidad. La idea es que dejes de depender de Excel y
                    WhatsApp para hacer seguimiento comercial.
                  </p>
                  <ul className="mt-3 text-sm text-neutral-300 space-y-1">
                    <li>• Alta de contactos y propiedades.</li>
                    <li>• Registro de actividades y próximos pasos.</li>
                    <li>• Cómo leer el tablero del asesor y de la empresa.</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-black/80 overflow-hidden">
                  <div className="aspect-video">
                    <iframe
                      className="h-full w-full"
                      src="https://www.youtube.com/embed/a-FZa9QbOSE"
                      title="Business Tracker - Seguimiento comercial en VAI Prop"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            </article>

            {/* Business Analytics */}
            <article className="rounded-3xl border border-neutral-800 bg-neutral-950/80 p-5 md:p-6 shadow-[0_22px_60px_rgba(0,0,0,0.9)]">
              <div className="flex flex-col gap-5 md:grid md:grid-cols-[1.2fr_minmax(0,1fr)] md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[rgba(230,169,48,0.9)]">
                    Tutorial 04
                  </p>
                  <h2 className="mt-1 text-lg md:text-xl font-semibold text-neutral-50">
                    Business Analytics: métricas y tableros para decidir con
                    datos
                  </h2>
                  <p className="mt-2 text-sm text-neutral-300">
                    En este video recorremos los gráficos y tableros de Business
                    Analytics: ingresos, mix de tipologías, desempeño por
                    asesor y visión global de la empresa. Es el módulo pensado
                    para que tomes decisiones con datos y no solo con intuición.
                  </p>
                  <ul className="mt-3 text-sm text-neutral-300 space-y-1">
                    <li>• Lectura de indicadores clave de negocio.</li>
                    <li>• Filtros por asesor y vista global.</li>
                    <li>• Cómo usar los datos en reuniones comerciales.</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-black/80 overflow-hidden">
                  <div className="aspect-video">
                    <iframe
                      className="h-full w-full"
                      src="https://www.youtube.com/embed/_KseZwDzANg"
                      title="Business Analytics - Métricas y tableros en VAI Prop"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>
            </article>

            <p className="text-xs text-neutral-400 text-center mt-6">
              Vamos a ir sumando más tutoriales con novedades de la plataforma y
              casos de uso reales de inmobiliarias y desarrollistas que usan VAI
              Prop en su día a día.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

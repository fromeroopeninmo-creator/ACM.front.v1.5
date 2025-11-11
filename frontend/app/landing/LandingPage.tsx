// app/landing/LandingPage.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
    const openGmailCompose = (to: string, subject?: string) => {
    const params = new URLSearchParams();
    params.set("to", to);
    if (subject) params.set("su", subject);

    // Abre Gmail compose en una pestaña nueva
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`,
      "_blank"
    );
  };

  const accent = "#E6A930"; // dorado corporativo

  return (
    <div className="min-h-screen bg-black text-neutral-50 flex flex-col">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-black/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:py-4">
          {/* Logo + nombre */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="relative h-9 w-9 md:h-10 md:w-10">
                <Image
                  src="/landing/images/logo-vai7.png"
                  alt="VAI Prop logo"
                  fill
                  sizes="40px"
                  className="object-contain"
                />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-[0.25em] text-neutral-200">
                  VAI PROP
                </div>
                <div className="text-[11px] uppercase text-neutral-400">
                  Soluciones para Real Estate
                </div>
              </div>
            </Link>
          </div>

          {/* Links desktop */}
          <div className="hidden items-center gap-8 text-sm md:flex">
            <Link href="#features" className="hover:text-[rgba(230,169,48,0.9)] transition">
              Herramientas
            </Link>
            <Link href="#planes" className="hover:text-[rgba(230,169,48,0.9)] transition">
              Planes
            </Link>
            <Link href="#proximamente" className="hover:text-[rgba(230,169,48,0.9)] transition">
              Próximas herramientas
            </Link>
            <Link href="#faq" className="hover:text-[rgba(230,169,48,0.9)] transition">
              Preguntas frecuentes
            </Link>
          </div>

          {/* Botones auth desktop */}
          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/auth/login"
              className="text-sm text-neutral-200 hover:text-white transition"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/auth/register"
              className="rounded-full border border-[rgba(230,169,48,0.8)] bg-[rgba(230,169,48,0.1)] px-4 py-2 text-sm font-semibold text-[rgba(230,169,48,0.96)] shadow-[0_0_20px_rgba(0,0,0,0.8)] hover:bg-[rgba(230,169,48,0.2)] transition"
            >
              Registrate
            </Link>
          </div>

          {/* Hamburguesa mobile */}
          <button
            className="inline-flex items-center justify-center rounded-md border border-neutral-700 p-2 text-neutral-200 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Abrir menú"
          >
            <span className="sr-only">Abrir menú</span>
            <div className="space-y-1">
              <span className="block h-[2px] w-5 bg-neutral-200" />
              <span className="block h-[2px] w-5 bg-neutral-200" />
            </div>
          </button>
        </nav>

        {/* Menú mobile */}
        {mobileOpen && (
          <div className="border-t border-neutral-800 bg-black/95 px-4 pb-4 pt-2 md:hidden">
            <div className="flex flex-col gap-2 text-sm">
              <Link
                href="#features"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-neutral-200 hover:bg-neutral-900"
              >
                Herramientas
              </Link>
              <Link
                href="#planes"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-neutral-200 hover:bg-neutral-900"
              >
                Planes
              </Link>
              <Link
                href="#proximamente"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-neutral-200 hover:bg-neutral-900"
              >
                Próximas herramientas
              </Link>
              <Link
                href="#faq"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-neutral-200 hover:bg-neutral-900"
              >
                Preguntas frecuentes
              </Link>

              <div className="mt-3 flex gap-2">
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 rounded-full border border-neutral-700 px-3 py-2 text-center text-sm"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/auth/register"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 rounded-full border border-[rgba(230,169,48,0.85)] bg-[rgba(230,169,48,0.15)] px-3 py-2 text-center text-sm font-semibold text-[rgba(230,169,48,0.96)]"
                >
                  Registrate
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* CONTENIDO */}
      <main className="flex-1">
        {/* HERO */}
        <section
          className="border-b border-neutral-900"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(230,169,48,0.16), transparent 55%), radial-gradient(circle at bottom right, rgba(230,169,48,0.14), transparent 45%), #050505",
          }}
        >
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-4 py-10 md:flex-row md:py-16">
            {/* Texto */}
            <div className="flex-1 space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(230,169,48,0.3)] bg-[rgba(230,169,48,0.08)] px-3 py-1 text-xs font-medium tracking-wide text-[rgba(230,169,48,0.96)]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                Plataforma creada para inmobiliarias y desarrolladores
              </span>

              <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-50 sm:text-4xl lg:text-[2.75rem]">
                Soluciones Digitales para el{" "}
                <span style={{ color: accent }}>Real Estate</span>
              </h1>

              <p className="max-w-xl text-sm leading-relaxed text-neutral-300 sm:text-base">
                Centralizá tus valuaciones, estudios de factibilidad y gestión de
                asesores en una sola plataforma. Menos Excel y WhatsApp,
                más <span className="font-semibold">informes profesionales</span>{" "}
                y decisiones rápidas.
              </p>

              {/* CTA */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.95)] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_12px_35px_rgba(0,0,0,0.65)] hover:bg-[rgba(230,169,48,1)] transition"
                >
                  Comenzar gratis
                </Link>
                <Link
                  href="/auth/login"
                  className="inline-flex items-center justify-center rounded-full border border-neutral-600 px-5 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-900 transition"
                >
                  Ver mi panel
                </Link>
              </div>

              {/* Bullets */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs text-neutral-400 sm:text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                  Sin tarjeta para comenzar
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                  Plan Trial con funcionalidades clave
                </div>
              </div>
            </div>

            {/* Hero visual */}
            <div className="flex-1">
              <div className="relative mx-auto max-w-md rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-black p-3 shadow-[0_25px_60px_rgba(0,0,0,0.85)]">
                <div className="absolute inset-0 rounded-3xl border border-[rgba(230,169,48,0.18)] pointer-events-none" />
                <div className="relative overflow-hidden rounded-[1.4rem] bg-black">
                  <Image
                    src="/landing/hero/hero-desktop.webp"
                    alt="Vista de la plataforma VAI Prop"
                    width={960}
                    height={640}
                    className="h-full w-full object-cover"
                    priority
                  />
                  {/* Overlay suave */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                </div>

                {/* Mini badges sobre la tarjeta */}
                <div className="pointer-events-none absolute -left-3 -bottom-4 hidden w-48 rounded-2xl border border-[rgba(230,169,48,0.25)] bg-black/90 px-3 py-2 text-xs text-neutral-200 shadow-[0_18px_40px_rgba(0,0,0,0.9)] sm:block">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(230,169,48,0.9)]">
                    Informes VAI
                  </div>
                  <div className="mt-1 text-[13px] text-neutral-100">
                    Comparables, fotos y mapa listos para enviar a tu cliente.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HERRAMIENTAS PRINCIPALES */}
        <section
          id="features"
          className="border-b border-neutral-900 bg-[#050505]"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-neutral-50 md:text-2xl">
                  Herramientas que resuelven el día a día inmobiliario
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-neutral-300">
                  Diseñamos VAI Prop junto a inmobiliarias y desarrolladores para
                  cubrir los procesos clave: valuación, factibilidad y gestión del
                  equipo comercial.
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Card ACM */}
              <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.85)]">
                <div className="mb-3 inline-flex rounded-full border border-[rgba(230,169,48,0.35)] bg-[rgba(230,169,48,0.12)] px-3 py-1 text-xs font-medium text-[rgba(230,169,48,0.97)]">
                  Valuador de Activos Inmobiliarios
                </div>
                <h3 className="text-sm font-semibold text-neutral-50">
                  Informes VAI claros y listos para enviar
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                  Cargá datos del inmueble, comparables, fotos y notas. Generá un
                  informe prolijo en minutos y dejá de armar PDFs manualmente.
                </p>
                <div className="mt-4 h-28 overflow-hidden rounded-xl border border-neutral-800 bg-black/60">
                  <Image
                    src="/landing/images/vai_propiedad_principal.svg"
                    alt="Valuador de activos inmobiliarios"
                    width={600}
                    height={400}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              {/* Card Factibilidad */}
              <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.85)]">
                <div className="mb-3 inline-flex rounded-full border border-[rgba(230,169,48,0.35)] bg-[rgba(230,169,48,0.12)] px-3 py-1 text-xs font-medium text-[rgba(230,169,48,0.97)]">
                  Factibilidad constructiva
                </div>
                <h3 className="text-sm font-semibold text-neutral-50">
                  Analizá lotes con criterio de desarrollador
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                  Simulá superficie construible, usos permitidos y escenarios de
                  negocio para tomar decisiones rápidas sobre la viabilidad del
                  proyecto.
                </p>
                <div className="mt-4 h-28 overflow-hidden rounded-xl border border-neutral-800 bg-black/60">
                  <Image
                    src="/landing/images/sugerido_venta.svg"
                    alt="Informe de factibilidad constructiva"
                    width={600}
                    height={400}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              {/* Card Asesores */}
              <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.85)]">
                <div className="mb-3 inline-flex rounded-full border border-[rgba(230,169,48,0.35)] bg-[rgba(230,169,48,0.12)] px-3 py-1 text-xs font-medium text-[rgba(230,169,48,0.97)]">
                  Gestión de asesores
                </div>
                <h3 className="text-sm font-semibold text-neutral-50">
                  Ordená el trabajo de tu equipo comercial
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                  Creá usuarios para tus asesores, definí quién puede ver y
                  editar cada informe y centralizá la información en un único
                  panel.
                </p>
                <div className="mt-4 h-28 overflow-hidden rounded-xl border border-neutral-800 bg-black/60">
                  <Image
                    src="/landing/images/asesores.svg"
                    alt="Panel de gestión de asesores"
                    width={600}
                    height={400}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN VIDEO / DEMO */}
        <section className="border-b border-neutral-900 bg-black">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
              <div>
                <h2 className="text-xl font-semibold text-neutral-50 md:text-2xl">
                  Mirá cómo funciona VAI Prop en la práctica
                </h2>
                <p className="mt-3 max-w-xl text-sm text-neutral-300">
                  Te mostramos el flujo completo: desde el registro del inmueble,
                  hasta la generación del informe y la gestión dentro del
                  dashboard. Ideal para presentar a tu equipo y definir si se
                  ajusta a tu forma de trabajar.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-neutral-300">
                  <li>• Crear valuaciones paso a paso.</li>
                  <li>• Cargar comparables y fotos en segundos.</li>
                  <li>• Compartir informes con tu marca y logo.</li>
                </ul>
              </div>

              {/* Placeholder de video (reemplazás src con tu video/iframe) */}
              <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-[0_22px_55px_rgba(0,0,0,0.9)]">
                {/* Si luego tenés un video mp4, podés usar <video> aquí */}
                <div className="aspect-video w-full bg-black/80">
                  <div className="flex h-full w-full items-center justify-center">
                    <button
                      type="button"
                      className="flex items-center gap-3 rounded-full border border-[rgba(230,169,48,0.6)] bg-black/70 px-4 py-2 text-sm font-medium text-neutral-100"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(230,169,48,0.9)] text-black">
                        ▶
                      </span>
                      Ver demo (próximamente)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PLANES (teaser) */}
        <section
          id="planes"
          className="border-b border-neutral-900 bg-[#050505]"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="mb-8 text-center">
              <h2 className="text-xl font-semibold text-neutral-50 md:text-2xl">
                Elegí un plan según el tamaño de tu equipo
              </h2>
              <p className="mt-2 text-sm text-neutral-300">
                Arrancá con el plan Trial y cuando tu equipo crezca, cambiá de
                plan directamente desde la plataforma.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Trial */}
              <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <div className="text-xs font-medium uppercase tracking-[0.22em] text-neutral-400">
                  Trial
                </div>
                <div className="mt-3 text-lg font-semibold text-neutral-50">
                  Ideal para probar la plataforma
                </div>
                <p className="mt-2 text-xs text-neutral-300">
                  Explorá las funciones clave de VAI Prop antes de decidir un
                  plan pago.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-neutral-200">
                  <li>• Acceso al Valuador de Activos Inmobiliarios.</li>
                  <li>• Algunos informes de prueba.</li>
                  <li>• Sin tarjeta para comenzar.</li>
                </ul>
                <div className="mt-5">
                  <Link
                    href="/auth/register"
                    className="inline-flex w-full items-center justify-center rounded-full border border-neutral-700 px-4 py-2 text-xs font-semibold text-neutral-100 hover:bg-neutral-900 transition"
                  >
                    Crear cuenta gratuita
                  </Link>
                </div>
              </div>

              {/* Inicial */}
              <div className="flex flex-col rounded-2xl border border-[rgba(230,169,48,0.6)] bg-[rgba(230,169,48,0.06)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.9)]">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium uppercase tracking-[0.22em] text-[rgba(230,169,48,0.9)]">
                    Plan Inicial
                  </div>
                  <span className="rounded-full bg-[rgba(230,169,48,0.15)] px-2 py-1 text-[11px] text-[rgba(230,169,48,0.96)]">
                    Ideal para inmobiliarias
                  </span>
                </div>
                <div className="mt-3 text-lg font-semibold text-neutral-50">
                  Para equipos chicos que ya producen informes
                </div>
                <p className="mt-2 text-xs text-neutral-200">
                  Diseñado para inmobiliarias que quieren ordenar su operación y
                  profesionalizar la presentación al cliente.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-neutral-100">
                  <li>• Hasta 4 asesores.</li>
                  <li>• Valuador + Factibilidad constructiva.</li>
                  <li>• Panel de empresa con marca propia.</li>
                </ul>
                <div className="mt-5">
                  <Link
                    href="/auth/register"
                    className="inline-flex w-full items-center justify-center rounded-full border border-[rgba(230,169,48,0.9)] bg-[rgba(230,169,48,0.98)] px-4 py-2 text-xs font-semibold text-black hover:bg-[rgba(230,169,48,1)] transition"
                  >
                    Comenzar con VAI Prop
                  </Link>
                </div>
              </div>

              {/* Escalables */}
              <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <div className="text-xs font-medium uppercase tracking-[0.22em] text-neutral-400">
                  Pro / Premium / Personalizado
                </div>
                <div className="mt-3 text-lg font-semibold text-neutral-50">
                  Pensado para equipos en expansión
                </div>
                <p className="mt-2 text-xs text-neutral-300">
                  Más asesores, más informes y más control. Adaptamos el plan a
                  la estructura de tu empresa.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-neutral-200">
                  <li>• Desde 10 hasta 50 asesores.</li>
                  <li>• Soporte prioritario.</li>
                  <li>• Configuraciones y entrenamiento a medida.</li>
                </ul>
                <div className="mt-5">
                  <a
                    href="mailto:info@vaiprop.com"
                    className="inline-flex w-full items-center justify-center rounded-full border border-neutral-700 px-4 py-2 text-xs font-semibold text-neutral-100 hover:bg-neutral-900 transition"
                  >
                    Hablar con nuestro equipo
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRÓXIMAS HERRAMIENTAS */}
        <section
          id="proximamente"
          className="border-b border-neutral-900 bg-black"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="mb-8 text-center">
              <h2 className="text-xl font-semibold text-neutral-50 md:text-2xl">
                Próximamente, más herramientas en el mismo ecosistema
              </h2>
              <p className="mt-2 text-sm text-neutral-300">
                VAI Prop es una plataforma viva. Estas son algunas de las
                funcionalidades en nuestro roadmap.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Tracker de trabajo */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Próximamente
                </div>
                <h3 className="mt-2 text-sm font-semibold text-neutral-50">
                  Tracker de trabajo
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Seguimiento diario de tareas, visitas, llamadas y avances de
                  cada propiedad, para que nada quede perdido en chats.
                </p>
              </div>

              {/* Agente con IA */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Próximamente
                </div>
                <h3 className="mt-2 text-sm font-semibold text-neutral-50">
                  Agente con IA
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Un asistente entrenado en tu cartera y procesos para acelerar
                  respuestas, generar descripciones y ayudarte con el día a día.
                </p>
              </div>

              {/* Manual del Inmobiliario */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Próximamente
                </div>
                <h3 className="mt-2 text-sm font-semibold text-neutral-50">
                  Manual del Inmobiliario
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Buenas prácticas comerciales, guías para formar asesores y
                  recursos para estandarizar la calidad del servicio.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-neutral-900 bg-[#050505]">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="mb-8 text-center">
              <h2 className="text-xl font-semibold text-neutral-50 md:text-2xl">
                Preguntas frecuentes
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Necesito tarjeta para comenzar?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  No. Podés registrarte, entrar al plan Trial y probar la
                  plataforma sin cargar datos de pago. Cuando quieras pasar a un
                  plan pago, lo hacés directo desde tu dashboard.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Puedo sumar asesores a mi cuenta?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Sí. Según tu plan, vas a poder invitar asesores con su propio
                  usuario y contraseña, y definir qué pueden ver y editar.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿VAI Prop reemplaza mi CRM?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Hoy VAI Prop se enfoca en informes de valuación, factibilidad
                  y gestión de asesores. Podés usarlo junto a tu CRM actual o
                  como base para estandarizar procesos.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Cómo se contrata un plan pago?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Todo el proceso es online. Desde tu panel de empresa vas a ver
                  los planes disponibles, los precios y el flujo de pago. Si
                  necesitás algo especial, nos escribís y armamos un esquema
                  personalizado.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="bg-black">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-black via-neutral-950 to-black px-6 py-10 text-center shadow-[0_25px_65px_rgba(0,0,0,0.95)] md:px-10">
              <h2 className="text-xl font-semibold text-neutral-50 md:text-2xl">
                Llevá tus informes al nivel que tu marca se merece
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-neutral-300">
                VAI Prop te ayuda a ordenar tu operación, hablar con datos y
                entregar una experiencia profesional a cada cliente. Empezá con
                un pequeño equipo y escalá cuando lo necesites.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_15px_45px_rgba(0,0,0,0.9)] hover:bg-[rgba(230,169,48,1)] transition"
                >
                  Crear cuenta ahora
                </Link>
                <a
                  onClick={() => openGmailCompose("info@vaiprop.com", "Consulta general")}
                  className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-6 py-2.5 text-sm font-medium text-neutral-100 hover:bg-neutral-900 transition"
                >
                  Hablar con el equipo
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

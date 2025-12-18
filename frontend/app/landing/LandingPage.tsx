// app/landing/LandingPage.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "#lib/supabaseClient";

interface LandingPlan {
  id: string;
  nombre: string;
  max_asesores: number | null;
  precio: number | string | null;
}

// 🧮 Modal de Calculadora UVA (solo front, sin guardar nada)
function UvaCalculatorModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [monto, setMonto] = useState<string>("");
  const [tasaAnual, setTasaAnual] = useState<string>("");
  const [anios, setAnios] = useState<string>("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reutilizamos el formateador de moneda del archivo
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResultado(null);

    const montoNum = parseFloat(monto.replace(",", "."));
    const tasaNum = parseFloat(tasaAnual.replace(",", "."));
    const aniosNum = parseInt(anios, 10);

    if (!montoNum || montoNum <= 0 || isNaN(montoNum)) {
      setErrorMsg("Ingresá un monto de crédito válido.");
      return;
    }
    if (isNaN(tasaNum) || tasaNum < 0) {
      setErrorMsg("Ingresá una tasa anual válida (puede ser 0).");
      return;
    }
    if (!aniosNum || aniosNum <= 0 || isNaN(aniosNum)) {
      setErrorMsg("Ingresá la cantidad de años del crédito.");
      return;
    }

    const tasaMensual = tasaNum / 100 / 12;
    const numPagos = aniosNum * 12;

    let cuota: number;
    if (tasaMensual === 0) {
      cuota = montoNum / numPagos;
    } else {
      const factor = Math.pow(1 + tasaMensual, numPagos);
      cuota = (montoNum * tasaMensual * factor) / (factor - 1);
    }

    setResultado(`Cuota mensual aproximada: ${formatCurrency(cuota)}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full border border-neutral-700 bg-black/60 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          Cerrar ✕
        </button>

        <h2 className="text-lg font-semibold text-neutral-50 mb-2">
          Calculadora de Crédito UVA
        </h2>
        <p className="text-xs text-neutral-300 mb-4">
          Ingresá un monto, una tasa de interés anual aproximada y la cantidad
          de años para estimar una cuota mensual de un crédito amortizable en
          UVA. Es solo una referencia rápida para conversar con tus clientes.
        </p>

        {errorMsg && (
          <div className="mb-3 rounded-lg border border-red-500/60 bg-red-950/60 px-3 py-2 text-xs text-red-100">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="block text-xs font-semibold text-neutral-200 mb-1">
              Monto del crédito (en pesos)
            </label>
            <input
              type="number"
              min={0}
              step="1000"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full rounded-lg border border-neutral-700 bg-black/40 px-3 py-2 text-sm text-neutral-50 outline-none focus:border-[rgba(230,169,48,0.9)] focus:ring-1 focus:ring-[rgba(230,169,48,0.7)]"
              placeholder="Ej: 20000000"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-200 mb-1">
                Tasa de interés anual (%)
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={tasaAnual}
                onChange={(e) => setTasaAnual(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-black/40 px-3 py-2 text-sm text-neutral-50 outline-none focus:border-[rgba(230,169,48,0.9)] focus:ring-1 focus:ring-[rgba(230,169,48,0.7)]"
                placeholder="Ej: 5.5"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-200 mb-1">
                Años del crédito
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={anios}
                onChange={(e) => setAnios(e.target.value)}
                className="w-full rounded-lg border border-neutral-700 bg-black/40 px-3 py-2 text-sm text-neutral-50 outline-none focus:border-[rgba(230,169,48,0.9)] focus:ring-1 focus:ring-[rgba(230,169,48,0.7)]"
                placeholder="Ej: 20"
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-4 py-2 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(0,0,0,0.85)] hover:bg-[rgba(230,169,48,1)] transition"
          >
            Calcular cuota mensual
          </button>
        </form>

        {resultado && (
          <div className="mt-4 rounded-xl border border-neutral-700 bg-black/60 px-3 py-3 text-xs text-neutral-100">
            <div className="font-semibold mb-1">Resultado estimado</div>
            <div>{resultado}</div>
          </div>
        )}

        <p className="mt-4 text-[11px] text-neutral-400">
          * Este cálculo es orientativo y no incluye variaciones del índice UVA,
          seguros ni gastos administrativos.
        </p>
      </div>
    </div>
  );
}

function ProblemCard({
  badge,
  title,
  questions,
  ctaLabel,
  ctaHref,
}: {
  badge: string;
  title: string;
  questions: string[];
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="group relative flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.85)]">
      <div className="absolute inset-0 rounded-2xl border border-[rgba(230,169,48,0.10)] pointer-events-none" />
      <div className="mb-3 inline-flex w-fit rounded-full border border-[rgba(230,169,48,0.35)] bg-[rgba(230,169,48,0.12)] px-3 py-1 text-xs font-medium text-[rgba(230,169,48,0.97)]">
        {badge}
      </div>

      <h3 className="text-sm font-semibold text-neutral-50">{title}</h3>

      <div className="mt-3 space-y-2 text-xs leading-relaxed text-neutral-300">
        {questions.map((q, idx) => (
          <p key={idx} className="text-neutral-300">
            {q}
          </p>
        ))}
      </div>

      <div className="mt-5">
        <Link
          href={ctaHref}
          className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.85)] bg-[rgba(230,169,48,0.10)] px-4 py-2 text-xs font-semibold text-[rgba(230,169,48,0.96)] hover:bg-[rgba(230,169,48,0.18)] transition"
        >
          {ctaLabel} →
        </Link>
      </div>

      <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-neutral-800 to-transparent" />

      <div className="mt-4 text-[11px] text-neutral-500">
        Tip: si lo podés medir, lo podés mejorar.
      </div>
    </div>
  );
}

function StepCard({
  step,
  title,
  desc,
  imageSrc,
  imageAlt,
}: {
  step: string;
  title: string;
  desc: string;
  imageSrc: string;
  imageAlt: string;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/70 shadow-[0_18px_45px_rgba(0,0,0,0.85)]">
      <div className="p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(230,169,48,0.55)] bg-[rgba(230,169,48,0.12)] text-xs font-semibold text-[rgba(230,169,48,0.96)]">
            {step}
          </span>
          <h3 className="text-sm font-semibold text-neutral-50">{title}</h3>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-neutral-300">{desc}</p>
      </div>
      <div className="relative h-40 w-full border-t border-neutral-800 bg-black/40">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Precio neto (sin IVA) del Plan Inicial para mostrar en la card
  const [planInicialPrecioNeto, setPlanInicialPrecioNeto] =
    useState<number | null>(null);

  // Estado para el modal de calculadora UVA
  const [uvaOpen, setUvaOpen] = useState(false);

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
  const IVA_PCT = 0.21;

  // Formateador de moneda en ARS
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(value);

  // Cargar precio del Plan Inicial desde Supabase (tabla planes)
  useEffect(() => {
    const fetchPlanInicial = async () => {
      try {
        const { data, error } = await supabase
          .from("planes")
          .select("id, nombre, max_asesores, precio")
          .neq("nombre", "Trial")
          .neq("nombre", "Desarrollo");

        if (error) {
          console.error("Error cargando planes para landing:", error);
          return;
        }

        if (!data || data.length === 0) return;

        const planes = data as LandingPlan[];

        // 1) Intentar encontrar el plan que coincide con la lógica de la card: hasta 4 asesores
        let planInicial = planes.find((p) => p.max_asesores === 4) ?? null;

        // 2) Si no lo encuentra, tomar el plan pago más barato como fallback
        if (!planInicial) {
          const sorted = [...planes].sort((a, b) => {
            const aVal =
              typeof a.precio === "string"
                ? parseFloat(a.precio)
                : a.precio ?? 0;
            const bVal =
              typeof b.precio === "string"
                ? parseFloat(b.precio)
                : b.precio ?? 0;
            return aVal - bVal;
          });
          planInicial = sorted[0] ?? null;
        }

        if (planInicial && planInicial.precio != null) {
          const val =
            typeof planInicial.precio === "string"
              ? parseFloat(planInicial.precio)
              : planInicial.precio;
          if (!isNaN(val)) {
            setPlanInicialPrecioNeto(val);
          }
        }
      } catch (err) {
        console.error("Error inesperado cargando plan inicial landing:", err);
      }
    };

    fetchPlanInicial();
  }, []);

  const planInicialPrecioDisplay =
    planInicialPrecioNeto != null ? formatCurrency(planInicialPrecioNeto) : null;

  return (
    <div className="min-h-screen bg-black text-neutral-50 flex flex-col">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-black/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 md:py-4">
          {/* Logo + nombre */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <div className="relative h-9 w-9 md:h-10 md:w-10">
                <Image
                  src="/landing/images/logo-vai7.png"
                  alt="VAI Prop logo, software inmobiliario"
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
                  Soluciones digitales para el Real Estate
                </div>
              </div>
            </Link>
          </div>

          {/* Links desktop */}
          <div className="hidden flex-1 items-center justify-center gap-8 text-sm md:flex">
            <Link
              href="#inicio"
              className="hover:text-[rgba(230,169,48,0.9)] transition"
            >
              Inicio
            </Link>
            <Link
              href="#problemas"
              className="hover:text-[rgba(230,169,48,0.9)] transition"
            >
              Problemas reales
            </Link>
            <Link
              href="#como-funciona"
              className="hover:text-[rgba(230,169,48,0.9)] transition"
            >
              Cómo funciona
            </Link>
            <Link
              href="#features"
              className="hover:text-[rgba(230,169,48,0.9)] transition"
            >
              Herramientas
            </Link>
            <Link
              href="/landing/tutoriales"
              className="hover:text-[rgba(230,169,48,0.9)] transition"
            >
              Tutoriales
            </Link>
            <Link
              href="#planes"
              className="hover:text-[rgba(230,169,48,0.9)] transition"
            >
              Planes
            </Link>
            <Link
              href="#faq"
              className="hover:text-[rgba(230,169,48,0.9)] transition"
            >
              FAQs
            </Link>
          </div>

          {/* Botones auth desktop */}
          <div className="hidden items-center gap-3 md:flex shrink-0">
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
            className="ml-auto inline-flex items-center justify-center rounded-md border border-neutral-700 p-2 text-neutral-200 md:hidden"
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
                href="#inicio"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-neutral-200 hover:bg-neutral-900"
              >
                Inicio
              </Link>
              <Link
                href="#problemas"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-neutral-200 hover:bg-neutral-900"
              >
                Problemas reales
              </Link>
              <Link
                href="#como-funciona"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-neutral-200 hover:bg-neutral-900"
              >
                Cómo funciona
              </Link>
              <Link
                href="#features"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-neutral-200 hover:bg-neutral-900"
              >
                Herramientas
              </Link>
              <Link
                href="/landing/tutoriales"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-neutral-200 hover:bg-neutral-900"
              >
                Tutoriales
              </Link>
              <Link
                href="#planes"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-neutral-200 hover:bg-neutral-900"
              >
                Planes
              </Link>
              <Link
                href="#faq"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-neutral-200 hover:bg-neutral-900"
              >
                FAQs
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
          id="inicio"
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
                Plataforma creada para Inmobiliarias y Desarrollistas
              </span>

              <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-50 sm:text-4xl lg:text-[2.75rem]">
                Tomá decisiones con{" "}
                <span style={{ color: accent }}>datos</span>, no con intuición
              </h1>

              <p className="max-w-xl text-sm leading-relaxed text-neutral-300 sm:text-base">
                Unificá en una sola plataforma: valuaciones y tasaciones,
                factibilidad constructiva, tracker de actividades y métricas del
                equipo. Informes prolijos, listos para enviar, con tu marca.
              </p>

              {/* CTA */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.95)] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_12px_35px_rgba(0,0,0,0.65)] hover:bg-[rgba(230,169,48,1)] transition"
                >
                  Crear cuenta gratis
                </Link>

                <a
                  onClick={() =>
                    openGmailCompose(
                      "info@vaiprop.com",
                      "Quiero una demo rápida (15 min)"
                    )
                  }
                  className="inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-700 px-5 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-900 transition"
                >
                  Solicitá tu DEMO
                </a>
              </div>

              {/* Bullets */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs text-neutral-400 sm:text-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                  Sin tarjeta para comenzar
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                  Trial con todas las funciones
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                  Tu marca y logo en informes
                </div>
              </div>

              {/* CTA secundaria de assets */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center pt-2">
                <Link
                  href="/landing/tutoriales"
                  className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-5 py-2.5 text-xs font-semibold text-neutral-100 hover:bg-neutral-900 transition"
                >
                  🎥 Ver tutoriales
                </Link>
                <a
                  href="/landing/docs/ejemplo_informe_vai.pdf"
                  className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.35)] bg-[rgba(230,169,48,0.06)] px-5 py-2.5 text-xs font-semibold text-[rgba(230,169,48,0.96)] hover:bg-[rgba(230,169,48,0.10)] transition"
                >
                  📄 Descargar ejemplo de informe (PDF)
                </a>
              </div>
            </div>

            {/* Hero visual */}
            <div className="flex-1">
              <div className="relative mx-auto max-w-md rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-black p-3 shadow-[0_25px_60px_rgba(0,0,0,0.85)]">
                <div className="absolute inset-0 rounded-3xl border border-[rgba(230,169,48,0.18)] pointer-events-none" />
                <div className="relative overflow-hidden rounded-[1.4rem] bg-black">
                  <Image
                    src="/landing/hero/tablero_hero.jpg"
                    alt="Vista de la plataforma VAI Prop con valuaciones y tracker"
                    width={960}
                    height={640}
                    className="h-full w-full object-cover"
                    priority
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                </div>

                {/* Mini badges */}
                <div className="pointer-events-none absolute -left-3 -bottom-4 hidden w-52 rounded-2xl border border-[rgba(230,169,48,0.25)] bg-black/90 px-3 py-2 text-xs text-neutral-200 shadow-[0_18px_40px_rgba(0,0,0,0.9)] sm:block">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(230,169,48,0.9)]">
                    Business Analytics
                  </div>
                  <div className="mt-1 text-[13px] text-neutral-100">
                    Medí desempeño por empresa y asesores.
                  </div>
                </div>

                <div className="pointer-events-none absolute -right-3 -top-4 hidden w-52 rounded-2xl border border-neutral-800 bg-black/85 px-3 py-2 text-xs text-neutral-200 shadow-[0_18px_40px_rgba(0,0,0,0.9)] sm:block">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-400"></div>
                  <div className="mt-1 text-[13px] text-neutral-100"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROBLEMAS (preguntas llamadoras) */}
        <section id="problemas" className="border-b border-neutral-900 bg-black">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="mb-8 text-center">
              <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                Empecemos por lo que duele
              </p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-50 md:text-2xl">
                3 Problemas típicos del real estate y cómo resolverlos con datos
              </h2>
              <p className="mx-auto mt-3 max-w-3xl text-sm text-neutral-300">
                Si te identificás con alguno, estás a una decisión de ordenarlo.
                VAI PROP está diseñado para el día a día de inmobiliarias y
                desarrollistas.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <ProblemCard
                badge="Métricas y control"
                title="No se puede mejorar lo que no se puede medir"
                questions={[
                  "¿Conocés los indicadores reales de tu empresa?",
                  "¿Sabés cuáles son las fortalezas y debilidades de tu equipo?",
                  "¿Tenés un tracker de actividades y resultados para comparar asesores?",
                ]}
                ctaLabel="Quiero ver el tracker"
                ctaHref="#features"
              />

              <ProblemCard
                badge="Valuación y Tasación"
                title="Tasar un inmueble no debería llevarte horas"
                questions={[
                  "¿Seguís utilizando planillas obsoletas y PDFs manuales?",
                  "¿Los valores que presentás reflejan la realidad del mercado?",
                  "¿Tu informe se ve profesional y con tu marca?",
                ]}
                ctaLabel="Quiero ver el valuador"
                ctaHref="#features"
              />

              <ProblemCard
                badge="Factibilidad constructiva"
                title="Invertir sin medir el potencial del terreno es caro"
                questions={[
                  "¿Vas a construir un desarrollo en altura?",
                  "¿Conocés el potencial real del terreno y sus escenarios?",
                  "¿Sabés si esa ubicación es una buena inversión?",
                ]}
                ctaLabel="Quiero ver factibilidad"
                ctaHref="#features"
              />
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_15px_45px_rgba(0,0,0,0.9)] hover:bg-[rgba(230,169,48,1)] transition"
              >
                Resolverlo con VAI Prop
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-6 py-2.5 text-sm font-medium text-neutral-100 hover:bg-neutral-900 transition"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section
          id="como-funciona"
          className="border-b border-neutral-900 bg-[#050505]"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                  Simple y Fácil
                </p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-50 md:text-2xl">
                  Cómo funciona VAI PROP en 3 pasos
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-neutral-300">
                  Flujo claro para que tu equipo trabaje ordenado y con criterio: Informes +
                  Seguimiento + Métricas.
                </p>
              </div>

              <div className="flex gap-2">
                <Link
                  href="/landing/tutoriales"
                  className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-5 py-2 text-xs font-semibold text-neutral-100 hover:bg-neutral-900 transition"
                >
                  Ver el flujo en video
                </Link>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <StepCard
                step="1"
                title="Generá tus Informes en minutos"
                desc="Presentá valuaciones de forma clara, profesional y con tu marca, listo para enviar."
                imageSrc="/landing/images/vai_propiedad_principal.svg"
                imageAlt="Carga de datos y comparables para valuación inmobiliaria"
              />
              <StepCard
                step="2"
                title="Gestión y Seguimiento de Asesores"
                desc="Gestioná el alta de tus asesores y realizá un seguimiento de sus actividades."
                imageSrc="/landing/images/asesores.svg"
                imageAlt="Vista del tablero de VAI Prop con informes y métricas"
              />
              <StepCard
                step="3"
                title="Medí, ordená y mejorá"
                desc="Trackeá actividades diarias y resultados de operaciones para que puedas tomar decisiones con datos reales."
                imageSrc="landing/hero/tablero_hero.jpg"
                imageAlt="Panel y gestión de asesores con tracker y métricas"
              />
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[rgba(230,169,48,1)] transition"
              >
                Empezar Prueba GRATIS
              </Link>
              <a
                onClick={() =>
                  openGmailCompose(
                    "info@vaiprop.com",
                    "Quiero una demo rápida (15 min)"
                  )
                }
                className="inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-700 px-6 py-2.5 text-sm font-medium text-neutral-100 hover:bg-neutral-900 transition"
              >
                Hablar con el equipo
              </a>
            </div>
          </div>
        </section>

        {/* SECCIÓN VIDEO / DEMO (más arriba) */}
        <section className="border-b border-neutral-900 bg-black">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                  Demo práctica
                </p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-50 md:text-2xl">
                  Mirá cómo funciona VAI Prop en la práctica
                </h2>
                <p className="mt-3 max-w-xl text-sm text-neutral-300">
                  Te mostramos el flujo completo: desde el registro del inmueble,
                  hasta la generación del informe de valuación y la gestión
                  dentro del dashboard con tu tracker.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-neutral-300">
                  <li>• Crear valuaciones y tasaciones paso a paso.</li>
                  <li>• Cargar comparables y fotos en segundos.</li>
                  <li>• Compartir informes con tu marca y logo.</li>
                </ul>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href="/landing/tutoriales"
                    className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-5 py-2.5 text-sm font-semibold text-neutral-100 hover:bg-neutral-900 transition"
                  >
                    🎥 Conocé las herramientas que ofrecemos
                  </Link>

                  <Link
                    href="/auth/register"
                    className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.85)] bg-[rgba(230,169,48,0.10)] px-5 py-2.5 text-sm font-semibold text-[rgba(230,169,48,0.96)] hover:bg-[rgba(230,169,48,0.18)] transition"
                  >
                    Probar ahora (trial)
                  </Link>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-[0_22px_55px_rgba(0,0,0,0.9)]">
                <div className="aspect-video w-full bg-black/80">
                  <video
                    className="h-full w-full object-cover"
                    controls
                    playsInline
                  >
                    <source
                      src="/landing/videos/video_vai2.mp4"
                      type="video/mp4"
                    />
                    Tu navegador no soporta la reproducción de video.
                  </video>
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
                <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                  Herramientas principales
                </p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-50 md:text-2xl">
                  Todo lo esencial para operar con orden
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-neutral-300">
                  Diseñamos VAI Prop junto a inmobiliarias y desarrollistas para
                  cubrir procesos clave: valuación/tasación, estudio de pre-factibilidad constructiva y
                  gestión del equipo con métricas y seguimiento.
                </p>
              </div>

              <div className="flex gap-2">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.85)] bg-[rgba(230,169,48,0.10)] px-5 py-2 text-xs font-semibold text-[rgba(230,169,48,0.96)] hover:bg-[rgba(230,169,48,0.18)] transition"
                >
                  Empezar gratis
                </Link>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Card Valuador */}
              <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.85)]">
                <div className="mb-3 inline-flex rounded-full border border-[rgba(230,169,48,0.35)] bg-[rgba(230,169,48,0.12)] px-3 py-1 text-xs font-medium text-[rgba(230,169,48,0.97)]">
                  Valuación y Tasación
                </div>
                <h3 className="text-sm font-semibold text-neutral-50">
                  Informes VAI claros, listos para enviar
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                  Cargá datos del inmueble, comparables, fotos y notas. Generá un
                  informe prolijo por método comparativo en minutos y dejá de
                  trabajar con Excel y PDFs armados manualmente.
                </p>

                <div className="mt-4 h-28 overflow-hidden rounded-xl border border-neutral-800 bg-black/60">
                  <Image
                    src="/landing/images/vai_propiedad_principal.svg"
                    alt="Valuador de activos inmobiliarios y tasaciones"
                    width={600}
                    height={400}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="mt-4 flex gap-2">
                  <a
                    href="/landing/docs/ejemplo_informe_vai.pdf"
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-neutral-700 px-3 py-2 text-[11px] font-semibold text-neutral-100 hover:bg-neutral-900 transition"
                  >
                    Ver ejemplo (PDF)
                  </a>
                  <Link
                    href="/auth/register"
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-[rgba(230,169,48,0.85)] bg-[rgba(230,169,48,0.10)] px-3 py-2 text-[11px] font-semibold text-[rgba(230,169,48,0.96)] hover:bg-[rgba(230,169,48,0.18)] transition"
                  >
                    Probar
                  </Link>
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
                  Simulá superficie construible, escenarios y variables clave
                  para decidir rápido sobre la viabilidad de cada proyecto.
                </p>

                <div className="mt-4 h-28 overflow-hidden rounded-xl border border-neutral-800 bg-black/60">
                  <Image
                    src="/landing/images/sugerido_venta.svg"
                    alt="Informe de factibilidad constructiva inmobiliaria"
                    width={600}
                    height={400}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href="/landing/tutoriales"
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-neutral-700 px-3 py-2 text-[11px] font-semibold text-neutral-100 hover:bg-neutral-900 transition"
                  >
                    Ver tutorial
                  </Link>
                  <Link
                    href="/auth/register"
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-[rgba(230,169,48,0.85)] bg-[rgba(230,169,48,0.10)] px-3 py-2 text-[11px] font-semibold text-[rgba(230,169,48,0.96)] hover:bg-[rgba(230,169,48,0.18)] transition"
                  >
                    Probar
                  </Link>
                </div>
              </div>

              {/* Card Gestión + Tracker */}
              <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.85)]">
                <div className="mb-3 inline-flex rounded-full border border-[rgba(230,169,48,0.35)] bg-[rgba(230,169,48,0.12)] px-3 py-1 text-xs font-medium text-[rgba(230,169,48,0.97)]">
                  Gestión + Métricas
                </div>
                <h3 className="text-sm font-semibold text-neutral-50">
                  Ordená el trabajo de tu equipo comercial
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                  Creá usuarios para tus asesores, centralizá información y
                  medí actividades y resultados para mejorar performance.
                </p>

                <div className="mt-4 h-28 overflow-hidden rounded-xl border border-neutral-800 bg-black/60">
                  <Image
                    src="/landing/hero/tablero_hero.jpg"
                    alt="Panel de gestión y tracker de asesores"
                    width={600}
                    height={400}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="mt-4 flex gap-2">
                  <Link
                    href="/landing/tutoriales"
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-neutral-700 px-3 py-2 text-[11px] font-semibold text-neutral-100 hover:bg-neutral-900 transition"
                  >
                    Ver tutorial
                  </Link>
                  <Link
                    href="/auth/register"
                    className="inline-flex flex-1 items-center justify-center rounded-full border border-[rgba(230,169,48,0.85)] bg-[rgba(230,169,48,0.10)] px-3 py-2 text-[11px] font-semibold text-[rgba(230,169,48,0.96)] hover:bg-[rgba(230,169,48,0.18)] transition"
                  >
                    Probar
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-950/60 p-5">
              <div className="grid gap-5 md:grid-cols-[1.2fr_1fr] md:items-center">
                <div>
                  <div className="text-xs font-semibold tracking-[0.22em] uppercase text-neutral-400">
                    Bonus para tus conversaciones
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-neutral-50">
                    Calculadora de Crédito UVA (orientativa)
                  </h3>
                  <p className="mt-2 text-sm text-neutral-300">
                    Estimá una cuota mensual aproximada en segundos para orientar
                    al cliente en una primera charla.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => setUvaOpen(true)}
                      className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_15px_40px_rgba(0,0,0,0.9)] hover:bg-[rgba(230,169,48,1)] transition"
                    >
                      🧮 Abrir calculadora UVA
                    </button>
                    <Link
                      href="/auth/register"
                      className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-6 py-2.5 text-sm font-medium text-neutral-100 hover:bg-neutral-900 transition"
                    >
                      Probar VAI Prop
                    </Link>
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-black/60 px-4 py-4 text-[11px] text-neutral-200">
                  <div className="flex items-center justify-between">
                    <span>Monto simulado</span>
                    <span className="font-semibold">$ 20.000.000</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Tasa anual</span>
                    <span className="font-semibold">5,5% aprox.</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span>Plazo</span>
                    <span className="font-semibold">20 años</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-neutral-800 pt-2">
                    <span className="text-[11px] text-neutral-400">
                      Cuota mensual estimada
                    </span>
                    <span className="text-sm font-semibold text-[rgba(230,169,48,0.96)]">
                      $ 138.000 aprox.
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] text-neutral-500">
                    * Cálculo orientativo, sin variaciones de UVA, seguros ni
                    gastos administrativos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PLANES (más simple y “decisión fácil”) */}
        <section id="planes" className="border-b border-neutral-900 bg-black">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="mb-8 text-center">
              <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                Planes
              </p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-50 md:text-2xl">
                Empezá hoy y escalá cuando tu equipo crezca
              </h2>
              <p className="mx-auto mt-2 max-w-3xl text-sm text-neutral-300">
                Probá sin tarjeta. Cuando te cierre el flujo y el equipo lo use,
                pasás a un plan pago directo desde la plataforma.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {/* Trial */}
              <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <div className="text-xs font-medium uppercase tracking-[0.22em] text-neutral-400">
                  Trial
                </div>
                <div className="mt-3 text-lg font-semibold text-neutral-50">
                  Probá la plataforma sin tarjeta
                </div>
                <p className="mt-2 text-xs text-neutral-300">
                  Ideal para validar el flujo, ver el tablero y entender cómo
                  encaja en tu operación.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-neutral-200">
                  <li>• Acceso a herramientas clave.</li>
                  <li>• Probá informes y flujo general.</li>
                  <li>• Sin tarjeta para comenzar.</li>
                </ul>
                <div className="mt-5">
                  <Link
                    href="/auth/register"
                    className="inline-flex w-full items-center justify-center rounded-full border border-neutral-700 px-4 py-2 text-xs font-semibold text-neutral-100 hover:bg-neutral-900 transition"
                  >
                    Crear cuenta (trial)
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
                    Más elegido
                  </span>
                </div>
                <div className="mt-3 text-lg font-semibold text-neutral-50">
                  Para inmobiliarias con equipo chico/medio
                </div>
                <p className="mt-2 text-xs text-neutral-200">
                  Informes profesionales + factibilidad + orden del equipo con
                  métricas y seguimiento.
                </p>

                {planInicialPrecioDisplay && (
                  <div className="mt-3 text-2xl font-semibold text-neutral-50">
                    {planInicialPrecioDisplay}
                    <span className="ml-1 text-xs font-normal text-neutral-400">
                      + IVA / mes
                    </span>
                  </div>
                )}

                <ul className="mt-4 space-y-2 text-xs text-neutral-100">
                  <li>• Hasta 4 asesores.</li>
                  <li>• Valuador + Factibilidad constructiva.</li>
                  <li>• Panel con marca propia.</li>
                </ul>
                <div className="mt-5">
                  <Link
                    href="/auth/register"
                    className="inline-flex w-full items-center justify-center rounded-full border border-[rgba(230,169,48,0.9)] bg-[rgba(230,169,48,0.98)] px-4 py-2 text-xs font-semibold text-black hover:bg-[rgba(230,169,48,1)] transition"
                  >
                    Empezar con VAI Prop
                  </Link>
                </div>

                <div className="mt-4 text-[11px] text-neutral-500">
                  IVA ({Math.round(IVA_PCT * 100)}%) se calcula/visualiza en UI.
                </div>
              </div>

              {/* Escalables */}
              <div className="flex flex-col rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <div className="text-xs font-medium uppercase tracking-[0.22em] text-neutral-400">
                  Pro / Premium / Personalizado
                </div>
                <div className="mt-3 text-lg font-semibold text-neutral-50">
                  Para equipos grandes y operación compleja
                </div>
                <p className="mt-2 text-xs text-neutral-300">
                  Más asesores, más control, soporte y configuraciones a medida.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-neutral-200">
                  <li>• Desde 10 hasta 50 asesores.</li>
                  <li>• Soporte prioritario.</li>
                  <li>• Entrenamiento a medida.</li>
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

            <div className="mt-8 text-center text-sm text-neutral-400">
              ¿Querés que te ayudemos a implementarlo en tu equipo?{" "}
              <span
                className="cursor-pointer font-semibold text-[rgba(230,169,48,0.96)] hover:underline"
                onClick={() =>
                  openGmailCompose("info@vaiprop.com", "Consulta implementación")
                }
              >
                Escribinos.
              </span>
            </div>
          </div>
        </section>

        {/* PRÓXIMAS HERRAMIENTAS */}
        <section
          id="proximamente"
          className="border-b border-neutral-900 bg-[#050505]"
        >
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="mb-8 text-center">
              <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                Roadmap
              </p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-50 md:text-2xl">
                Próximamente, más herramientas en el mismo ecosistema
              </h2>
              <p className="mt-2 text-sm text-neutral-300">
                VAI Prop es una plataforma viva. Estas son algunas de las
                funcionalidades en roadmap para profundizar el análisis del
                negocio.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Próximamente
                </div>
                <h3 className="mt-2 text-sm font-semibold text-neutral-50">
                  Agente de IA
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Asistente automatizado para consultas frecuentes y soporte,
                  manteniendo la información ordenada.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Próximamente
                </div>
                <h3 className="mt-2 text-sm font-semibold text-neutral-50">
                  Manual de Ventas Inmobiliarias
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Guías, recursos y buenas prácticas para estandarizar procesos
                  y formar asesores.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-b border-neutral-900 bg-black">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="mb-8 text-center">
              <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                FAQs
              </p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-50 md:text-2xl">
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
                  plan pago, lo hacés desde tu dashboard.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Puedo sumar asesores a mi cuenta?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Sí. Según tu plan, vas a poder invitar asesores con su propio
                  usuario y definir qué pueden ver y editar.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿VAI Prop reemplaza mi CRM?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  VAI Prop se enfoca en informes de valuación, factibilidad y
                  gestión con enfoque de tracker analítico. Podés usarlo junto a
                  tu CRM actual o como base para estandarizar procesos.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Cómo se contrata un plan pago?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  El proceso es online. Desde tu panel vas a ver planes
                  disponibles y el flujo de pago. Si necesitás algo especial,
                  nos escribís y armamos un esquema personalizado.
                </p>
              </div>
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-7 py-2.5 text-sm font-semibold text-black shadow-[0_15px_45px_rgba(0,0,0,0.9)] hover:bg-[rgba(230,169,48,1)] transition"
              >
                Empezar ahora (gratis)
              </Link>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="bg-[#050505]">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-black via-neutral-950 to-black px-6 py-10 text-center shadow-[0_25px_65px_rgba(0,0,0,0.95)] md:px-10">
              <h2 className="text-xl font-semibold text-neutral-50 md:text-2xl">
                Ordená tu operación y vendé con información sólida
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-neutral-300">
                VAI Prop no reemplaza una tasación oficial, pero te permite
                generar valuaciones por método comparativo para respaldar tus
                tasaciones y presentaciones con clientes. Además, te ayuda a
                medir desempeño, ordenar tareas y trabajar con datos reales.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_15px_45px_rgba(0,0,0,0.9)] hover:bg-[rgba(230,169,48,1)] transition"
                >
                  Crear cuenta ahora
                </Link>
                <a
                  onClick={() =>
                    openGmailCompose("info@vaiprop.com", "Consulta general")
                  }
                  className="inline-flex cursor-pointer items-center justify-center rounded-full border border-neutral-700 px-6 py-2.5 text-sm font-medium text-neutral-100 hover:bg-neutral-900 transition"
                >
                  Hablar con el equipo
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modal de Calculadora UVA */}
      <UvaCalculatorModal open={uvaOpen} onClose={() => setUvaOpen(false)} />
    </div>
  );
}

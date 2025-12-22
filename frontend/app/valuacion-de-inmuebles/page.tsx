// frontend/app/valuacion-de-inmuebles/page.tsx

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import SiteNavbar from "@/components/SiteNavbar";

const baseUrl = "https://vaiprop.com";

export const metadata: Metadata = {
  title: "Valuación y Tasación de Inmuebles por Método Comparativo | VAI PROP",
  description:
    "Software para valuación y tasación de propiedades por Método Comparativo de Mercado. Cargá inmueble y comparables, ajustá con coeficiente de competitividad, guardá el informe y descargalo en PDF con tu marca.",
  alternates: {
    canonical: `${baseUrl}/valuacion-de-inmuebles`,
  },
  openGraph: {
    title: "Valuación y Tasación por Método Comparativo | VAI Prop",
    description:
      "Generá informes de valuación/tasación con comparables, coeficiente de competitividad, conclusiones y PDF con marca. Diseñado para inmobiliarias y profesionales.",
    url: `${baseUrl}/valuacion-de-inmuebles`,
    siteName: "VAI Prop",
    type: "website",
    images: [
      {
        url: `${baseUrl}/landing/images/Precio_sugerido.png`,
        width: 1200,
        height: 630,
        alt: "VAI Prop - Valuación por Método Comparativo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Valuación y Tasación por Método Comparativo | VAI Prop",
    description:
      "Informes VAI por método comparativo (ACM): comparables, coeficiente de competitividad, conclusiones y PDF con tu marca.",
    images: [`${baseUrl}/landing/images/Precio_sugerido.png`],
  },
  keywords: [
    "valuación de inmuebles",
    "tasación de propiedades",
    "método comparativo de mercado",
    "análisis comparativo de mercado",
    "ACM inmobiliario",
    "software para inmobiliarias",
    "informe de tasación PDF",
    "comparables inmobiliarios",
    "precio por m2",
    "tasador",
    "valuador inmobiliario",
  ],
};

export default function ValuacionDeInmueblesPage() {
  const accent = "#E6A930";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "VAI PROP",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${baseUrl}/valuacion-de-inmuebles`,
    description:
      "Software para valuación y tasación de inmuebles por método comparativo de mercado (ACM), con informes en PDF y marca propia.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "ARS",
      description: "Trial disponible (sin tarjeta para comenzar).",
    },
  };

  return (
    <div className="min-h-screen bg-black text-neutral-50 flex flex-col">
      {/* NAVBAR GLOBAL */}
      <SiteNavbar />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="flex-1 bg-black">
        {/* HERO */}
        <section
          className="border-b border-neutral-900"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(230,169,48,0.14), transparent 55%), radial-gradient(circle at bottom right, rgba(230,169,48,0.10), transparent 45%), #050505",
          }}
        >
          <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
            <div className="grid gap-10 md:grid-cols-[1.15fr_0.85fr] md:items-center">
              {/* Texto */}
              <div className="space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(230,169,48,0.3)] bg-[rgba(230,169,48,0.08)] px-3 py-1 text-xs font-medium tracking-wide text-[rgba(230,169,48,0.96)]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                  Valuador de Activos Inmobiliarios (Método Comparativo)
                </span>

                <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-50 sm:text-4xl">
                  Valuá y tasá inmuebles con{" "}
                  <span style={{ color: accent }}>criterio profesional</span> y
                  un informe listo para enviar
                </h1>

                <p className="text-sm text-neutral-300 sm:text-base max-w-2xl">
                  VAI Prop te ayuda a realizar una valuación por método
                  comparativo de mercado (ACM): cargás el inmueble, sumás hasta{" "}
                  <strong className="text-neutral-100">4 comparables</strong>,
                  ajustás el valor con el{" "}
                  <strong className="text-neutral-100">
                    coeficiente de competitividad
                  </strong>{" "}
                  y generás un informe prolijo con conclusiones y{" "}
                  <strong className="text-neutral-100">PDF con tu marca</strong>.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href="/auth/register"
                    className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_15px_45px_rgba(0,0,0,0.9)] hover:bg-[rgba(230,169,48,1)] transition"
                  >
                    Crear cuenta (trial)
                  </Link>

                  <Link
                    href="/landing/tutoriales"
                    className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-6 py-2.5 text-sm font-medium text-neutral-100 hover:bg-neutral-900 transition"
                  >
                    Ver tutoriales
                  </Link>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs text-neutral-400 sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                    Guardá y seguí editando luego
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                    Informe con datos de empresa y profesional
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                    Exportación a PDF para el cliente
                  </div>
                </div>
              </div>

              {/* Visual */}
              <div className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/70 shadow-[0_22px_60px_rgba(0,0,0,0.9)]">
                <div className="absolute inset-0 rounded-3xl border border-[rgba(230,169,48,0.18)] pointer-events-none" />
                <div className="relative h-72 w-full md:h-[420px] bg-black/60">
                  <Image
                    src="/landing/images/Precio_sugerido.png"
                    alt="Valuación por método comparativo en VAI Prop"
                    fill
                    sizes="(max-width: 768px) 100vw, 45vw"
                    className="object-contain p-4"
                    priority
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                </div>

                <div className="p-5">
                  <div className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                    Resultado
                  </div>
                  <div className="mt-2 text-sm text-neutral-200">
                    Precio sugerido + conclusiones para defender el informe con
                    claridad.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROBLEMAS / DOLOR */}
        <section className="border-b border-neutral-900 bg-black">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="mb-8 text-center">
              <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                El problema
              </p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-50 md:text-2xl">
                Tasar con Excel y PDFs manuales te hace perder tiempo (y calidad)
              </h2>
              <p className="mx-auto mt-3 max-w-3xl text-sm text-neutral-300">
                Cuando la valuación no está ordenada, se vuelve difícil sostener
                el precio frente al cliente. VAI Prop estandariza el proceso sin
                quitarte criterio profesional.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Tiempo
                </div>
                <h3 className="mt-2 text-sm font-semibold text-neutral-50">
                  Mucho armado manual
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Copiar/pegar, formatear, ordenar comparables y armar el PDF
                  consume horas.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Consistencia
                </div>
                <h3 className="mt-2 text-sm font-semibold text-neutral-50">
                  Informes disparejos
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Cada asesor arma el informe “a su manera”. Eso impacta en
                  calidad y marca.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                  Defensa del precio
                </div>
                <h3 className="mt-2 text-sm font-semibold text-neutral-50">
                  Falta de argumentación
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Sin conclusiones claras y comparables ordenados, es más difícil
                  sostener el valor sugerido.
                </p>
              </div>
            </div>

            <div className="mt-8 text-center">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-7 py-2.5 text-sm font-semibold text-black shadow-[0_15px_45px_rgba(0,0,0,0.9)] hover:bg-[rgba(230,169,48,1)] transition"
              >
                Quiero probar el valuador
              </Link>
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section className="border-b border-neutral-900 bg-[#050505]">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                  Cómo funciona
                </p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-50 md:text-2xl">
                  Un flujo claro para generar la valuación en minutos
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-neutral-300">
                  El profesional decide qué comparar y cómo interpretar el
                  mercado. VAI Prop ordena los datos, acelera el armado del
                  informe y lo deja listo para presentar.
                </p>
              </div>

              <div className="flex gap-2">
                <Link
                  href="/landing/tutoriales"
                  className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-5 py-2 text-xs font-semibold text-neutral-100 hover:bg-neutral-900 transition"
                >
                  Ver tutorial en video
                </Link>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/70 shadow-[0_18px_45px_rgba(0,0,0,0.85)]">
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(230,169,48,0.55)] bg-[rgba(230,169,48,0.12)] text-xs font-semibold text-[rgba(230,169,48,0.96)]">
                      1
                    </span>
                    <h3 className="text-sm font-semibold text-neutral-50">
                      Cargá inmueble + propietario
                    </h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                    Registrá los datos principales de la propiedad, sumá foto y
                    dejá todo guardado para continuar cuando quieras.
                  </p>
                </div>
                <div className="relative h-40 w-full border-t border-neutral-800 bg-black/40">
                  <Image
                    src="/landing/images/vai_propiedad.png"
                    alt="Carga de datos de la propiedad en VAI Prop"
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                </div>
              </div>

              <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/70 shadow-[0_18px_45px_rgba(0,0,0,0.85)]">
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(230,169,48,0.55)] bg-[rgba(230,169,48,0.12)] text-xs font-semibold text-[rgba(230,169,48,0.96)]">
                      2
                    </span>
                    <h3 className="text-sm font-semibold text-neutral-50">
                      Sumá comparables (hasta 4)
                    </h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                    Agregá datos y una foto por comparable. El informe calcula
                    promedio de valor por m² para llegar a un precio sugerido.
                  </p>
                </div>
                <div className="relative h-40 w-full border-t border-neutral-800 bg-black/40">
                  <Image
                    src="/landing/images/vai_comparables.png"
                    alt="Comparables y análisis comparativo de mercado"
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                </div>
              </div>

              <div className="flex flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/70 shadow-[0_18px_45px_rgba(0,0,0,0.85)]">
                <div className="p-5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(230,169,48,0.55)] bg-[rgba(230,169,48,0.12)] text-xs font-semibold text-[rgba(230,169,48,0.96)]">
                      3
                    </span>
                    <h3 className="text-sm font-semibold text-neutral-50">
                      Ajustá y cerrá con conclusiones + PDF
                    </h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                    Usá el coeficiente de competitividad y completá 4 apartados
                    de conclusiones para reforzar el valor sugerido. Exportá en
                    PDF con marca y datos del profesional.
                  </p>
                </div>
                <div className="relative h-40 w-full border-t border-neutral-800 bg-black/40">
                  <Image
                    src="/landing/images/informe_comparables.png"
                    alt="Conclusiones y valor sugerido de venta"
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-7 py-2.5 text-sm font-semibold text-black hover:bg-[rgba(230,169,48,1)] transition"
              >
                Empezar prueba GRATIS
              </Link>
              <a
                href="/landing/docs/ejemplo_informe_vai.pdf"
                className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-7 py-2.5 text-sm font-medium text-neutral-100 hover:bg-neutral-900 transition"
              >
                Ver ejemplo de informe (PDF)
              </a>
            </div>
          </div>
        </section>

        {/* COEFICIENTE DE COMPETITIVIDAD */}
        <section className="border-b border-neutral-900 bg-black">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-center">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                  Diferencial
                </p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-50 md:text-2xl">
                  Coeficiente de competitividad para acercarte al valor real de
                  mercado
                </h2>
                <p className="mt-3 text-sm text-neutral-300">
                  El precio sugerido parte del promedio del valor por m² de los
                  comparables, pero el mercado real se mueve por múltiples
                  factores. Por eso, VAI PROP incluye un coeficiente 
                  para ajustar el resultado según tu relevamiento.
                </p>

                <div className="mt-4 space-y-2 text-sm text-neutral-300">
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
                    <div className="text-xs font-semibold text-neutral-100">
                      Ejemplos de uso típico
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-neutral-300">
                      <li>
                        • Si un comparable lleva mucho tiempo publicado, puede
                        indicar un precio poco competitivo.
                      </li>
                      <li>
                        • Si sabés que el cierre suele estar 15–20% por debajo
                        del publicado, ajustás para reflejar esa realidad.
                      </li>
                      <li>
                        • Si tu inmueble tiene una ventaja clara (estado,
                        ubicación, amenities), podés reflejarlo con criterio.
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
                    <div className="text-xs font-semibold text-neutral-100">
                      Importante
                    </div>
                    <p className="mt-2 text-xs text-neutral-300">
                      VAI PROP ordena el análisis, pero la decisión final siempre
                      la toma el profesional (criterio, experiencia y
                      conocimiento del mercado).
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href="/auth/register"
                    className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-7 py-2.5 text-sm font-semibold text-black hover:bg-[rgba(230,169,48,1)] transition"
                  >
                    Probar con un caso real
                  </Link>
                  <Link
                    href="/landing/tutoriales"
                    className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-7 py-2.5 text-sm font-medium text-neutral-100 hover:bg-neutral-900 transition"
                  >
                    Ver cómo se usa
                  </Link>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/70 shadow-[0_22px_60px_rgba(0,0,0,0.9)]">
                <div className="absolute inset-0 rounded-3xl border border-[rgba(230,169,48,0.18)] pointer-events-none" />
                <div className="relative h-72 w-full md:h-[420px] bg-black/60">
                  <Image
                    src="/landing/images/vai_coeficiente.png"
                    alt="Panel de VAI Prop con análisis y métricas"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-contain p-4"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                </div>
                <div className="p-5">
                  <div className="text-xs font-semibold tracking-[0.22em] uppercase text-neutral-400">
                    Orden + criterio
                  </div>
                  <div className="mt-2 text-sm text-neutral-200">
                    Ajustes claros y defendibles para conversar con el cliente.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ MINI */}
        <section className="bg-[#050505]">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="mb-8 text-center">
              <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                FAQs
              </p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-50 md:text-2xl">
                Preguntas frecuentes sobre la valuación
              </h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Esto reemplaza al criterio del tasador/valuador?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  No. VAI Prop ordena el proceso y acelera el armado del informe.
                  La selección de comparables y el ajuste final son decisiones
                  profesionales.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Puedo guardar y seguir editando más tarde?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Sí. Podés guardar el informe como borrador y retomarlo cuando
                  quieras, sin perder información.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Qué incluye el PDF?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Datos de la empresa, nombre del profesional, N° de matrícula y
                  (si aplica) el asesor que lo generó, además del análisis,
                  comparables y conclusiones.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Puedo usarlo en mi inmobiliaria con asesores?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Sí. La plataforma está pensada para empresa y asesores, con
                  informes consistentes y marca unificada.
                </p>
              </div>
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-7 py-2.5 text-sm font-semibold text-black shadow-[0_15px_45px_rgba(0,0,0,0.9)] hover:bg-[rgba(230,169,48,1)] transition"
              >
                Crear cuenta y probar
              </Link>
              <div className="mt-4 text-xs text-neutral-400">
                
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

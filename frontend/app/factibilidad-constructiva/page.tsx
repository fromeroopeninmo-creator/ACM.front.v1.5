// frontend/app/factibilidad-constructiva/page.tsx

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import SiteNavbar from "@/components/SiteNavbar";

const siteUrl = "https://vaiprop.com";
const accent = "rgba(230,169,48,0.96)";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Factibilidad Constructiva para Lotes | Precio sugerido por Incidencia | VAI Prop",
  description:
    "Estimá un precio sugerido de venta para lotes con Factibilidad Constructiva: datos del lote + normativa (FOS/FOT/pisos) + eficiencia + unidades vendibles → incidencia zonal. Guardá, editá y descargá informes en PDF con tu marca.",
  alternates: {
    canonical: "/factibilidad-constructiva",
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/factibilidad-constructiva`,
    title: "Factibilidad Constructiva para Lotes | VAI Prop",
    description:
      "Ayudá a tus clientes con un informe profesional: análisis del lote, normativa, unidades vendibles y resultado final en incidencia zonal (valor sugerido del lote).",
  },
  twitter: {
    card: "summary_large_image",
    title: "Factibilidad Constructiva para Lotes | VAI Prop",
    description:
      "Informe de Factibilidad Constructiva: normativa + eficiencia + unidades → incidencia zonal (precio sugerido del lote).",
  },
};

function InfoCard({
  title,
  desc,
  bullets,
}: {
  title: string;
  desc: string;
  bullets: string[];
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.85)]">
      <h3 className="text-sm font-semibold text-neutral-50">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-neutral-300">{desc}</p>
      <ul className="mt-4 space-y-2 text-xs text-neutral-200">
        {bullets.map((b, i) => (
          <li key={i}>• {b}</li>
        ))}
      </ul>
    </div>
  );
}

function Step({
  step,
  title,
  desc,
}: {
  step: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.85)]">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(230,169,48,0.55)] bg-[rgba(230,169,48,0.12)] text-xs font-semibold text-[rgba(230,169,48,0.96)]">
          {step}
        </span>
        <h3 className="text-sm font-semibold text-neutral-50">{title}</h3>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-neutral-300">{desc}</p>
    </div>
  );
}

function ImageCard({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-black/60 shadow-[0_22px_55px_rgba(0,0,0,0.9)]">
      <div className="relative w-full">
        <div className="relative h-[220px] w-full sm:h-[260px] md:h-[300px]">
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-contain"
          />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
      </div>
      {caption && (
        <div className="border-t border-neutral-800 px-4 py-3">
          <div className="text-[11px] text-neutral-300">{caption}</div>
        </div>
      )}
    </div>
  );
}

export default function FactibilidadConstructivaPage() {
  return (
    <div className="min-h-screen bg-black text-neutral-50 flex flex-col">
      {/* NAVBAR GLOBAL */}
      <SiteNavbar />

      <main className="flex-1">
        {/* HERO */}
        <section
          className="border-b border-neutral-900"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(230,169,48,0.16), transparent 55%), radial-gradient(circle at bottom right, rgba(230,169,48,0.14), transparent 45%), #050505",
          }}
        >
          <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
            <div className="grid gap-10 md:gap-12 md:grid-cols-[1fr_1fr] md:items-center">
              <div className="space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(230,169,48,0.3)] bg-[rgba(230,169,48,0.08)] px-3 py-1 text-xs font-medium tracking-wide text-[rgba(230,169,48,0.96)]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                  Factibilidad Constructiva
                </span>

                <h1 className="text-balance text-3xl font-semibold tracking-tight text-neutral-50 sm:text-4xl lg:text-[2.65rem]">
                  Calculá el{" "}
                  <span style={{ color: accent }}>Precio Sugerido</span> de un lote con datos técnicos
                </h1>

                <p className="max-w-2xl text-sm leading-relaxed text-neutral-300 sm:text-base">
                  Ideal para inmobiliarias, arquitectos y desarrollistas: cargás datos del lote + normativa urbanistica
                  + eficiencia del proyecto y obtenés el resultado clave: <span className="text-neutral-100 font-semibold">Incidencia Zonal del Terreno</span>
                  . Guardás, editás y descargás el informe en PDF con tu marca.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link
                    href="/auth/register"
                    className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.95)] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_12px_35px_rgba(0,0,0,0.65)] hover:bg-[rgba(230,169,48,1)] transition"
                  >
                    Crear cuenta gratis
                  </Link>

                  <a
                    href="mailto:info@vaiprop.com?subject=Quiero%20una%20demo%20de%20Factibilidad%20Constructiva"
                    className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-5 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-900 transition"
                  >
                    Solicitar demo (15 min)
                  </a>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center pt-2">
                  <Link
                    href="/landing/tutoriales"
                    className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-5 py-2.5 text-xs font-semibold text-neutral-100 hover:bg-neutral-900 transition"
                  >
                    🎥 Ver tutoriales
                  </Link>
                  <a
                    href="/landing/docs/ejemplo_informe_factibilidad.pdf"
                    className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.35)] bg-[rgba(230,169,48,0.06)] px-5 py-2.5 text-xs font-semibold text-[rgba(230,169,48,0.96)] hover:bg-[rgba(230,169,48,0.10)] transition"
                  >
                    📄 Descargar ejemplo de informe (PDF)
                  </a>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-xs text-neutral-400 sm:text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                    Enfoque simple y práctico
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                    Informe con marca y logo
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgba(230,169,48,0.9)]" />
                    Guardar / editar / descargar PDF
                  </div>
                </div>
              </div>

              <div className="w-full md:w-[92%] lg:w-[90%] mx-auto rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-black p-4 md:p-5 shadow-[0_25px_60px_rgba(0,0,0,0.85)]">
              <div className="relative overflow-hidden rounded-[1.4rem] bg-black">
                <div className="relative w-full h-[220px] sm:h-[270px] md:h-[330px] lg:h-[380px]">
                  <div className="absolute inset-3 sm:inset-4">
                    <div className="relative h-full w-full">
                      <Image
                        src="/landing/hero/factibilidad_armado2.png"
                        alt="Hero de Factibilidad Constructiva - VAI Prop"
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-contain"
                        priority
                      />
                    </div>
                  </div>
            
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                </div>
              </div>
            
              <div className="mt-4 rounded-2xl border border-neutral-800 bg-black/70 px-5 py-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(230,169,48,0.9)]">
                  Resultado clave
                </div>
                <div className="mt-1 text-sm text-neutral-100">
                  Incidencia zonal = valor sugerido del lote.
                </div>
              </div>
            </div>
            </div>
          </div>
        </section>


        {/* PARA QUIÉN ES / PROBLEMAS */}
        <section className="border-b border-neutral-900 bg-black">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="mb-8 text-center">
              <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                Usos típicos
              </p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-50 md:text-2xl">
                Cuando el método comparativo no aplica, necesitás factibilidad
              </h2>
              <p className="mx-auto mt-3 max-w-3xl text-sm text-neutral-300">
                No todos los lotes son “apto desarrollo en altura”. Con Factibilidad Constructiva podés justificar un precio sugerido
                con variables técnicas, y explicarlo de forma profesional en un informe para tu cliente.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <InfoCard
                title="Lote chico / poco frente"
                desc="Muchas veces el potencial real del terreno está condicionado por el frente/fondo y la morfología."
                bullets={[
                  "Detectá rápidamente límites del proyecto.",
                  "Evitá “prometer” algo que no cierra.",
                  "Sustentá la recomendación con datos.",
                ]}
              />
              <InfoCard
                title="Casco histórico / conservar / demoler"
                desc="Si hay superficie a conservar o restricciones, el resultado cambia por completo."
                bullets={[
                  "Incluí demoliciones y superficies a conservar.",
                  "Reflejás escenarios más reales.",
                  "Mejor conversación con propietarios.",
                ]}
              />
              <InfoCard
                title="Normativa compleja"
                desc="FOS/FOT/pisos (según aplique) determinan m² construibles y el negocio posible."
                bullets={[
                  "Ordenás la normativa en un flujo simple.",
                  "Medís m² y unidades vendibles.",
                  "Llegás a la incidencia zonal (resultado).",
                ]}
              />
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA (PASOS) */}
        <section className="border-b border-neutral-900 bg-[#050505]">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                  Flujo real de la herramienta
                </p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-50 md:text-2xl">
                  Cómo se calcula el resultado en 4 etapas
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-neutral-300">
                  Pensado para asesorar: cargás datos básicos, normativa, supuestos de uso/eficiencia y obtenés un valor orientativo para
                  conversar con el propietario con argumentos claros.
                </p>
              </div>

              <div className="flex gap-2">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.85)] bg-[rgba(230,169,48,0.10)] px-5 py-2 text-xs font-semibold text-[rgba(230,169,48,0.96)] hover:bg-[rgba(230,169,48,0.18)] transition"
                >
                  Probar GRATIS
                </Link>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Step
                step="1"
                title="Datos del lote"
                desc="Superficie, frente/fondo, m² a demoler (si aplica) y m² a conservar (si aplica)."
              />
              <Step
                step="2"
                title="Normativa urbana"
                desc="Cargás FOS, FOT, cantidad de pisos y variables urbanísticas según aplique."
              />
              <Step
                step="3"
                title="Usos + eficiencia + unidades"
                desc="Definís eficiencia total (m² vendibles), m² por unidad y valor por unidad (obtenido del VAI) → unidades vendibles."
              />
              <Step
                step="4"
                title="Resultado + conclusiones"
                desc="Se obtiene la incidencia zonal (valor sugerido del lote) y redactás conclusiones para respaldar el informe."
              />
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <ImageCard
                src="/landing/images/factibilidad_seccion1.png"
                alt="Sección 1: datos del lote - Factibilidad Constructiva"
                caption="Sección 1: cargá superficie, frente/fondo y superficies especiales (demoler / conservar)."
              />
              <ImageCard
                src="/landing/images/factibilidad_preciosugerido_conclusiones.png"
                alt="Precio sugerido y conclusiones - Factibilidad Constructiva"
                caption="Resultado: incidencia zonal (precio sugerido orientativo) + conclusiones para defender el informe."
              />
            </div>
          </div>
        </section>

        {/* INFORME FINAL + DESCARGABLE */}
        <section className="border-b border-neutral-900 bg-black">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div>
                <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[rgba(230,169,48,0.9)]">
                  Entregable profesional
                </p>
                <h2 className="mt-2 text-xl font-semibold text-neutral-50 md:text-2xl">
                  Informe listo para enviar, con tu marca
                </h2>
                <p className="mt-3 max-w-2xl text-sm text-neutral-300">
                  Generá un PDF prolijo con logo, nombre de la empresa y datos del profesional. Ideal para presentarlo al propietario y
                  justificar el valor sugerido del lote con un criterio claro y replicable.
                </p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href="/landing/docs/ejemplo_informe_factibilidad.pdf"
                    className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_15px_45px_rgba(0,0,0,0.9)] hover:bg-[rgba(230,169,48,1)] transition"
                  >
                    📄 Descargar ejemplo (PDF)
                  </a>
                  <Link
                    href="/landing/tutoriales"
                    className="inline-flex items-center justify-center rounded-full border border-neutral-700 px-6 py-2.5 text-sm font-medium text-neutral-100 hover:bg-neutral-900 transition"
                  >
                    Ver tutoriales
                  </Link>
                </div>

                <div className="mt-4 text-xs text-neutral-400">
                  Nota: es una herramienta de apoyo para asesoramiento y presentación. El profesional define datos y criterios según su experiencia.
                </div>
              </div>

              <div className="rounded-3xl border border-neutral-800 bg-neutral-950/70 p-4 shadow-[0_25px_60px_rgba(0,0,0,0.85)]">
                <div className="relative overflow-hidden rounded-2xl bg-black">
                  <div className="relative h-[260px] w-full sm:h-[320px]">
                    <Image
                      src="/landing/images/factibilidad_informe.png"
                      alt="Vista del informe de Factibilidad Constructiva en VAI Prop"
                      fill
                      sizes="(max-width: 768px) 100vw, 45vw"
                      className="object-contain"
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                </div>

                <div className="mt-4 rounded-2xl border border-neutral-800 bg-black/70 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                    Incluye
                  </div>
                  <div className="mt-1 grid gap-1 text-xs text-neutral-200">
                    <div>• Datos del lote y normativa.</div>
                    <div>• Supuestos de uso, eficiencia y unidades.</div>
                    <div>• Incidencia zonal (resultado) + conclusiones.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-neutral-900 bg-[#050505]">
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
                  ¿Para quién está pensada esta herramienta?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Principalmente para inmobiliarias, arquitectos y constructoras pequeñas/medianas que necesitan estimar un valor sugerido
                  de un lote y explicarlo con un informe claro para el propietario.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿El resultado es un precio exacto?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Es un valor orientativo (incidencia zonal) calculado con supuestos y variables técnicas. El profesional define criterios,
                  referencias de valor por unidad y conclusiones según su experiencia y la zona.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Se puede guardar y editar después?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Sí. Podés guardar borradores, retomar más tarde y descargar el informe final en PDF cuando esté listo.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Incluye mi marca y datos del profesional?
                </h3>
                <p className="mt-2 text-xs text-neutral-300">
                  Sí. El informe se genera con tu logo y datos configurados en la cuenta, para que quede listo para presentar al cliente.
                </p>
              </div>
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/auth/register"
                className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-7 py-2.5 text-sm font-semibold text-black shadow-[0_15px_45px_rgba(0,0,0,0.9)] hover:bg-[rgba(230,169,48,1)] transition"
              >
                Probar Factibilidad Constructiva
              </Link>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="bg-black">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <div className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-black via-neutral-950 to-black px-6 py-10 text-center shadow-[0_25px_65px_rgba(0,0,0,0.95)] md:px-10">
              <h2 className="text-xl font-semibold text-neutral-50 md:text-2xl">
                Convertí una charla “difícil” en una recomendación clara
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm text-neutral-300">
                Cuando el lote tiene variables que cambian todo, un informe ordenado te ayuda a justificar el valor sugerido y a generar
                confianza en el cliente.
              </p>

              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  href="/auth/register"
                  className="inline-flex items-center justify-center rounded-full border border-[rgba(230,169,48,0.95)] bg-[rgba(230,169,48,0.98)] px-6 py-2.5 text-sm font-semibold text-black shadow-[0_15px_45px_rgba(0,0,0,0.9)] hover:bg-[rgba(230,169,48,1)] transition"
                >
                  Crear cuenta GRATIS
                </Link>
                <a
                  href="mailto:info@vaiprop.com?subject=Consulta%20Factibilidad%20Constructiva%20(VAI%20Prop)"
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

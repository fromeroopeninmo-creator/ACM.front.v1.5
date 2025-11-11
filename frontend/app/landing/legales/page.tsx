// app/landing/legales/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function LegalesPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const accent = "#E6A930";

  return (
    <div className="min-h-screen bg-black text-neutral-50 flex flex-col">
      {/* NAVBAR (igual estilo que la landing) */}
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
            <Link href="/#features" className="hover:text-[rgba(230,169,48,0.9)] transition">
              Herramientas
            </Link>
            <Link href="/#planes" className="hover:text-[rgba(230,169,48,0.9)] transition">
              Planes
            </Link>
            <Link href="/#proximamente" className="hover:text-[rgba(230,169,48,0.9)] transition">
              Próximas herramientas
            </Link>
            <Link href="/#faq" className="hover:text-[rgba(230,169,48,0.9)] transition">
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
                href="/#features"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-neutral-200 hover:bg-neutral-900"
              >
                Herramientas
              </Link>
              <Link
                href="/#planes"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-neutral-200 hover:bg-neutral-900"
              >
                Planes
              </Link>
              <Link
                href="/#proximamente"
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-2 text-neutral-200 hover:bg-neutral-900"
              >
                Próximas herramientas
              </Link>
              <Link
                href="/#faq"
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

      {/* CONTENIDO LEGALES */}
      <main className="flex-1 bg-[#050505]">
        <div className="mx-auto max-w-5xl px-4 py-10 md:py-14">
          {/* Encabezado */}
          <section className="mb-8 border-b border-neutral-900 pb-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(230,169,48,0.3)] bg-[rgba(230,169,48,0.08)] px-3 py-1 text-xs font-medium tracking-wide text-[rgba(230,169,48,0.96)]">
              Información legal y uso responsable
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-neutral-50 md:text-3xl">
              Términos, privacidad y uso de VAI Prop
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-300">
              Esta página resume las condiciones de uso, el tratamiento de tus
              datos y el alcance de los informes generados con la plataforma.
            </p>
          </section>

          {/* TÉRMINOS Y CONDICIONES */}
          <section id="terminos" className="mb-10 scroll-mt-24">
            <h2 className="text-lg font-semibold text-neutral-50">
              1. Términos y Condiciones de uso
            </h2>
            <p className="mt-2 text-sm text-neutral-300">
              Al crear una cuenta y utilizar VAI Prop, aceptás estos términos y
              confirmás que actuás en representación de una inmobiliaria,
              desarrolladora o actividad vinculada al mercado inmobiliario.
            </p>

            <div className="mt-4 space-y-3 text-sm text-neutral-300">
              <p>
                <span className="font-semibold text-neutral-100">
                  1.1 Objeto del servicio.
                </span>{" "}
                VAI Prop es una plataforma SaaS que te permite gestionar
                valuuaciones, informes de factibilidad y el trabajo de tus
                asesores comerciales. No somos parte de las operaciones de
                compraventa, alquiler o desarrollo que realices.
              </p>

              <p>
                <span className="font-semibold text-neutral-100">
                  1.2 Responsabilidad sobre los datos.
                </span>{" "}
                La información cargada en la plataforma (precios, superficies,
                zonificaciones, notas, etc.) es responsabilidad exclusiva de tu
                empresa. VAI Prop no garantiza la exactitud de datos externos ni
                reemplaza el criterio profesional.
              </p>

              <p>
                <span className="font-semibold text-neutral-100">
                  1.3 Uso aceptable.
                </span>{" "}
                Está prohibido el uso de la plataforma para actividades ilícitas,
                spam, scraping masivo o cualquier acción que pueda afectar la
                seguridad o disponibilidad del servicio para otros usuarios.
              </p>

              <p>
                <span className="font-semibold text-neutral-100">
                  1.4 Planes y límites.
                </span>{" "}
                Cada plan tiene límites de asesores, informes y funcionalidades.
                Los detalles y precios pueden actualizarse, pero siempre vas a
                poder ver las condiciones vigentes antes de contratar o cambiar
                de plan.
              </p>

              <p>
                <span className="font-semibold text-neutral-100">
                  1.5 Suspensión de cuentas.
                </span>{" "}
                VAI Prop puede suspender o limitar el acceso en caso de uso
                indebido, incumplimiento de pagos o violación grave de estos
                términos. En la medida de lo posible, se notificará con
                anticipación.
              </p>
            </div>
          </section>

          {/* POLÍTICA DE PRIVACIDAD */}
          <section id="privacidad" className="mb-10 scroll-mt-24">
            <h2 className="text-lg font-semibold text-neutral-50">
              2. Política de Privacidad
            </h2>
            <p className="mt-2 text-sm text-neutral-300">
              Nos tomamos en serio la privacidad de tus datos y los de tus
              clientes. A continuación resumimos cómo los usamos y protegemos.
            </p>

            <div className="mt-4 space-y-3 text-sm text-neutral-300">
              <p>
                <span className="font-semibold text-neutral-100">
                  2.1 Datos que recopilamos.
                </span>{" "}
                Cuando creás una cuenta podemos solicitar nombre, apellido,
                email, teléfono, datos de tu empresa (razón social, CUIT,
                condición fiscal) y datos de tus asesores. Además, registramos
                información técnica básica (IP, tipo de dispositivo, páginas
                visitadas) para mejorar la seguridad y el rendimiento.
              </p>

              <p>
                <span className="font-semibold text-neutral-100">
                  2.2 Finalidad del tratamiento.
                </span>{" "}
                Usamos tus datos para: (i) prestarte el servicio; (ii) generar
                informes e historiales; (iii) enviarte comunicaciones
                relacionadas con la cuenta, novedades y actualizaciones; (iv)
                cumplir con obligaciones legales y contables.
              </p>

              <p>
                <span className="font-semibold text-neutral-100">
                  2.3 Proveedores y terceros.
                </span>{" "}
                Algunos servicios de infraestructura (hosting, bases de datos,
                procesamiento de pagos, email transaccional, etc.) son
                provistos por terceros. Seleccionamos proveedores reconocidos y
                con buenas prácticas de seguridad. No vendemos tus datos a
                terceros.
              </p>

              <p>
                <span className="font-semibold text-neutral-100">
                  2.4 Seguridad.
                </span>{" "}
                Implementamos medidas razonables de seguridad técnica y
                organizativa para proteger tu información. Sin embargo, ningún
                sistema es 100% inviolable. Te recomendamos usar contraseñas
                robustas y no compartir tus claves de acceso.
              </p>

              <p>
                <span className="font-semibold text-neutral-100">
                  2.5 Derechos sobre tus datos.
                </span>{" "}
                Podés solicitar la actualización o eliminación de tus datos de
                contacto y de tu cuenta, salvo cuando debamos conservar cierta
                información por obligaciones legales o contables. Para esto
                podés escribirnos a{" "}
                <a
                  href="mailto:info@vaiprop.com"
                  className="text-[rgba(230,169,48,0.95)] underline-offset-2 hover:underline"
                >
                  info@vaiprop.com
                </a>
                .
              </p>
            </div>
          </section>

          {/* FAQS */}
          <section id="faqs" className="mb-10 scroll-mt-24">
            <h2 className="text-lg font-semibold text-neutral-50">
              3. Preguntas frecuentes
            </h2>
            <p className="mt-2 text-sm text-neutral-300">
              Algunas de las dudas que suelen aparecer al empezar a usar VAI
              Prop:
            </p>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Necesito tarjeta de crédito para registrarme?
                </h3>
                <p className="mt-1.5 text-xs text-neutral-300">
                  No. Podés crear tu cuenta, ingresar con el plan Trial y
                  probar la plataforma sin cargar datos de pago. Cuando decidas
                  pasar a un plan pago, vas a poder hacerlo desde tu dashboard.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Quién ve los datos que cargo en mis informes?
                </h3>
                <p className="mt-1.5 text-xs text-neutral-300">
                  Los datos de tus informes e inmuebles sólo son accesibles para
                  tu empresa y los usuarios (asesores) que vos habilites. El
                  equipo de VAI Prop sólo accede en casos puntuales de soporte
                  técnico o diagnóstico, y nunca para fines comerciales propios.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Puedo dar de baja mi cuenta?
                </h3>
                <p className="mt-1.5 text-xs text-neutral-300">
                  Sí, podés solicitar la baja escribiendo a{" "}
                  <a
                    href="mailto:soporte@vaiprop.com"
                    className="text-[rgba(230,169,48,0.95)] underline-offset-2 hover:underline"
                  >
                    soporte@vaiprop.com
                  </a>
                  . En caso de tener obligaciones de facturación o registro
                  vigentes, podríamos mantener algunos datos mínimos por el
                  plazo requerido por la normativa aplicable.
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4">
                <h3 className="text-sm font-semibold text-neutral-50">
                  ¿Los informes de VAI Prop reemplazan la tasación de un
                  profesional matriculado?
                </h3>
                <p className="mt-1.5 text-xs text-neutral-300">
                  No. Los informes son una herramienta de apoyo para profesionales
                  del sector. La responsabilidad por la tasación, el precio
                  sugerido y las decisiones de inversión es siempre de quien
                  utiliza la plataforma.
                </p>
              </div>
            </div>
          </section>

          {/* DISCLAIMER */}
          <section id="disclaimer" className="mb-4 scroll-mt-24">
            <h2 className="text-lg font-semibold text-neutral-50">
              4. Disclaimer y alcance de la información
            </h2>
            <div className="mt-3 space-y-3 text-sm text-neutral-300">
              <p>
                La información y los informes generados mediante VAI Prop tienen
                carácter orientativo y no constituyen asesoramiento legal,
                impositivo, contable ni financiero. Cada usuario debe validar la
                información con sus propias fuentes y profesionales de
                confianza.
              </p>
              <p>
                VAI Prop no se responsabiliza por decisiones comerciales,
                inversiones, tasaciones ni negociaciones realizadas en base a
                los informes emitidos por la plataforma, ni garantiza resultados
                económicos o comerciales específicos.
              </p>
              <p>
                El uso continuado de la plataforma implica la aceptación de estos
                términos, políticas y disclaimers. Si tenés dudas puntuales
                sobre el alcance legal, te recomendamos consultar con tu
                asesoría jurídica o contable.
              </p>
            </div>
          </section>
        </div>
      </main>
      {/* El footer global se agrega desde app/layout.tsx con <SiteFooter /> */}
    </div>
  );
}

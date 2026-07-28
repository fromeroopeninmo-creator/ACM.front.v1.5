"use client";

import Image from "next/image";
import Link from "next/link";
import PublicShell from "../components/PublicShell";
import { PublicIcon } from "../components/PublicIcons";

const pillars = [
  { href: "/analiza", label: "Analizá", title: "Defendé cada oportunidad con mejores datos", text: "Valuaciones profesionales, factibilidad preliminar, VAI Market Data y PER para argumentar con claridad y acelerar decisiones.", image: "/landing/images/vai_propiedad_principal.svg" },
  { href: "/gestiona", label: "Gestioná", title: "Ordená el trabajo comercial de tu inmobiliaria", text: "Tracker, agenda y gestión de equipo para seguir contactos, propiedades, actividades, captaciones y cierres sin perder oportunidades.", image: "/landing/images/tracker_actividades.png" },
  { href: "/medi", label: "Medí", title: "Convertí actividad en decisiones", text: "Analytics, rendimiento por asesor, calculadoras e indicadores económicos para saber qué funciona y dónde mejorar.", image: "/landing/images/asesores.svg" },
];

const trust = [
  "Datos sensibles opcionales: no necesitás cargar nombre, teléfono, email ni dirección exacta.",
  "Market Data agregado y anónimo: nunca expone contactos, clientes ni propiedades identificables.",
  "Puede convivir con tu CRM actual: VAI Prop se enfoca en análisis, gestión y rendimiento inmobiliario.",
  "Todos los planes incluyen la plataforma completa. Solo cambia la cantidad de usuarios habilitados.",
];

export default function LandingPage() {
  return <PublicShell>
    <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(circle_at_75%_15%,rgba(230,169,48,.20),transparent_30%)] px-5 py-20 sm:px-8 lg:px-14 lg:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <span className="inline-flex rounded-full border border-[#E6A930]/40 bg-[#E6A930]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[.18em] text-[#f0bf5b]">Inteligencia y rendimiento inmobiliario</span>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-7xl">Analizá, gestioná y medí mejor cada oportunidad inmobiliaria.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-neutral-300">VAI Prop reúne valuación, factibilidad, seguimiento comercial, rendimiento por asesor y datos de mercado en una sola plataforma diseñada para inmobiliarias y brokers.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link href="/auth/register" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#E6A930] px-6 py-3 font-bold text-black">Probá gratis 30 días <PublicIcon name="arrow"/></Link><Link href="/analiza" className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 font-semibold text-white hover:bg-white/10">Conocé la plataforma</Link></div>
          <p className="mt-4 text-xs text-neutral-500">Sin tarjeta. Acceso completo durante el período de prueba.</p>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 shadow-[0_30px_100px_rgba(0,0,0,.55)]"><Image src="/landing/images/vai_propiedad_principal.svg" alt="Panel de análisis de VAI Prop para inmobiliarias" fill priority className="object-contain p-5" sizes="(max-width: 1024px) 100vw, 45vw"/></div>
      </div>
    </section>

    <section className="border-b border-white/10 bg-neutral-950 px-5 py-8 sm:px-8"><div className="mx-auto grid max-w-6xl gap-4 text-center text-sm text-neutral-300 sm:grid-cols-3"><div><strong className="block text-2xl text-white">Una plataforma</strong>para todo el proceso comercial</div><div><strong className="block text-2xl text-white">Datos protegidos</strong>sin exponer tu cartera</div><div><strong className="block text-2xl text-white">30 días</strong>de prueba con acceso completo</div></div></section>

    <section className="px-5 py-20 sm:px-8 lg:px-14"><div className="mx-auto max-w-6xl"><div className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[.2em] text-[#E6A930]">Un flujo, tres pilares</p><h2 className="mt-4 text-3xl font-semibold sm:text-5xl">De la primera consulta al cierre, con más claridad.</h2><p className="mt-5 text-lg leading-8 text-neutral-300">La plataforma conecta análisis técnico, seguimiento comercial y medición del rendimiento para que tu equipo trabaje con mejores argumentos y menos información dispersa.</p></div><div className="mt-12 grid gap-6 lg:grid-cols-3">{pillars.map((pillar) => <Link href={pillar.href} key={pillar.href} className="group overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 transition hover:-translate-y-1 hover:border-[#E6A930]/50"><div className="relative aspect-[16/10] border-b border-white/10"><Image src={pillar.image} alt={pillar.title} fill className="object-contain p-5" sizes="(max-width: 1024px) 100vw, 33vw"/></div><div className="p-6"><span className="text-sm font-semibold text-[#E6A930]">{pillar.label}</span><h3 className="mt-2 text-xl font-semibold">{pillar.title}</h3><p className="mt-3 text-sm leading-6 text-neutral-400">{pillar.text}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white">Ver herramientas <PublicIcon name="arrow" className="h-4 w-4 transition group-hover:translate-x-1"/></span></div></Link>)}</div></div></section>

    <section className="border-y border-white/10 bg-neutral-950 px-5 py-20 sm:px-8 lg:px-14"><div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2"><div><p className="text-sm font-semibold uppercase tracking-[.2em] text-[#E6A930]">Aceleradores de venta</p><h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Transformá datos complejos en argumentos comerciales.</h2><p className="mt-5 text-lg leading-8 text-neutral-300">VAI Market Data y PER ayudan a contextualizar precios, comparar oportunidades y explicar con mayor claridad por qué una propiedad puede ser competitiva.</p><Link href="/analiza" className="mt-7 inline-flex items-center gap-2 font-semibold text-[#f2c76d]">Conocer los aceleradores <PublicIcon name="arrow"/></Link></div><div className="grid gap-4 sm:grid-cols-2"><div className="rounded-3xl border border-[#E6A930]/30 bg-[#E6A930]/10 p-6"><h3 className="text-xl font-semibold">VAI Market Data</h3><p className="mt-3 text-sm leading-6 text-neutral-300">Precios, medianas, valor por m², tiempos de venta, zonas y tipologías con información agregada y anónima.</p></div><div className="rounded-3xl border border-[#E6A930]/30 bg-[#E6A930]/10 p-6"><h3 className="text-xl font-semibold">PER inmobiliario</h3><p className="mt-3 text-sm leading-6 text-neutral-300">Una referencia simple para relacionar precio, renta y retorno, comparar opciones y respaldar conversaciones con inversores.</p></div></div></div></section>

    <section className="px-5 py-20 sm:px-8 lg:px-14"><div className="mx-auto max-w-6xl"><div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr]"><div><p className="text-sm font-semibold uppercase tracking-[.2em] text-[#E6A930]">Privacidad primero</p><h2 className="mt-4 text-3xl font-semibold sm:text-5xl">Tu cartera sigue siendo tuya.</h2><p className="mt-5 text-lg leading-8 text-neutral-300">Podés aprovechar VAI Prop sin exponer información que tu inmobiliaria considere sensible.</p></div><div className="grid gap-4">{trust.map((item) => <div key={item} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[.03] p-5"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E6A930] text-black"><PublicIcon name="check" className="h-4 w-4"/></span><p className="text-sm leading-6 text-neutral-300">{item}</p></div>)}</div></div></div></section>

    <section className="border-t border-white/10 bg-[radial-gradient(circle_at_center,rgba(230,169,48,.15),transparent_45%)] px-5 py-20 text-center sm:px-8"><div className="mx-auto max-w-3xl"><h2 className="text-3xl font-semibold sm:text-5xl">Potenciá tu inmobiliaria con una plataforma pensada para vender mejor.</h2><p className="mt-5 text-lg text-neutral-300">Todos los planes incluyen acceso completo. Elegí únicamente la cantidad de usuarios que necesita tu equipo.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/auth/register" className="rounded-full bg-[#E6A930] px-7 py-3 font-bold text-black">Comenzar prueba gratis</Link><Link href="/planes" className="rounded-full border border-white/20 px-7 py-3 font-semibold">Ver planes</Link></div></div></section>
  </PublicShell>;
}

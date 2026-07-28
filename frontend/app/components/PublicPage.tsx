import Image from "next/image";
import Link from "next/link";
import PublicShell from "./PublicShell";
import { PublicIcon } from "./PublicIcons";

export type ToolBlock = { eyebrow: string; title: string; description: string; benefits: string[]; image: string; imageAlt: string; accelerator?: boolean; note?: string };

export default function PublicPage({ eyebrow, title, intro, tools, closing }: { eyebrow: string; title: string; intro: string; tools: ToolBlock[]; closing: string }) {
  return <PublicShell>
    <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(230,169,48,.16),transparent_36%)] px-5 py-20 sm:px-8 lg:px-14">
      <div className="mx-auto max-w-6xl"><p className="mb-4 text-sm font-semibold uppercase tracking-[.22em] text-[#E6A930]">{eyebrow}</p><h1 className="max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">{title}</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-neutral-300">{intro}</p></div>
    </section>
    <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:px-14">
      <div className="space-y-20">{tools.map((tool, index) => <article key={tool.title} className={`grid items-center gap-10 lg:grid-cols-2 ${index % 2 ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div><div className="flex flex-wrap items-center gap-3"><span className="text-xs font-semibold uppercase tracking-[.2em] text-[#E6A930]">{tool.eyebrow}</span>{tool.accelerator && <span className="rounded-full border border-[#E6A930]/50 bg-[#E6A930]/10 px-3 py-1 text-xs font-semibold text-[#f2c76d]">Acelerador de venta</span>}</div><h2 className="mt-4 text-3xl font-semibold sm:text-4xl">{tool.title}</h2><p className="mt-5 text-base leading-7 text-neutral-300">{tool.description}</p><ul className="mt-6 grid gap-3">{tool.benefits.map((benefit) => <li key={benefit} className="flex gap-3 text-sm leading-6 text-neutral-200"><span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E6A930] text-black"><PublicIcon name="check" className="h-3.5 w-3.5"/></span>{benefit}</li>)}</ul>{tool.note && <p className="mt-5 rounded-xl border border-white/10 bg-white/[.04] p-4 text-xs leading-5 text-neutral-400">{tool.note}</p>}</div>
        <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 shadow-2xl"><Image src={tool.image} alt={tool.imageAlt} fill className="object-contain p-4" sizes="(max-width: 1024px) 100vw, 50vw"/></div>
      </article>)}</div>
    </div>
    <section className="border-t border-white/10 bg-neutral-950 px-5 py-16 text-center sm:px-8"><div className="mx-auto max-w-3xl"><h2 className="text-3xl font-semibold">{closing}</h2><p className="mt-4 text-neutral-300">Probá la plataforma completa durante 30 días y descubrí cómo aplicar estas herramientas en tu inmobiliaria.</p><Link href="/auth/register" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#E6A930] px-6 py-3 font-bold text-black">Comenzar prueba gratis <PublicIcon name="arrow"/></Link></div></section>
  </PublicShell>;
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PublicIcon } from "./PublicIcons";

const links = [
  { name: "Inicio", href: "/", icon: "home" },
  { name: "Analizá", href: "/analiza", icon: "analyze" },
  { name: "Gestioná", href: "/gestiona", icon: "manage" },
  { name: "Medí", href: "/medi", icon: "measure" },
  { name: "Planes", href: "/planes", icon: "plans" },
  { name: "Blog", href: "/blog", icon: "resources" },
  { name: "Webinars", href: "/webinars", icon: "resources" },
];

export default function PublicSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const items = (mobile = false) => (
    <nav className="space-y-1.5" aria-label="Navegación pública">
      {links.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`group/item flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${active ? "bg-[#E6A930] text-black" : "text-white/85 hover:bg-white/10 hover:text-white"}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center"><PublicIcon name={item.icon}/></span>
          <span className={mobile ? "truncate" : "max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/sidebar:max-w-[170px] group-hover/sidebar:opacity-100"}>{item.name}</span>
        </Link>;
      })}
    </nav>
  );

  return <>
    <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-black/95 px-4 backdrop-blur md:hidden">
      <Link href="/" className="flex items-center gap-2"><Image src="/landing/images/logo-vai7.png" alt="VAI Prop" width={34} height={34}/><span className="font-semibold tracking-[0.18em] text-[#E6A930]">VAI PROP</span></Link>
      <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-white/15 p-2 text-white" aria-label="Abrir menú"><PublicIcon name="menu"/></button>
    </div>

    <aside className="group/sidebar fixed bottom-0 left-0 top-0 z-50 hidden w-[72px] overflow-hidden border-r border-white/10 bg-black px-3 py-4 text-white shadow-2xl transition-[width] duration-300 hover:w-60 md:flex md:flex-col">
      <Link href="/" className="mb-8 flex h-10 items-center gap-3 px-1"><Image src="/landing/images/logo-vai7.png" alt="VAI Prop" width={38} height={38} className="shrink-0"/><span className="max-w-0 overflow-hidden whitespace-nowrap font-semibold tracking-[0.18em] text-[#E6A930] opacity-0 transition-all group-hover/sidebar:max-w-[170px] group-hover/sidebar:opacity-100">VAI PROP</span></Link>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{items(false)}</div>
      <div className="space-y-2 pt-4">
        <Link href="/auth/login" className="group/item flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-white/85 hover:bg-white/10"><span className="flex h-8 w-8 shrink-0 items-center justify-center"><PublicIcon name="login"/></span><span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all group-hover/sidebar:max-w-[170px] group-hover/sidebar:opacity-100">Ingresar</span></Link>
        <Link href="/auth/register" className="flex min-h-11 items-center justify-center rounded-xl bg-[#E6A930] px-3 text-sm font-bold text-black"><span className="group-hover/sidebar:hidden">+</span><span className="hidden whitespace-nowrap group-hover/sidebar:inline">Probá gratis 30 días</span></Link>
      </div>
    </aside>

    {open && <button aria-label="Cerrar menú" className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setOpen(false)}/>} 
    <aside className={`fixed bottom-0 left-0 top-0 z-[60] w-72 max-w-[88vw] bg-black p-4 text-white shadow-2xl transition-transform md:hidden ${open ? "translate-x-0" : "-translate-x-full"}`} aria-hidden={!open}>
      <div className="mb-7 flex items-center justify-between"><Link href="/" className="flex items-center gap-2"><Image src="/landing/images/logo-vai7.png" alt="VAI Prop" width={36} height={36}/><span className="font-semibold tracking-[0.18em] text-[#E6A930]">VAI PROP</span></Link><button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-white/15 p-2" aria-label="Cerrar menú"><PublicIcon name="close"/></button></div>
      {items(true)}
      <div className="mt-7 grid gap-3"><Link href="/auth/login" className="rounded-xl border border-white/20 px-4 py-3 text-center font-semibold">Ingresar</Link><Link href="/auth/register" className="rounded-xl bg-[#E6A930] px-4 py-3 text-center font-bold text-black">Probá gratis 30 días</Link></div>
    </aside>
  </>;
}

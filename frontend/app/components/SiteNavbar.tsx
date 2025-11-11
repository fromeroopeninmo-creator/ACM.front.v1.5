// components/SiteNavbar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";

export default function SiteNavbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-900 bg-black/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo + nombre */}
        <Link href="/landing" className="flex items-center gap-2">
          <Image
            src="/landing/images/logo-vai7.png"
            alt="VAI Prop"
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
          <span className="text-sm font-semibold tracking-[0.2em] text-amber-400 uppercase">
            VAI Prop
          </span>
        </Link>

        {/* Links + botones */}
        <nav className="flex items-center gap-4 text-xs sm:text-sm">
          <Link
            href="/landing#funcionalidades"
            className="hidden text-neutral-300 hover:text-white md:inline-block"
          >
            Funcionalidades
          </Link>
          <Link
            href="/landing#planes"
            className="hidden text-neutral-300 hover:text-white md:inline-block"
          >
            Planes
          </Link>
          <Link
            href="/landing#proximamente"
            className="hidden text-neutral-300 hover:text-white md:inline-block"
          >
            Próximamente
          </Link>

          <Link
            href="/auth/login"
            className="rounded-full border border-amber-500/60 px-3 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500 hover:text-black sm:px-4 sm:py-1.5"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/auth/register"
            className="hidden rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-black shadow-sm hover:bg-amber-400 sm:inline-block sm:px-4 sm:py-1.5"
          >
            Registrate
          </Link>
        </nav>
      </div>
    </header>
  );
}

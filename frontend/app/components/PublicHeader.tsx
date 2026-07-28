"use client";

import Image from "next/image";
import Link from "next/link";
import { PublicIcon } from "./PublicIcons";

type PublicHeaderProps = {
  onOpenMenu: () => void;
};

export default function PublicHeader({ onOpenMenu }: PublicHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-[70] h-16 border-b border-white/10 bg-black/95 backdrop-blur-xl">
      <div className="relative mx-auto flex h-full max-w-[1600px] items-center justify-between px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMenu}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 text-white transition hover:border-[#E6A930]/60 hover:bg-white/5 md:invisible"
          aria-label="Abrir menú"
        >
          <PublicIcon name="menu" />
        </button>

        <Link
          href="/"
          className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2.5"
          aria-label="Ir al inicio de VAI Prop"
        >
          <Image
            src="/landing/images/logo-vai7.png"
            alt="VAI Prop"
            width={34}
            height={34}
            priority
            className="h-8 w-8 object-contain sm:h-9 sm:w-9"
          />
          <span className="hidden text-sm font-semibold tracking-[0.2em] text-[#E6A930] sm:inline">
            VAI PROP
          </span>
        </Link>

        <Link
          href="/auth/login"
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#E6A930]/70 px-4 text-sm font-semibold text-[#f2c76d] transition hover:bg-[#E6A930] hover:text-black sm:px-5"
        >
          Ingresar
        </Link>
      </div>
    </header>
  );
}

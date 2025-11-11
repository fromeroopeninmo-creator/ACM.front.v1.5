// app/components/SiteFooter.tsx
"use client";

import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-900 bg-black">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 text-xs text-neutral-500 md:flex-row md:items-center md:justify-between">
        {/* Texto principal */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span>© {year} VAI Prop.</span>
            <span className="hidden sm:inline">Todos los derechos reservados.</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/landing/legales"
              className="hover:text-neutral-300 transition"
            >
              Términos y Condiciones
            </Link>
            <Link
              href="/landing/legales"
              className="hover:text-neutral-300 transition"
            >
              Política de Privacidad
            </Link>
            <Link
              href="/landing/legales"
              className="hover:text-neutral-300 transition"
            >
              Preguntas frecuentes
            </Link>
            <Link
              href="/landing/legales"
              className="hover:text-neutral-300 transition"
            >
              Disclaimer
            </Link>
          </div>
        </div>

        {/* Redes sociales */}
        <div className="flex items-center gap-4 text-neutral-500">
          <a
            href="https://www.instagram.com/tu_cuenta"
            target="_blank"
            rel="noreferrer"
            className="hover:text-neutral-300 transition"
            aria-label="Instagram"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="5"
                ry="5"
              />
              <circle cx="12" cy="12" r="4.2" />
              <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" />
            </svg>
          </a>

          <a
            href="https://www.facebook.com/tu_cuenta"
            target="_blank"
            rel="noreferrer"
            className="hover:text-neutral-300 transition"
            aria-label="Facebook"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="currentColor"
            >
              <path d="M13.5 22v-7h2.4l.4-3h-2.8V9.4c0-.9.3-1.5 1.6-1.5H16V5.2C15.7 5.2 14.9 5.1 14 5.1 11.8 5.1 10.3 6.4 10.3 9v3H8v3h2.3v7h3.2z" />
            </svg>
          </a>

          <a
            href="https://wa.me/5490000000000"
            target="_blank"
            rel="noreferrer"
            className="hover:text-neutral-300 transition"
            aria-label="WhatsApp"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 32 32"
              aria-hidden="true"
              fill="currentColor"
            >
              <path d="M16 5.2A10.77 10.77 0 0 0 5.2 16a10.6 10.6 0 0 0 1.6 5.6L5 27l5.5-1.8A10.9 10.9 0 0 0 16 26.8 10.8 10.8 0 0 0 26.8 16 10.77 10.77 0 0 0 16 5.2Zm0 18.8a8.87 8.87 0 0 1-4.5-1.2l-.3-.2-3.3 1.1 1.1-3.2-.2-.3a8.66 8.66 0 0 1-1.3-4.6A8.7 8.7 0 0 1 16 7.3 8.7 8.7 0 0 1 24.7 16 8.7 8.7 0 0 1 16 24Z" />
              <path d="M20.4 18.5c-.2-.1-1.3-.6-1.5-.7s-.4-.1-.6.1-.7.8-.8.9-.3.2-.5.1a7.26 7.26 0 0 1-3.8-3.2c-.3-.5.3-.5.8-1.6.1-.2 0-.3 0-.4s-.6-1.5-.8-2-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3.07 3.07 0 0 0-1 2.2 5.33 5.33 0 0 0 1.1 2.8 11.85 11.85 0 0 0 4.6 3.9 5.24 5.24 0 0 0 3.1.6 2.64 2.64 0 0 0 1.8-1.3 2.17 2.17 0 0 0 .2-1.3c-.1-.1-.2-.1-.4-.2Z" />
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}

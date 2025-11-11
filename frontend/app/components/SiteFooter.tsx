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
            <span className="hidden sm:inline">
              Todos los derechos reservados.
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/landing/legales#terminos"
              className="hover:text-neutral-300 transition"
            >
              Términos y Condiciones
            </Link>
            <Link
              href="/landing/legales#privacidad"
              className="hover:text-neutral-300 transition"
            >
              Política de Privacidad
            </Link>
            <Link
              href="/landing/legales#faqs"
              className="hover:text-neutral-300 transition"
            >
              Preguntas frecuentes
            </Link>
            <Link
              href="/landing/legales#disclaimer"
              className="hover:text-neutral-300 transition"
            >
              Disclaimer
            </Link>
          </div>
        </div>

        {/* Soporte + Redes sociales */}
        <div className="flex flex-col items-start gap-2 text-neutral-500 md:items-end">
          {/* Botón de soporte */}
          <a
            href="mailto:soporte@vaiprop.com"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-700 px-3 py-1.5 text-[11px] font-semibold text-neutral-100 hover:bg-neutral-900 hover:text-white transition"
          >
            {/* Icono sobre (email) */}
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <rect
                x="3.2"
                y="5"
                width="17.6"
                height="14"
                rx="2"
                ry="2"
              />
              <path d="M4 7l8 6 8-6" />
            </svg>
            Contactar soporte
          </a>

          {/* Texto + íconos redes */}
          <div className="flex flex-col items-start gap-1 md:items-end">
            <span className="text-[11px] uppercase tracking-wide text-neutral-500">
              Seguinos en redes
            </span>
            <div className="flex items-center gap-4 text-neutral-500">
              {/* Instagram */}
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

              {/* Facebook */}
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

              {/* LinkedIn */}
              <a
                href="https://www.linkedin.com/company/tu_cuenta"
                target="_blank"
                rel="noreferrer"
                className="hover:text-neutral-300 transition"
                aria-label="LinkedIn"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  fill="currentColor"
                >
                  <path d="M4.98 3.5C4.98 4.6 4.1 5.5 3 5.5 1.9 5.5 1 4.6 1 3.5 1 2.4 1.9 1.5 3 1.5c1.1 0 1.98.9 1.98 2zM2.1 8.25h1.8V22H2.1V8.25zM8.7 8.25H10.4V9.7h.03c.24-.45.86-1.05 1.78-1.05 1.9 0 2.74 1.25 2.74 3.37V22h-1.8v-8.1c0-1.38-.03-3.16-1.93-3.16-1.93 0-2.22 1.5-2.22 3.06V22H8.7V8.25z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

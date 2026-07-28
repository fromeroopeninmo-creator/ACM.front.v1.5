import Link from "next/link";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return <footer className="border-t border-white/10 bg-black text-neutral-400">
    <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-4 md:pl-24">
      <div><p className="font-semibold tracking-[.16em] text-[#E6A930]">VAI PROP</p><p className="mt-3 text-sm leading-6">Plataforma de inteligencia y rendimiento para inmobiliarias.</p><p className="mt-4 text-xs">Versión 3.0</p></div>
      <div><p className="text-sm font-semibold text-white">Plataforma</p><div className="mt-4 grid gap-2 text-sm"><Link href="/analiza" className="hover:text-white">Analizá</Link><Link href="/gestiona" className="hover:text-white">Gestioná</Link><Link href="/medi" className="hover:text-white">Medí</Link><Link href="/planes" className="hover:text-white">Planes</Link></div></div>
      <div><p className="text-sm font-semibold text-white">Recursos</p><div className="mt-4 grid gap-2 text-sm"><Link href="/blog" className="hover:text-white">Blog</Link><Link href="/webinars" className="hover:text-white">Webinars</Link><Link href="/landing/tutoriales" className="hover:text-white">Tutoriales</Link><Link href="/landing/faqs" className="hover:text-white">Preguntas frecuentes</Link></div></div>
      <div><p className="text-sm font-semibold text-white">Contacto y legales</p><div className="mt-4 grid gap-2 text-sm"><a href="mailto:info@vaiprop.com" className="hover:text-white">info@vaiprop.com</a><a href="https://wa.me/5493513280798" target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp</a><Link href="/landing/legales#terminos" className="hover:text-white">Términos y condiciones</Link><Link href="/landing/legales#privacidad" className="hover:text-white">Privacidad</Link></div></div>
    </div>
    <div className="border-t border-white/10 px-5 py-5 text-center text-xs md:pl-24">© {year} VAI Prop. Todos los derechos reservados.</div>
  </footer>;
}

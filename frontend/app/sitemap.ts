// frontend/app/sitemap.ts
import type { MetadataRoute } from "next";

const baseUrl = "https://vaiprop.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    // Landing principal (home)
    {
      url: `${baseUrl}/`,
      lastModified,
    },

    // Auth públicas (si querés que Google sepa que existen)
    {
      url: `${baseUrl}/auth/login`,
      lastModified,
    },
    {
      url: `${baseUrl}/auth/register`,
      lastModified,
    },

    // Acá podrías agregar otras páginas públicas futuras:
    // - /precios
    // - /faqs
    // - /contacto
    // etc.
  ];
}

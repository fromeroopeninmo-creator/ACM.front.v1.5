// frontend/app/sitemap.ts
import type { MetadataRoute } from "next";

const baseUrl = "https://vaiprop.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    // Landing principal (canónica)
    {
      url: `${baseUrl}/`,
      lastModified,
    },

    // Tutoriales (página pública existente)
    {
      url: `${baseUrl}/landing/tutoriales`,
      lastModified,
    },

    // Cuando publiques las páginas públicas nuevas, agregalas acá:
    // - /valuacion-de-inmuebles
    // - /factibilidad-constructiva
    // - /tracker-de-actividades
    // - /tracker-de-negocios
    // - /metricas-de-tu-empresa
    // - /blog
  ];
}

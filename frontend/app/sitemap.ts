// frontend/app/sitemap.ts
import type { MetadataRoute } from "next";

const baseUrl = "https://vaiprop.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    // Home (por si tenés contenido o redirección)
    {
      url: `${baseUrl}/`,
      lastModified,
    },
    // Landing principal
    {
      url: `${baseUrl}/landing`,
      lastModified,
    },
    // Auth públicas
    {
      url: `${baseUrl}/auth/login`,
      lastModified,
    },
    {
      url: `${baseUrl}/auth/register`,
      lastModified,
    },
  ];
}

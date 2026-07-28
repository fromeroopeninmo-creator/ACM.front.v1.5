import type { MetadataRoute } from "next";
const baseUrl = "https://vaiprop.com";
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${baseUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/analiza`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/gestiona`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/medi`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/planes`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/blog`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/webinars`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${baseUrl}/landing/tutoriales`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/landing/faqs`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/landing/legales`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}

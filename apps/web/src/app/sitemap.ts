import type { MetadataRoute } from "next";

const SITE = "https://build.matrixhub.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ["/matrix-builder", "/examples", "/docs", "/terms", "/privacy"];
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    ...routes.map((r) => ({ url: `${SITE}${r}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}

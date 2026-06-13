import type { MetadataRoute } from "next";

const SITE = "https://build.matrixhub.io";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = ["/matrix-builder/builds", "/examples", "/docs", "/terms", "/privacy"];
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/matrix-builder`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/matrix-builder/about`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    ...routes.map((r) => ({ url: `${SITE}${r}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Matrix Builder",
    short_name: "Matrix Builder",
    description: "Give AI coders a contract, not a prompt.",
    start_url: "/matrix-builder",
    display: "standalone",
    background_color: "#02170f",
    theme_color: "#02170f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

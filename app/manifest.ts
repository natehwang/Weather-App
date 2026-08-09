import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fogcast",
    short_name: "Fogcast",
    description:
      "One city with dozens of microclimates. SF changes its mind about the weather every hour and every couple blocks. We're keeping tabs in real-time so you don't have to.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#2f6fd6",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

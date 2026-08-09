import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SF Microclimate Weather",
    short_name: "SF Weather",
    description: "Hyperlocal weather for San Francisco and Marin County, tuned for cyclists.",
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

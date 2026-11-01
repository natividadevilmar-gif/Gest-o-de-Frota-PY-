import type { MetadataRoute } from "next";

/** Deixa a KM Cero ser instalada no celular (e no computador) como um aplicativo, sem loja. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KM Cero · Gestão de frota",
    short_name: "KM Cero",
    description: "Mapa ao vivo, alertas, telemetria e custos da frota.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#111827",
    theme_color: "#111827",
    lang: "pt-BR",
    icons: [
      { src: "/marca/app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/marca/app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/marca/app-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Mapa ao vivo", url: "/rastreamento", icons: [{ src: "/marca/app-192.png", sizes: "192x192" }] },
      { name: "Central de monitoramento", url: "/monitoramento", icons: [{ src: "/marca/app-192.png", sizes: "192x192" }] },
      { name: "Lançar despesa", url: "/despesas", icons: [{ src: "/marca/app-192.png", sizes: "192x192" }] },
    ],
  };
}

import type { Metadata } from "next";
import "./globals.css";
import { Tradutor } from "@/components/Tradutor";
import { idiomaAtual } from "@/lib/i18n/atual";
import { LANG_HTML } from "@/lib/i18n/idiomas";

export const metadata: Metadata = {
  title: "KM Cero · Gestão de frota",
  description: "Custo por km, consumo, revisões e margem por viagem para transportadoras do Paraguai.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const idioma = await idiomaAtual();
  return (
    // data-traduzindo esconde a página até os textos estarem no idioma escolhido (no máximo 1,5 s).
    <html lang={LANG_HTML[idioma]} data-traduzindo={idioma !== "pt" ? "" : undefined} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Montserrat:wght@800&display=swap"
        />
      </head>
      <body>
        {children}
        {idioma !== "pt" && <Tradutor idioma={idioma} />}
      </body>
    </html>
  );
}

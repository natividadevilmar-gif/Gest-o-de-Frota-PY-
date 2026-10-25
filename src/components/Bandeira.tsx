import type { ReactNode } from "react";
import { temaDoPais } from "@/lib/temas";

// Bandeiras desenhadas em 30×20, simplificadas mas fiéis ao desenho de cada país.
const DESENHOS: Record<string, ReactNode> = {
  PY: <><rect width="30" height="20" fill="#0038A8" /><rect width="30" height="13.33" fill="#FFF" /><rect width="30" height="6.67" fill="#D52B1E" /><circle cx="15" cy="10" r="2.4" fill="none" stroke="#0038A8" strokeWidth=".6" /><circle cx="15" cy="10" r=".9" fill="#FCD116" /></>,
  BR: <><rect width="30" height="20" fill="#009C3B" /><path d="M15 2.2 27.6 10 15 17.8 2.4 10Z" fill="#FFDF00" /><circle cx="15" cy="10" r="4.6" fill="#002776" /><path d="M10.6 8.9q4.6-1 8.9 1.6" stroke="#FFF" strokeWidth=".8" fill="none" /></>,
  AR: <><rect width="30" height="20" fill="#74ACDF" /><rect y="6.67" width="30" height="6.67" fill="#FFF" /><circle cx="15" cy="10" r="1.9" fill="#F6B40E" /></>,
  UY: <><rect width="30" height="20" fill="#FFF" />{[2.22, 6.67, 11.11, 15.56].map((y) => <rect key={y} y={y} width="30" height="2.22" fill="#0038A8" />)}<rect width="11" height="11.11" fill="#FFF" /><circle cx="5.5" cy="5.5" r="2.6" fill="#FCD116" /></>,
  DE: <><rect width="30" height="20" fill="#FFCE00" /><rect width="30" height="13.33" fill="#DD0000" /><rect width="30" height="6.67" fill="#000" /></>,
  NL: <><rect width="30" height="20" fill="#21468B" /><rect width="30" height="13.33" fill="#FFF" /><rect width="30" height="6.67" fill="#AE1C28" /></>,
  IT: <><rect width="30" height="20" fill="#CE2B37" /><rect width="20" height="20" fill="#FFF" /><rect width="10" height="20" fill="#009246" /></>,
  ES: <><rect width="30" height="20" fill="#AA151B" /><rect y="5" width="30" height="10" fill="#F1BF00" /></>,
  US: <><rect width="30" height="20" fill="#FFF" />{[0, 3.08, 6.15, 9.23, 12.31, 15.38, 18.46].map((y) => <rect key={y} y={y} width="30" height="1.54" fill="#B22234" />)}<rect width="12" height="10.77" fill="#3C3B6E" /></>,
  JP: <><rect width="30" height="20" fill="#FFF" /><circle cx="15" cy="10" r="6" fill="#BC002D" /></>,
};

export function Bandeira({ pais }: { pais: string }) {
  const t = temaDoPais(pais);
  const desenho = DESENHOS[pais] ?? DESENHOS.PY;
  return (
    <svg className="bandeira" viewBox="0 0 30 20" role="img" aria-label={`Bandeira: ${t.nome}`}>
      {desenho}
    </svg>
  );
}

/** Variáveis de cor do tema do cliente, sobrepostas às padrão do Paraguai. */
export function EstiloTema({ pais }: { pais: string }) {
  const t = temaDoPais(pais);
  const css =
    `:root{--accent:${t.destaque};--accent-ink:${t.destaqueTexto};--accent-soft:${t.destaqueSuave};--road:${t.barra};--road-ink:${t.barraTexto}}` +
    `@media (prefers-color-scheme: dark){:root{--accent:${t.destaqueEscuro};--accent-ink:#141715;--accent-soft:${t.destaqueSuaveEscuro}}}`;
  return <style>{css}</style>;
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { trocarIdioma } from "@/lib/i18n/acoes";
import { IDIOMAS, NOME_IDIOMA, SIGLA_IDIOMA, type Idioma } from "@/lib/i18n/idiomas";

// Rótulo do botão em todos os idiomas, para quem não lê o atual achar o seletor.
const ROTULO: Record<Idioma, string> = { pt: "Idioma", es: "Idioma", en: "Language", de: "Sprache", it: "Lingua" };
const PADRAO: Record<Idioma, string> = { pt: "padrão", es: "predeterminado", en: "default", de: "Standard", it: "predefinita" };

/** Botão de idioma da barra do topo (e da tela de login). */
export function SeletorIdioma({ atual, claro = false }: { atual: Idioma; claro?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [trocando, iniciar] = useTransition();
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", fora); document.removeEventListener("keydown", esc); };
  }, [aberto]);

  const escolher = (i: Idioma) => {
    setAberto(false);
    if (i === atual) return;
    // Recarrega a página inteira: os textos voltam do servidor no idioma novo.
    iniciar(async () => { await trocarIdioma(i); window.location.reload(); });
  };

  return (
    <div ref={caixa} className={`nav-menu nav-direita seletor-idioma${claro ? " claro" : ""}`} translate="no">
      <button type="button" className="nav-botao" aria-expanded={aberto} aria-haspopup="true" aria-label={`${ROTULO[atual]}: ${NOME_IDIOMA[atual]}`} title={ROTULO[atual]} onClick={() => setAberto(!aberto)} disabled={trocando}>
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="6.5" /><path d="M1.5 8h13M8 1.5c2 2 2.8 4.2 2.8 6.5S10 12.5 8 14.5M8 1.5C6 3.5 5.2 5.7 5.2 8s.8 4.5 2.8 6.5" /></svg>
        <b>{SIGLA_IDIOMA[atual]}</b>
      </button>
      {aberto && (
        <div className="nav-lista" role="menu">
          {IDIOMAS.map((i) => (
            <button key={i} type="button" role="menuitemradio" aria-checked={i === atual} className={i === atual ? "idioma-item atual" : "idioma-item"} onClick={() => escolher(i)} lang={i}>
              <span className="idioma-sigla">{SIGLA_IDIOMA[i]}</span> {NOME_IDIOMA[i]}
              {i === "pt" && <small>{PADRAO[atual]}</small>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

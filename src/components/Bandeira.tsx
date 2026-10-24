import { temaDoPais } from "@/lib/temas";

export function Bandeira({ pais }: { pais: string }) {
  const t = temaDoPais(pais);
  return (
    <span className="bandeira" role="img" aria-label={`Cores: ${t.nome}`}>
      {t.faixas.map((c, i) => <span key={i} style={{ background: c }} />)}
    </span>
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

// Gráficos do Dashboard, desenhados no servidor com HTML e um SVG simples (sem biblioteca).
// Cada marca tem uma dica (tooltip) ao passar o mouse ou tocar, e os valores ficam escritos ao lado.

const dataCurta = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** Escala "redonda" para o eixo: 0 até um teto bonito (1, 2, 2,5 ou 5 × 10ⁿ). */
function teto(max: number): number {
  if (max <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (max <= m * p) return m * p;
  return 10 * p;
}

type Fmt = (n: number) => string;

/** Linha (com área) de um valor por dia, com a média de 7 dias tracejada. */
export function GraficoLinha({ pontos, media, fmt, nome }: { pontos: { dia: Date; valor: number }[]; media?: { dia: Date; valor: number }[]; fmt: Fmt; nome: string }) {
  const n = pontos.length;
  const top = teto(Math.max(...pontos.map((p) => p.valor), 0));
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (v / top) * 100;
  const linha = pontos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p.valor).toFixed(2)}`).join("");
  const area = `${linha}L100,100L0,100Z`;
  const mm = media?.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p.valor).toFixed(2)}`).join("");
  const marcas = [0, Math.floor((n - 1) / 2), n - 1];
  return (
    <div className="gl" role="img" aria-label={`${nome}: ${pontos.map((p) => `${dataCurta(p.dia)} ${fmt(p.valor)}`).join(", ")}`}>
      <div className="gl-eixo">{[top, top / 2, 0].map((v) => <span key={v}>{fmt(v)}</span>)}</div>
      <div className="gl-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" x2="100" y1="50" y2="50" className="gl-grade" vectorEffect="non-scaling-stroke" />
          <path d={area} className="gl-area" />
          {mm && <path d={mm} className="gl-media" vectorEffect="non-scaling-stroke" />}
          <path d={linha} className="gl-linha" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="gl-colunas">
          {pontos.map((p, i) => (
            <div key={i} className="gl-col" tabIndex={0}>
              <i className="gl-cursor" />
              <i className="gl-ponto" style={{ bottom: `${100 - y(p.valor)}%` }} />
              <span className={`dica ${i > n * 0.66 ? "dica-esq" : ""}`}>
                <b>{dataCurta(p.dia)}</b> {fmt(p.valor)}
                {media && <small>média 7 dias: {fmt(media[i].valor)}</small>}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="gl-datas">{marcas.map((i, k) => <span key={k}>{dataCurta(pontos[i].dia)}</span>)}</div>
    </div>
  );
}

/** Barras agrupadas por semana: duas séries no mesmo eixo (ex.: fretes e despesas). */
export function GraficoSemanas({ semanas, series, fmt }: { semanas: { inicio: Date; fim: Date; valores: number[] }[]; series: [string, string]; fmt: Fmt }) {
  const top = teto(Math.max(...semanas.flatMap((s) => s.valores), 0));
  return (
    <div className="gb">
      <div className="legenda-g">
        {series.map((s, k) => <span key={s}><i className={`g-cor g${k + 1}`} />{s}</span>)}
      </div>
      <div className="gb-corpo">
        <div className="gl-eixo">{[top, top / 2, 0].map((v) => <span key={v}>{fmt(v)}</span>)}</div>
        <div className="gb-plot">
          <i className="gb-meio" />
          {semanas.map((s, i) => (
            <div key={i} className="gb-grupo" tabIndex={0}>
              {s.valores.map((v, k) => <i key={k} className={`gb-barra g${k + 1}`} style={{ height: `${(v / top) * 100}%` }} />)}
              <span className={`dica ${i > semanas.length * 0.6 ? "dica-esq" : ""}`}>
                <b>{dataCurta(s.inicio)} a {dataCurta(s.fim)}</b>
                {s.valores.map((v, k) => <small key={k}><i className={`g-cor g${k + 1}`} />{series[k]}: {fmt(v)}</small>)}
                <small>Diferença: {fmt(s.valores[0] - s.valores[1])}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="gb-datas">{semanas.map((s, i) => <span key={i}>{dataCurta(s.fim)}</span>)}</div>
    </div>
  );
}

export type ItemBarra = { nome: string; valor: number; detalhe?: string; ref?: number };

/**
 * Barras deitadas, uma por item, com o valor escrito ao lado. Valores negativos crescem para a
 * esquerda em outra cor (ex.: caminhão no prejuízo); `ref` desenha um traço de referência.
 */
export function BarrasH({ itens, fmt, refNome, largo, vazio = "Sem dados no período." }: { itens: ItemBarra[]; fmt: Fmt; refNome?: string; largo?: boolean; vazio?: string }) {
  if (itens.length === 0) return <p className="note">{vazio}</p>;
  const temNeg = itens.some((i) => i.valor < 0);
  const max = Math.max(...itens.map((i) => Math.max(Math.abs(i.valor), i.ref ?? 0)), 0.0001);
  const pct = (v: number) => (Math.abs(v) / max) * (temNeg ? 50 : 100);
  return (
    <div className={`bh ${largo ? "bh-largo" : ""}`}>
      {itens.map((i) => (
        <div key={i.nome} className="bh-linha" tabIndex={0}>
          <span className="bh-nome">{i.nome}</span>
          <span className={`bh-trilho ${temNeg ? "bh-div" : ""}`}>
            <i
              className={`bh-barra ${i.valor < 0 ? "g2" : "g1"}`}
              style={temNeg ? { width: `${pct(i.valor)}%`, [i.valor < 0 ? "right" : "left"]: "50%" } : { width: `${pct(i.valor)}%` }}
            />
            {i.ref !== undefined && <i className="bh-ref" style={{ left: `${pct(i.ref)}%` }} title={`${refNome ?? "Referência"}: ${fmt(i.ref)}`} />}
          </span>
          <span className="bh-valor">{fmt(i.valor)}{i.detalhe && <small>{i.detalhe}</small>}</span>
        </div>
      ))}
      {refNome && <p className="note"><i className="bh-ref-legenda" /> {refNome}</p>}
    </div>
  );
}

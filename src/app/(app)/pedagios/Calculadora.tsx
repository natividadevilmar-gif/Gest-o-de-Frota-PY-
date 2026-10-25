"use client";

import { useState } from "react";
import { num, usd } from "@/lib/formato";
import { EIXOS_TARIFA_FIXA, previstoRota, SIMBOLO_PEDAGIO, type RotaComPracas, type Taxas } from "@/lib/pedagio";

type Cam = { id: string; placa: string; eixos: number };

export function Calculadora({ rotas, taxas, caminhoes }: { rotas: RotaComPracas[]; taxas: Taxas; caminhoes: Cam[] }) {
  const [rotaId, setRotaId] = useState(rotas[0]?.id ?? "");
  const [eixos, setEixos] = useState(caminhoes[0]?.eixos ?? 6);
  const rota = rotas.find((r) => r.id === rotaId);
  const p = rota ? previstoRota(rota.pracas, eixos, taxas) : null;

  return (
    <>
      <div className="form">
        <label htmlFor="rota">Rota
          <select id="rota" value={rotaId} onChange={(e) => setRotaId(e.target.value)}>
            {rotas.map((r) => <option key={r.id} value={r.id}>{r.nome} · {num(r.km)} km</option>)}
          </select>
        </label>
        <label htmlFor="eixos">Caminhão
          <select id="eixos" value={eixos} onChange={(e) => setEixos(Number(e.target.value))}>
            {caminhoes.map((c) => <option key={c.id} value={c.eixos}>{c.placa} · {c.eixos} eixos</option>)}
            {[5, 6, 7, 9].map((n) => <option key={`n${n}`} value={n}>{n} eixos</option>)}
          </select>
        </label>
      </div>
      {p && (
        <>
          <div className="resumo-frete">
            <div><span>Pedágio previsto (ida)</span><b>{usd(p.usd, 2)}</b><small>{p.porMoeda.map((m) => `${SIMBOLO_PEDAGIO[m.moeda] ?? m.moeda} ${num(m.valor, m.moeda === "PYG" ? 0 : 2)}`).join(" + ")}</small></div>
            <div><span>Ida e volta</span><b>{usd(p.usd * 2, 2)}</b><small>volta vazia pode pagar menos (eixo suspenso)</small></div>
            <div><span>Por km</span><b>{rota && rota.km ? usd(p.usd / rota.km, 3) : "–"}</b><small>{p.itens.length} praças</small></div>
          </div>
          <div className="tw">
            <table>
              <thead><tr><th>Praça</th><th>Rodovia</th><th className="n">Cobrança</th><th className="n">Valor</th><th className="n">USD</th></tr></thead>
              <tbody>
                {p.itens.map((i) => (
                  <tr key={i.id}>
                    <td>{i.nome}</td>
                    <td>{i.pais} · {i.rodovia}</td>
                    <td className="n">{i.tarifaEixo != null ? `${SIMBOLO_PEDAGIO[i.moeda]} ${num(i.tarifaEixo, 2)} × ${eixos} eixos` : eixos > EIXOS_TARIFA_FIXA ? `${SIMBOLO_PEDAGIO[i.moeda]} ${num(i.tarifaFixa, i.moeda === "PYG" ? 0 : 2)} + ${eixos - EIXOS_TARIFA_FIXA} eixos extras` : "caminhão pesado (até 6 eixos)"}</td>
                    <td className="n">{SIMBOLO_PEDAGIO[i.moeda]} {num(i.valor, i.moeda === "PYG" ? 0 : 2)}</td>
                    <td className="n">{usd(i.usd, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {eixos > EIXOS_TARIFA_FIXA && p.itens.some((i) => i.tarifaEixo == null) && <p className="note">Nas praças com tarifa por caminhão, os eixos acima de 6 foram somados pela proporção da tarifa (estimativa). Confira no primeiro recibo do bitrem.</p>}
          {p.semValor.length > 0 && <p className="note">Sem tarifa: {p.semValor.join(", ")}.</p>}
        </>
      )}
    </>
  );
}

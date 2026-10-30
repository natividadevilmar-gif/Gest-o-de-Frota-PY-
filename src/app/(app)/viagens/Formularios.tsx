"use client";

import { useState, useTransition } from "react";
import { freteSugeridoTonelada, simularFrete } from "@/lib/indicadores";
import { num, usd } from "@/lib/formato";
import { previstoRota, SIMBOLO_PEDAGIO, type Praca, type Taxas } from "@/lib/pedagio";
import { PAISES } from "../fretes/NovoFrete";
import { excluirRota, kmEntreCidades, salvarRota } from "./actions";

/** kmL: consumo medido no mês (ou o de referência); outrosKm: custo por km sem diesel, quando há despesas. */
type Cam = { id: string; placa: string; eixos: number; kmL: number | null; outrosKm: number | null };
export type RotaSalva = { id: string; origem: string; paisOrigem: string; destino: string; paisDestino: string; km: number; pracas: string[] };

/** Vazio, o caminhão faz mais km por litro que carregado. */
const FATOR_VAZIO = 1.3;
const arred = (n: number, casas = 2) => Math.round(n * 10 ** casas) / 10 ** casas;

/**
 * Campo numérico que guarda o texto digitado: apagar o campo deixa vazio (conta como 0)
 * em vez de virar "0", e digitar depois não fica "09".
 */
function Numero({ valor, mudar, ...props }: { valor: number; mudar: (n: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [texto, setTexto] = useState(String(valor));
  // Valor trocado por fora (outro caminhão, rota calculada): mostra o novo.
  if (Number(texto.replace(",", ".")) !== valor && !(texto === "" && valor === 0)) setTexto(String(valor));
  return (
    <input
      {...props}
      type="number"
      value={texto}
      onChange={(e) => {
        const t = e.target.value.replace(/^0+(?=\d)/, "");
        setTexto(t);
        mudar(t === "" ? 0 : Number(t));
      }}
    />
  );
}

export function Simulador({ caminhoes, rotas, pracas, taxas, precoDiesel, paisCliente }: { caminhoes: Cam[]; rotas: RotaSalva[]; pracas: Praca[]; taxas: Taxas; precoDiesel: number; paisCliente: string }) {
  const pais0 = PAISES[paisCliente] ? paisCliente : "PY";
  const kmLDe = (c?: Cam) => arred(c?.kmL ?? 2.5, 1);
  const [id, setId] = useState(caminhoes[0]?.id ?? "");
  const c = caminhoes.find((x) => x.id === id) ?? caminhoes[0];
  const [rotaId, setRotaId] = useState("");
  const [origem, setOrigem] = useState("");
  const [paisOrigem, setPaisOrigem] = useState(pais0);
  const [destino, setDestino] = useState("");
  const [paisDestino, setPaisDestino] = useState(pais0);
  const [km, setKm] = useState(480);
  // Praças do caminho, achadas ao calcular o km; null enquanto a rota não foi calculada.
  const [noCaminho, setNoCaminho] = useState<string[] | null>(null);
  const [ton, setTon] = useState(30);
  const [pr, setPr] = useState(26);
  const [voltaVazio, setVoltaVazio] = useState(true);
  const [kmLC, setKmLC] = useState(kmLDe(c));
  const [kmLV, setKmLV] = useState(arred(kmLDe(c) * FATOR_VAZIO, 1));
  const [diesel, setDiesel] = useState(arred(precoDiesel));
  const [outrosKm, setOutrosKm] = useState(arred(c?.outrosKm ?? 0, 3));
  const [extras, setExtras] = useState(0);
  const [alvo, setAlvo] = useState(20);
  const [aviso, setAviso] = useState<{ ok: boolean; msg: string } | null>(null);
  const [ocupado, iniciar] = useTransition();

  const porId = new Map(pracas.map((p) => [p.id, p]));
  const ped = c && noCaminho ? previstoRota(noCaminho.flatMap((id) => porId.get(id) ?? []), c.eixos, taxas) : null;
  const pedagioIda = ped?.usd ?? 0;
  const s = simularFrete({ toneladas: ton, freteTonelada: pr, kmIda: km, voltaVazio, kmLCarregado: kmLC, kmLVazio: kmLV, precoDiesel: diesel, outrosKm, pedagioIda, extras });
  const sugerido = freteSugeridoTonelada(s.custo, ton, alvo);

  function trocarCaminhao(novo: string) {
    setId(novo);
    const n = caminhoes.find((x) => x.id === novo);
    setKmLC(kmLDe(n));
    setKmLV(arred(kmLDe(n) * FATOR_VAZIO, 1));
    setOutrosKm(arred(n?.outrosKm ?? 0, 3));
  }

  function escolherRota(v: string) {
    setRotaId(v);
    setAviso(null);
    const salva = rotas.find((r) => r.id === v);
    if (salva) {
      setOrigem(salva.origem); setPaisOrigem(salva.paisOrigem);
      setDestino(salva.destino); setPaisDestino(salva.paisDestino);
      setKm(salva.km); setNoCaminho(salva.pracas);
    }
  }

  // Mudou a cidade: o pedágio da rota anterior não vale mais até calcular de novo.
  const mudarCidade = (f: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { f(e.target.value); setNoCaminho(null); setRotaId(""); };

  const calcularKm = () => iniciar(async () => {
    setAviso(null);
    const r = await kmEntreCidades({ origem, paisOrigem, destino, paisDestino });
    if ("erro" in r) setAviso({ ok: false, msg: r.erro });
    else {
      setKm(r.km);
      setNoCaminho(r.pracas);
      setAviso({ ok: true, msg: `${origem} → ${destino}: ${num(r.km)} km de estrada, ${r.pracas.length ? `${r.pracas.length} ${r.pracas.length === 1 ? "praça" : "praças"} de pedágio no caminho` : "sem praça de pedágio no caminho"}.` });
    }
  });

  const guardarRota = () => iniciar(async () => {
    const r = await salvarRota({ origem, paisOrigem, destino, paisDestino, km, pracas: noCaminho ?? [] });
    setAviso(r);
    if (r.id) setRotaId(r.id);
  });

  const apagarRota = () => iniciar(async () => {
    await excluirRota(rotaId);
    setRotaId("");
    setAviso({ ok: true, msg: "Rota excluída." });
  });

  return (
    <>
      <h3 className="sim-titulo">Rota</h3>
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="sRota">Rota pré-definida
          <select id="sRota" value={rotaId} onChange={(e) => escolherRota(e.target.value)}>
            <option value="">Nova rota (digitar as cidades)</option>
            {rotas.length > 0 && <optgroup label="Rotas salvas">{rotas.map((r) => <option key={r.id} value={r.id}>{r.origem} → {r.destino} · {num(r.km)} km</option>)}</optgroup>}
          </select>
        </label>
        <label htmlFor="sOrigem">Cidade de origem<input id="sOrigem" value={origem} onChange={mudarCidade(setOrigem)} placeholder="Ciudad del Este" /></label>
        <label htmlFor="sPaisO">País<select id="sPaisO" value={paisOrigem} onChange={mudarCidade(setPaisOrigem)}>{Object.entries(PAISES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <label htmlFor="sDestino">Cidade de destino<input id="sDestino" value={destino} onChange={mudarCidade(setDestino)} placeholder="Asunción" /></label>
        <label htmlFor="sPaisD">País<select id="sPaisD" value={paisDestino} onChange={mudarCidade(setPaisDestino)}>{Object.entries(PAISES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <button type="button" onClick={calcularKm} disabled={ocupado || origem.trim().length < 2 || destino.trim().length < 2}>{ocupado ? "Calculando…" : "Calcular km"}</button>
        <label htmlFor="sKm">km de ida<Numero id="sKm" min="1" valor={km} mudar={setKm} /></label>
        <button type="button" onClick={guardarRota} disabled={ocupado || origem.trim().length < 2 || destino.trim().length < 2 || km < 1}>Salvar rota</button>
        {rotas.some((r) => r.id === rotaId) && <button type="button" onClick={apagarRota} disabled={ocupado}>Excluir rota</button>}
        {aviso && <p className={`msg ${aviso.ok ? "ok" : "bad"}`} role="status">{aviso.msg}</p>}
      </form>
      {ped && ped.itens.length > 0 && (
        <div className="tw">
          <table>
            <thead><tr><th>Praça de pedágio no caminho</th><th>Rodovia</th><th className="n">Valor ({c?.eixos} eixos)</th><th className="n">USD</th></tr></thead>
            <tbody>
              {ped.itens.map((i) => (
                <tr key={i.id}><td>{i.nome}</td><td>{i.pais} · {i.rodovia}</td><td className="n">{SIMBOLO_PEDAGIO[i.moeda] ?? i.moeda} {num(i.valor, i.moeda === "PYG" ? 0 : 2)}</td><td className="n">{usd(i.usd, 2)}</td></tr>
              ))}
              <tr><td colSpan={3}><b>Total da ida</b>{voltaVazio ? " (a volta vazio paga de novo)" : ""}</td><td className="n"><b>{usd(ped.usd, 2)}</b></td></tr>
            </tbody>
          </table>
        </div>
      )}
      {ped && ped.semValor.length > 0 && <p className="note">Sem tarifa cadastrada: {ped.semValor.join(", ")}.</p>}
      {!noCaminho && <p className="note">Clique em Calcular km para achar as praças de pedágio do caminho.</p>}

      <h3 className="sim-titulo">Carga e caminhão</h3>
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="sCam">Caminhão
          <select id="sCam" value={id} onChange={(e) => trocarCaminhao(e.target.value)}>
            {caminhoes.map((x) => <option key={x.id} value={x.id}>{x.placa} · {x.eixos} eixos</option>)}
          </select>
        </label>
        <label htmlFor="sTon">Toneladas<Numero id="sTon" min="1" valor={ton} mudar={setTon} /></label>
        <label htmlFor="sPr">Frete por tonelada (USD)<Numero id="sPr" min="0" step="0.5" valor={pr} mudar={setPr} /></label>
        <label className="check" htmlFor="sVazio"><input id="sVazio" type="checkbox" checked={voltaVazio} onChange={(e) => setVoltaVazio(e.target.checked)} /> Volta vazio (soma a volta no km, no diesel e no pedágio)</label>
      </form>

      <h3 className="sim-titulo">Custos</h3>
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="sKmLC">km/l carregado<Numero id="sKmLC" min="0.5" step="0.1" valor={kmLC} mudar={setKmLC} /></label>
        <label htmlFor="sKmLV">km/l vazio<Numero id="sKmLV" min="0.5" step="0.1" valor={kmLV} disabled={!voltaVazio} mudar={setKmLV} /></label>
        <label htmlFor="sDiesel">Diesel (USD/litro)<Numero id="sDiesel" min="0" step="0.01" valor={diesel} mudar={setDiesel} /></label>
        <label htmlFor="sOutros">Outros custos por km (USD)<Numero id="sOutros" min="0" step="0.01" valor={outrosKm} mudar={setOutrosKm} /></label>
        <label htmlFor="sExtras">Aduana, despachante, chapa (USD)<Numero id="sExtras" min="0" step="1" valor={extras} mudar={setExtras} /></label>
      </form>
      <p className="note">
        km/l {c?.kmL ? "medido pela CAN neste mês" : "padrão de 2,5 (sem leitura CAN no mês)"}; outros custos por km {c?.outrosKm ? "das despesas do mês (manutenção, pneus, motorista, seguro…)" : "sem despesas no mês: informe manutenção, pneus, motorista e seguro por km"}.
      </p>

      <div className="resumo-frete">
        <div><span>Distância</span><b>{num(s.kmTotal)} km</b><small>{num(km)} ida{voltaVazio ? ` + ${num(s.kmVolta)} volta vazio` : ", volta carregado"}</small></div>
        <div><span>Diesel</span><b>{num(s.litros)} litros</b><small>{usd(s.diesel)} a {usd(diesel, 2)}/l</small></div>
        <div><span>Custo da viagem</span><b>{usd(s.custo)}</b><small>diesel {usd(s.diesel, 0)} + outros {usd(s.outros, 0)} + pedágio {usd(s.pedagio, 0)}{s.pedagio ? (voltaVazio ? " (ida e volta)" : " (ida)") : ""}{extras ? ` + extras ${usd(extras, 0)}` : ""}</small></div>
        <div><span>Frete</span><b>{usd(s.frete)}</b><small>{num(ton)} t × {usd(pr, 2)}</small></div>
        <div><span>Margem</span><b className={s.margem < 0 ? "t-bad" : "t-ok"}>{usd(s.margem)} <small>{num(s.margemPct, 0)}%</small></b><small>custo de {usd(s.custoKm, 2)} por km rodado</small></div>
        <div>
          <span>Frete sugerido</span>
          <b>{usd(sugerido, 2)}/t</b>
          <small>
            para margem de <Numero aria-label="Margem desejada (%)" className="sim-alvo" min="0" max="90" valor={alvo} mudar={setAlvo} />% · mínimo sem prejuízo {usd(s.freteMinimoTonelada, 2)}/t
          </small>
        </div>
      </div>
    </>
  );
}

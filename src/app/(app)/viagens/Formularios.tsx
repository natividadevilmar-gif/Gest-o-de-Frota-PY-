"use client";

import { useState, useTransition } from "react";
import { freteSugeridoTonelada, simularFrete } from "@/lib/indicadores";
import { num, usd } from "@/lib/formato";
import { previstoRota, type RotaComPracas, type Taxas } from "@/lib/pedagio";
import { PAISES } from "../fretes/NovoFrete";
import { excluirRota, kmEntreCidades, salvarRota } from "./actions";

/** kmL: consumo medido no mês (ou o de referência); outrosKm: custo por km sem diesel, quando há despesas. */
type Cam = { id: string; placa: string; eixos: number; kmL: number | null; outrosKm: number | null };
export type RotaSalva = { id: string; origem: string; paisOrigem: string; destino: string; paisDestino: string; km: number; rotaPedagioId: string | null };

/** Vazio, o caminhão faz mais km por litro que carregado. */
const FATOR_VAZIO = 1.3;
const arred = (n: number, casas = 2) => Math.round(n * 10 ** casas) / 10 ** casas;

export function Simulador({ caminhoes, rotas, corredores, taxas, precoDiesel, paisCliente }: { caminhoes: Cam[]; rotas: RotaSalva[]; corredores: RotaComPracas[]; taxas: Taxas; precoDiesel: number; paisCliente: string }) {
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
  const [corredor, setCorredor] = useState("");
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

  const cor = corredores.find((r) => r.id === corredor);
  const pedagioIda = cor && c ? previstoRota(cor.pracas, c.eixos, taxas).usd : 0;
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
      setKm(salva.km); setCorredor(salva.rotaPedagioId ?? "");
      return;
    }
    const corr = corredores.find((r) => `c:${r.id}` === v);
    if (corr) { setKm(corr.km); setCorredor(corr.id); }
  }

  const calcularKm = () => iniciar(async () => {
    setAviso(null);
    const r = await kmEntreCidades({ origem, paisOrigem, destino, paisDestino });
    if ("erro" in r) setAviso({ ok: false, msg: r.erro });
    else { setKm(r.km); setAviso({ ok: true, msg: `${origem} → ${destino}: ${num(r.km)} km de estrada.` }); }
  });

  const guardarRota = () => iniciar(async () => {
    const r = await salvarRota({ origem, paisOrigem, destino, paisDestino, km, rotaPedagioId: corredor || undefined });
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
            {corredores.length > 0 && <optgroup label="Corredores com pedágio">{corredores.map((r) => <option key={r.id} value={`c:${r.id}`}>{r.nome} · {num(r.km)} km</option>)}</optgroup>}
          </select>
        </label>
        <label htmlFor="sOrigem">Cidade de origem<input id="sOrigem" value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ciudad del Este" /></label>
        <label htmlFor="sPaisO">País<select id="sPaisO" value={paisOrigem} onChange={(e) => setPaisOrigem(e.target.value)}>{Object.entries(PAISES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <label htmlFor="sDestino">Cidade de destino<input id="sDestino" value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Asunción" /></label>
        <label htmlFor="sPaisD">País<select id="sPaisD" value={paisDestino} onChange={(e) => setPaisDestino(e.target.value)}>{Object.entries(PAISES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <button type="button" onClick={calcularKm} disabled={ocupado || origem.trim().length < 2 || destino.trim().length < 2}>{ocupado ? "Calculando…" : "Calcular km"}</button>
        <label htmlFor="sKm">km de ida<input id="sKm" type="number" min="1" value={km} onChange={(e) => setKm(+e.target.value)} /></label>
        <label htmlFor="sCorredor">Pedágio pelo corredor
          <select id="sCorredor" value={corredor} onChange={(e) => setCorredor(e.target.value)}>
            <option value="">Sem pedágio</option>
            {corredores.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </label>
        <button type="button" onClick={guardarRota} disabled={ocupado || origem.trim().length < 2 || destino.trim().length < 2 || km < 1}>Salvar rota</button>
        {rotas.some((r) => r.id === rotaId) && <button type="button" onClick={apagarRota} disabled={ocupado}>Excluir rota</button>}
        {aviso && <p className={`msg ${aviso.ok ? "ok" : "bad"}`} role="status">{aviso.msg}</p>}
      </form>

      <h3 className="sim-titulo">Carga e caminhão</h3>
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="sCam">Caminhão
          <select id="sCam" value={id} onChange={(e) => trocarCaminhao(e.target.value)}>
            {caminhoes.map((x) => <option key={x.id} value={x.id}>{x.placa} · {x.eixos} eixos</option>)}
          </select>
        </label>
        <label htmlFor="sTon">Toneladas<input id="sTon" type="number" min="1" value={ton} onChange={(e) => setTon(+e.target.value)} /></label>
        <label htmlFor="sPr">Frete por tonelada (USD)<input id="sPr" type="number" min="0" step="0.5" value={pr} onChange={(e) => setPr(+e.target.value)} /></label>
        <label className="check" htmlFor="sVazio"><input id="sVazio" type="checkbox" checked={voltaVazio} onChange={(e) => setVoltaVazio(e.target.checked)} /> Volta vazio (soma a volta no km, no diesel e no pedágio)</label>
      </form>

      <h3 className="sim-titulo">Custos</h3>
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="sKmLC">km/l carregado<input id="sKmLC" type="number" min="0.5" step="0.1" value={kmLC} onChange={(e) => setKmLC(+e.target.value)} /></label>
        <label htmlFor="sKmLV">km/l vazio<input id="sKmLV" type="number" min="0.5" step="0.1" value={kmLV} disabled={!voltaVazio} onChange={(e) => setKmLV(+e.target.value)} /></label>
        <label htmlFor="sDiesel">Diesel (USD/litro)<input id="sDiesel" type="number" min="0" step="0.01" value={diesel} onChange={(e) => setDiesel(+e.target.value)} /></label>
        <label htmlFor="sOutros">Outros custos por km (USD)<input id="sOutros" type="number" min="0" step="0.01" value={outrosKm} onChange={(e) => setOutrosKm(+e.target.value)} /></label>
        <label htmlFor="sExtras">Aduana, despachante, chapa (USD)<input id="sExtras" type="number" min="0" step="1" value={extras} onChange={(e) => setExtras(+e.target.value)} /></label>
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
            para margem de <input aria-label="Margem desejada (%)" className="sim-alvo" type="number" min="0" max="90" value={alvo} onChange={(e) => setAlvo(+e.target.value)} />% · mínimo sem prejuízo {usd(s.freteMinimoTonelada, 2)}/t
          </small>
        </div>
      </div>
    </>
  );
}

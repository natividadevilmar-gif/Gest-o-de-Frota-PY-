"use client";

import { useState, useTransition } from "react";
import { dieselDaRota, freteSugeridoTonelada, simularFrete } from "@/lib/indicadores";
import { num, usd } from "@/lib/formato";
import { previstoRota, SIMBOLO_PEDAGIO, type Praca, type Taxas } from "@/lib/pedagio";
import { PAISES } from "../fretes/NovoFrete";
import { excluirRota, kmEntreCidades, salvarRota } from "./actions";

/** kmL: consumo medido no mês (ou o de referência); outrosKm: custo por km sem diesel, quando há despesas. */
type Cam = { id: string; placa: string; eixos: number; kmL: number | null; outrosKm: number | null };
/** Preço do diesel de um país: valor na moeda local e convertido em dólar pela cotação do dia. */
export type DieselPais = { pais: string; moeda: string; valor: number; usd: number; fonte: string; vigencia: string };
const SIMBOLO_MOEDA: Record<string, string> = { PYG: "₲", BRL: "R$", ARS: "AR$", UYU: "$U", USD: "US$" };
const precoLocal = (d: DieselPais) => `${SIMBOLO_MOEDA[d.moeda] ?? d.moeda} ${num(d.valor, d.moeda === "PYG" ? 0 : 2)}`;

export type RotaSalva = { id: string; origem: string; paisOrigem: string; destino: string; paisDestino: string; km: number; pracas: string[] };

/** Vazio, o caminhão faz mais km por litro que carregado. */
const FATOR_VAZIO = 1.3;
const arred = (n: number, casas = 2) => Math.round(n * 10 ** casas) / 10 ** casas;

/** Texto digitado em número: vírgula é a decimal; sem vírgula, o ponto também vale como decimal. */
function lerNumero(t: string): number {
  if (t === "") return 0;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Campo numérico no jeito brasileiro: digita "9,00" com vírgula. Apagar deixa vazio (conta como 0),
 * sem virar "09". Com `casas`, ao sair do campo o valor fica formatado (9 → 9,00).
 */
function Numero({ valor, mudar, casas, inteiro, ...props }: { valor: number; mudar: (n: number) => void; casas?: number; inteiro?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const formatar = (n: number) => (casas === undefined ? String(n).replace(".", ",") : n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: Math.max(casas, 6), useGrouping: false }));
  const [texto, setTexto] = useState(formatar(valor));
  // Valor trocado por fora (outro caminhão, rota calculada): mostra o novo.
  if (lerNumero(texto) !== valor && !(texto === "" && valor === 0)) setTexto(formatar(valor));
  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      value={texto}
      onChange={(e) => {
        // Inteiro (km, %): ponto e vírgula são só separador de milhar, "1.200" é 1200.
        const t = e.target.value.replace(inteiro ? /\D/g : /[^\d,.]/g, "").replace(/^0+(?=\d)/, "");
        setTexto(t);
        mudar(lerNumero(t));
      }}
      onBlur={() => texto !== "" && setTexto(formatar(valor))}
    />
  );
}

export function Simulador({ caminhoes, rotas, pracas, taxas, precoDiesel, dieselPais, paisCliente }: { caminhoes: Cam[]; rotas: RotaSalva[]; pracas: Praca[]; taxas: Taxas; precoDiesel: number; dieselPais: DieselPais[]; paisCliente: string }) {
  const pais0 = PAISES[paisCliente] ? paisCliente : "PY";
  const usdPorPais = Object.fromEntries(dieselPais.map((d) => [d.pais, d.usd]));
  // Diesel do país da rota; cruzando a fronteira, a média entre o país de origem e o de destino.
  const dieselDe = (o: string, d: string) => arred(dieselDaRota(o, d, usdPorPais) ?? precoDiesel);
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
  const [diesel, setDiesel] = useState(dieselDe(pais0, pais0));
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
      setDiesel(dieselDe(salva.paisOrigem, salva.paisDestino));
    }
  }

  // Mudou a cidade: o pedágio da rota anterior não vale mais até calcular de novo.
  const mudarCidade = (f: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { f(e.target.value); setNoCaminho(null); setRotaId(""); };

  const mudarPais = (origemMudou: boolean) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    const o = origemMudou ? e.target.value : paisOrigem, d = origemMudou ? paisDestino : e.target.value;
    mudarCidade(origemMudou ? setPaisOrigem : setPaisDestino)(e);
    setDiesel(dieselDe(o, d));
  };
  const precoO = dieselPais.find((x) => x.pais === paisOrigem), precoD = dieselPais.find((x) => x.pais === paisDestino);
  const fonteDiesel = !precoO || !precoD
    ? `sem preço cadastrado para ${PAISES[!precoO ? paisOrigem : paisDestino]}: média dos últimos abastecimentos lançados`
    : paisOrigem === paisDestino
      ? `${PAISES[paisOrigem]} ${precoLocal(precoO)} (${usd(precoO.usd, 2)}), ${precoO.fonte}`
      : `média de ${PAISES[paisOrigem]} ${precoLocal(precoO)} (${usd(precoO.usd, 2)}) e ${PAISES[paisDestino]} ${precoLocal(precoD)} (${usd(precoD.usd, 2)})`;

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
        <label htmlFor="sPaisO">País<select id="sPaisO" value={paisOrigem} onChange={mudarPais(true)}>{Object.entries(PAISES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <label htmlFor="sDestino">Cidade de destino<input id="sDestino" value={destino} onChange={mudarCidade(setDestino)} placeholder="Asunción" /></label>
        <label htmlFor="sPaisD">País<select id="sPaisD" value={paisDestino} onChange={mudarPais(false)}>{Object.entries(PAISES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <button type="button" onClick={calcularKm} disabled={ocupado || origem.trim().length < 2 || destino.trim().length < 2}>{ocupado ? "Calculando…" : "Calcular km"}</button>
        <label htmlFor="sKm">km de ida<Numero id="sKm" inteiro min="1" valor={km} mudar={setKm} /></label>
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
        <label htmlFor="sPr">Frete por tonelada (USD)<Numero id="sPr" casas={2} min="0" valor={pr} mudar={setPr} /></label>
        <label className="check" htmlFor="sVazio"><input id="sVazio" type="checkbox" checked={voltaVazio} onChange={(e) => setVoltaVazio(e.target.checked)} /> Volta vazio (soma a volta no km, no diesel e no pedágio)</label>
      </form>

      <h3 className="sim-titulo">Custos</h3>
      <form className="form" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="sKmLC">km/l carregado<Numero id="sKmLC" casas={1} min="0.5" valor={kmLC} mudar={setKmLC} /></label>
        <label htmlFor="sKmLV">km/l vazio<Numero id="sKmLV" casas={1} min="0.5" valor={kmLV} disabled={!voltaVazio} mudar={setKmLV} /></label>
        <label htmlFor="sDiesel">Diesel (USD/litro)<Numero id="sDiesel" casas={2} min="0" valor={diesel} mudar={setDiesel} /></label>
        <label htmlFor="sOutros">Outros custos por km (USD)<Numero id="sOutros" casas={2} min="0" valor={outrosKm} mudar={setOutrosKm} /></label>
        <label htmlFor="sExtras">Aduana, despachante, chapa (USD)<Numero id="sExtras" casas={2} min="0" valor={extras} mudar={setExtras} /></label>
      </form>
      <p className="note">
        Diesel: {fonteDiesel}. Pode alterar o valor para esta simulação.<br />
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
            para margem de <Numero aria-label="Margem desejada (%)" className="sim-alvo" inteiro min="0" max="90" valor={alvo} mudar={setAlvo} />% · mínimo sem prejuízo {usd(s.freteMinimoTonelada, 2)}/t
          </small>
        </div>
      </div>
    </>
  );
}

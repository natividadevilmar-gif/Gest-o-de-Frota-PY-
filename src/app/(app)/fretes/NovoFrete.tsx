"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { paraUsd, SIMBOLO, type Cotacoes, type Moeda } from "@/lib/cambio";
import { num, usd } from "@/lib/formato";
import { margemViagem } from "@/lib/indicadores";
import { lancarFrete } from "./actions";

type Cam = { id: string; placa: string; custoKm: number | null; motoristaId: string | null };
type Mot = { id: string; nome: string };

export const PAISES: Record<string, string> = {
  PY: "🇵🇾 Paraguai", BR: "🇧🇷 Brasil", AR: "🇦🇷 Argentina", BO: "🇧🇴 Bolívia", UY: "🇺🇾 Uruguai", CL: "🇨🇱 Chile",
};
const BANDEIRA: Record<Moeda, string> = { PYG: "🇵🇾", USD: "🇺🇸", BRL: "🇧🇷", ARS: "🇦🇷" };
const NOME_MOEDA: Record<Moeda, string> = { PYG: "Guarani", USD: "Dólar", BRL: "Real", ARS: "Peso arg." };
const MOEDA_DO_PAIS: Record<string, Moeda> = { PY: "PYG", BR: "BRL", AR: "ARS" };

export function NovoFrete({ caminhoes, motoristas, cotacao, hoje, paisCliente }: { caminhoes: Cam[]; motoristas: Mot[]; cotacao: Cotacoes; hoje: string; paisCliente: string }) {
  const [r, acao, enviando] = useActionState(lancarFrete, null);
  const formulario = useRef<HTMLFormElement>(null);
  const [cam, setCam] = useState(caminhoes[0]?.id ?? "");
  const [mot, setMot] = useState(caminhoes[0]?.motoristaId ?? "");
  const [moeda, setMoeda] = useState<Moeda>("USD");
  const [cobranca, setCobranca] = useState<"tonelada" | "fechado">("tonelada");
  const [v, setV] = useState({ toneladas: "", precoTonelada: "", valor: "", kmCarregado: "", kmVazio: "", custosExtras: "" });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (!r?.ok) return;
    formulario.current?.reset();
    setV({ toneladas: "", precoTonelada: "", valor: "", kmCarregado: "", kmVazio: "", custosExtras: "" });
  }, [r]);

  const c = caminhoes.find((x) => x.id === cam);
  const ton = Number(v.toneladas) || 0;
  const valor = cobranca === "tonelada" ? ton * (Number(v.precoTonelada) || 0) : Number(v.valor) || 0;
  const freteUsd = valor > 0 ? paraUsd(valor, moeda, cotacao) : 0;
  const extrasUsd = Number(v.custosExtras) > 0 ? paraUsd(Number(v.custosExtras), moeda, cotacao) : 0;
  const km = Number(v.kmCarregado) || 0;
  const m = c?.custoKm != null && km > 0 && freteUsd > 0 ? margemViagem(freteUsd, km, Number(v.kmVazio) || 0, c.custoKm, extrasUsd) : null;
  const casas = 2;

  return (
    <form ref={formulario} action={acao} className="frete">
      <fieldset>
        <legend>Veículo</legend>
        <label htmlFor="caminhaoId">Caminhão
          <select id="caminhaoId" name="caminhaoId" value={cam} onChange={(e) => { setCam(e.target.value); setMot(caminhoes.find((x) => x.id === e.target.value)?.motoristaId ?? ""); }}>
            {caminhoes.map((x) => <option key={x.id} value={x.id}>{x.placa}{x.custoKm != null ? ` · ${usd(x.custoKm, 2)}/km` : ""}</option>)}
          </select>
        </label>
        <label htmlFor="motoristaId">Motorista
          <select id="motoristaId" name="motoristaId" value={mot} onChange={(e) => setMot(e.target.value)}>
            <option value="">Sem motorista</option>
            {motoristas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </label>
        <label htmlFor="data">Data de carregamento<input id="data" name="data" type="date" defaultValue={hoje} required /></label>
        <label htmlFor="dataEntrega">Data de entrega<input id="dataEntrega" name="dataEntrega" type="date" /></label>
      </fieldset>

      <fieldset>
        <legend>Cliente e documentos</legend>
        <label htmlFor="embarcador" className="largo">Cliente (quem paga o frete)<input id="embarcador" name="embarcador" placeholder="Ex.: Cooperativa Colonias Unidas" required /></label>
        <label htmlFor="documento">Nº do documento<input id="documento" name="documento" placeholder="CRT, MIC/DTA, factura ou CT-e" /></label>
      </fieldset>

      <fieldset>
        <legend>Rota</legend>
        <label htmlFor="paisOrigem">País de origem
          <select id="paisOrigem" name="paisOrigem" defaultValue={PAISES[paisCliente] ? paisCliente : "PY"}>{Object.entries(PAISES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        </label>
        <label htmlFor="origem">Cidade de origem<input id="origem" name="origem" placeholder="Santa Rita" required /></label>
        <label htmlFor="paisDestino">País de destino
          <select id="paisDestino" name="paisDestino" defaultValue={PAISES[paisCliente] ? paisCliente : "PY"}>{Object.entries(PAISES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        </label>
        <label htmlFor="destino">Cidade de destino<input id="destino" name="destino" placeholder="Porto de Villeta" required /></label>
        <label htmlFor="kmCarregado">km carregado (ida)<input id="kmCarregado" name="kmCarregado" type="number" min="1" inputMode="numeric" value={v.kmCarregado} onChange={set("kmCarregado")} required /></label>
        <label htmlFor="kmVazio">km vazio (volta sem carga)<input id="kmVazio" name="kmVazio" type="number" min="0" inputMode="numeric" value={v.kmVazio} onChange={set("kmVazio")} placeholder="0 se volta carregado" /></label>
      </fieldset>

      <fieldset>
        <legend>Carga</legend>
        <label htmlFor="carga">Produto transportado<input id="carga" name="carga" placeholder="Soja, milho, fertilizante…" list="produtos" required /></label>
        <datalist id="produtos">{["Soja", "Milho", "Trigo", "Arroz", "Fertilizante", "Calcário", "Combustível", "Carga geral", "Contêiner"].map((p) => <option key={p} value={p} />)}</datalist>
        <label htmlFor="toneladas">Toneladas<input id="toneladas" name="toneladas" type="number" step="0.01" min="0.01" inputMode="decimal" value={v.toneladas} onChange={set("toneladas")} required /></label>
      </fieldset>

      <fieldset>
        <legend>Valor do frete</legend>
        <div className="moeda-topo largo" role="radiogroup" aria-label="Moeda do frete">
          <span>Moeda do frete</span>
          <div>
            {(["USD", "PYG", "BRL", "ARS"] as Moeda[]).map((x) => (
              <button key={x} type="button" role="radio" aria-checked={moeda === x} className={moeda === x ? "sel" : ""} onClick={() => setMoeda(x)}>
                <span aria-hidden="true">{BANDEIRA[x]}</span> <b>{SIMBOLO[x]}</b> {NOME_MOEDA[x]}
              </button>
            ))}
          </div>
        </div>
        <input type="hidden" name="moeda" value={moeda} />
        <label htmlFor="cobranca">Como é cobrado
          <select id="cobranca" name="cobranca" value={cobranca} onChange={(e) => setCobranca(e.target.value as "tonelada" | "fechado")}>
            <option value="tonelada">Por tonelada</option>
            <option value="fechado">Valor fechado</option>
          </select>
        </label>
        {cobranca === "tonelada" ? (
          <label htmlFor="precoTonelada">Preço por tonelada ({SIMBOLO[moeda]})<input id="precoTonelada" name="precoTonelada" type="number" step="any" min="0" inputMode="decimal" value={v.precoTonelada} onChange={set("precoTonelada")} required /></label>
        ) : (
          <label htmlFor="valor">Valor do frete ({SIMBOLO[moeda]})<input id="valor" name="valor" type="number" step="any" min="0" inputMode="decimal" value={v.valor} onChange={set("valor")} required /></label>
        )}
        <label htmlFor="custosExtras">Custos só desta viagem ({SIMBOLO[moeda]})<input id="custosExtras" name="custosExtras" type="number" step="any" min="0" inputMode="decimal" value={v.custosExtras} onChange={set("custosExtras")} placeholder="Aduana, despachante, balança" /></label>
        {MOEDA_DO_PAIS[paisCliente] && MOEDA_DO_PAIS[paisCliente] !== moeda && moeda !== "USD" && <p className="note largo">Atenção: frete em {NOME_MOEDA[moeda]}, diferente da moeda do país do cliente.</p>}
      </fieldset>

      <fieldset>
        <legend>Recebimento</legend>
        <label htmlFor="vencimento">Vencimento do pagamento<input id="vencimento" name="vencimento" type="date" /></label>
        <label htmlFor="recebido" className="check"><input id="recebido" name="recebido" type="checkbox" />Já recebido</label>
        <label htmlFor="observacao" className="largo">Observação<input id="observacao" name="observacao" placeholder="Ex.: espera de 1 dia no porto" /></label>
      </fieldset>

      <div className="resumo-frete" role="status" aria-live="polite">
        <div><span>Frete</span><b>{freteUsd ? usd(freteUsd, 2) : "–"}</b>{moeda !== "USD" && valor > 0 && <small>{SIMBOLO[moeda]} {num(valor, casas)}</small>}</div>
        <div><span>Custo estimado</span><b>{m ? usd(m.custoUsd, 2) : "–"}</b>{m && c?.custoKm != null && <small>{num(m.kmTotal)} km × {usd(c.custoKm, 2)}{extrasUsd ? ` + ${usd(extrasUsd, 2)}` : ""}</small>}</div>
        <div><span>Margem</span><b className={m ? (m.margemUsd < 0 ? "t-bad" : "t-ok") : ""}>{m ? `${usd(m.margemUsd, 2)} · ${num(m.margemPct, 0)}%` : "–"}</b>{c?.custoKm == null && <small>Sem custo por km deste caminhão no mês</small>}</div>
      </div>
      <button className="pri grande" type="submit" disabled={enviando}>Lançar frete</button>
      {r && <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">{r.msg}</p>}
    </form>
  );
}

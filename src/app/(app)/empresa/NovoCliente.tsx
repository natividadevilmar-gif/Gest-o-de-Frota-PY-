"use client";

import { useActionState, useState } from "react";
import { NOME_PLANO, PRECO_MENSAL, type Plano } from "@/lib/indicadores";
import { TEMAS } from "@/lib/temas";
import { criarCliente } from "./actions";

const RESUMO: Record<Plano, string> = {
  BASICO: "Rastreador, mapa ao vivo, central de alertas, bloqueio do motor e lançar despesa.",
  GESTAO: "Tudo do Básico + custo por km, consumo, revisões e margem.",
  VIDEO: "Tudo do Gestão + câmeras da estrada e da cabine com vídeo dos eventos.",
};

export function NovoCliente() {
  const [r, acao, enviando] = useActionState(criarCliente, null);
  const [plano, setPlano] = useState<Plano>("GESTAO");
  const [qtd, setQtd] = useState(1);
  const [prazo, setPrazo] = useState(12);
  const mensal = PRECO_MENSAL[plano] * (qtd || 0);
  return (
    <form className="form" action={acao}>
      <fieldset className="novo-plano">
        <legend>Plano contratado</legend>
        <div className="planos-botoes" role="radiogroup" aria-label="Plano contratado">
          {(["BASICO", "GESTAO", "VIDEO"] as Plano[]).map((p) => (
            <label key={p} className={`plano-btn plano-${p.toLowerCase()}`}>
              <input type="radio" name="planoContratado" value={p} checked={plano === p} onChange={() => setPlano(p)} className="sr-only" />
              <b>{NOME_PLANO[p]}</b>
              <span>USD {PRECO_MENSAL[p]}<small>/mês por caminhão</small></span>
              <small>{RESUMO[p]}</small>
            </label>
          ))}
        </div>
        <div className="form">
          <label htmlFor="caminhoesContratados">Caminhões<input id="caminhoesContratados" name="caminhoesContratados" type="number" min={1} max={2000} value={qtd} onChange={(e) => setQtd(Number(e.target.value))} required /></label>
          <label htmlFor="prazoMeses">Prazo
            <select id="prazoMeses" name="prazoMeses" value={prazo} onChange={(e) => setPrazo(Number(e.target.value))}>
              {[6, 12, 24, 36].map((m) => <option key={m} value={m}>{m} meses</option>)}
            </select>
          </label>
          <label htmlFor="diaVencimento">Vencimento
            <select id="diaVencimento" name="diaVencimento" defaultValue="10">
              {[5, 10, 15, 20, 25].map((d) => <option key={d} value={d}>todo dia {d}</option>)}
            </select>
          </label>
          <p className="novo-total">Mensalidade: <b>USD {mensal.toLocaleString("es-PY")}</b> · {prazo} meses = USD {(mensal * prazo).toLocaleString("es-PY")}</p>
        </div>
      </fieldset>
      <label htmlFor="nome">Transportadora<input id="nome" name="nome" className="wide" required /></label>
      <label htmlFor="cidade">Cidade<input id="cidade" name="cidade" required /></label>
      <label htmlFor="ruc">RUC<input id="ruc" name="ruc" /></label>
      <label htmlFor="endereco">Endereço (vai no contrato)<input id="endereco" name="endereco" className="wide" /></label>
      <label htmlFor="idioma">Idioma (plataforma e contrato)
        <select id="idioma" name="idioma" defaultValue="pt"><option value="pt">Português</option><option value="es">Español</option></select>
      </label>
      <label htmlFor="pais">País de origem (cores)
        <select id="pais" name="pais" defaultValue="PY">{Object.entries(TEMAS).map(([k, t]) => <option key={k} value={k}>{t.nome}</option>)}</select>
      </label>
      <label htmlFor="gestorNome">Nome do gestor<input id="gestorNome" name="gestorNome" className="wide" required /></label>
      <label htmlFor="gestorEmail">E-mail do gestor<input id="gestorEmail" name="gestorEmail" type="email" className="wide" required /></label>
      <label htmlFor="senha">Senha inicial<input id="senha" name="senha" type="password" minLength={8} required /></label>
      <button className="pri" type="submit" disabled={enviando}>Cadastrar cliente e gerar contrato</button>
      {r && (
        <p className={`msg ${r.ok ? "ok" : "bad"}`} role="status">
          {r.msg} {r.contratoId && <a className="btn pri" href={`/contrato/${r.contratoId}`}>Abrir o contrato →</a>}
        </p>
      )}
    </form>
  );
}

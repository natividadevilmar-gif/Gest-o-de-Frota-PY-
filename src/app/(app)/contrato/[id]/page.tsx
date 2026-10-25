import { notFound } from "next/navigation";
import { exigirSessao } from "@/lib/acesso";
import { DIAS_SUSPENSAO, EMPRESA, numeroContrato, textoContrato, valoresContrato } from "@/lib/contrato";
import { db } from "@/lib/db";
import { NOME_PLANO, PRECO_MENSAL, type Plano } from "@/lib/indicadores";
import { atualizarContrato } from "../actions";
import { Imprimir } from "./Imprimir";

export const dynamic = "force-dynamic";

export default async function Contrato({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ idioma?: string }> }) {
  const sessao = await exigirSessao();
  const { id } = await params;
  if (sessao.papel !== "ADMIN" && sessao.clienteId !== id) notFound();
  if (sessao.papel === "MOTORISTA" || sessao.papel === "OPERADOR") notFound();
  const c = await db.cliente.findUnique({
    where: { id },
    include: { usuarios: { where: { papel: "GESTOR" }, orderBy: { criadoEm: "asc" }, take: 1, select: { nome: true, email: true } }, _count: { select: { caminhoes: true } } },
  });
  if (!c) notFound();
  const idioma = ((await searchParams).idioma ?? c.idioma) === "es" ? "es" : "pt";
  const inicio = c.contratoInicio ?? c.criadoEm;
  const gestor = c.usuarios[0];
  const dados = {
    numero: numeroContrato(c.id, inicio),
    cliente: { nome: c.nome, ruc: c.ruc, endereco: c.endereco, cidade: c.cidade, representante: gestor?.nome ?? "[representante]", email: gestor?.email ?? "" },
    plano: c.planoContratado as Plano,
    caminhoes: c.caminhoesContratados,
    prazoMeses: c.prazoMeses,
    diaVencimento: c.diaVencimento,
    inicio,
  };
  const t = textoContrato(dados, idioma);
  const v = valoresContrato(dados);
  const faltaEmpresa = Object.values(EMPRESA).some((x) => x.includes("["));
  const admin = sessao.papel === "ADMIN";

  return (
    <>
      <div className="titulo-acoes nao-imprimir">
        <h1>Contrato · {c.nome}</h1>
        <div className="cmd-linha">
          <div className="alternar" role="group" aria-label="Idioma do contrato">
            <a href={`/contrato/${c.id}?idioma=pt`} aria-current={idioma === "pt" ? "true" : undefined}>Português</a>
            <a href={`/contrato/${c.id}?idioma=es`} aria-current={idioma === "es" ? "true" : undefined}>Español</a>
          </div>
          <Imprimir />
        </div>
      </div>
      {faltaEmpresa && admin && (
        <p className="pill warn nao-imprimir" role="note">Faltam os dados da KM Cero (razão social, RUC e endereço): me mande que eu coloco no contrato.</p>
      )}
      {c._count.caminhoes !== c.caminhoesContratados && (
        <p className="note nao-imprimir">O contrato prevê {c.caminhoesContratados} caminhões e a frota cadastrada tem {c._count.caminhoes}.</p>
      )}

      {admin && (
        <details className="card nao-imprimir">
          <summary><b>Mudar plano, quantidade, prazo ou vencimento</b></summary>
          <form action={atualizarContrato} className="form">
            <input type="hidden" name="id" value={c.id} />
            <label htmlFor="planoContratado">Plano
              <select id="planoContratado" name="planoContratado" defaultValue={c.planoContratado}>
                {(["BASICO", "GESTAO", "VIDEO"] as Plano[]).map((p) => <option key={p} value={p}>{NOME_PLANO[p]} · USD {PRECO_MENSAL[p]}</option>)}
              </select>
            </label>
            <label htmlFor="caminhoesContratados">Caminhões<input id="caminhoesContratados" name="caminhoesContratados" type="number" min={1} max={2000} defaultValue={c.caminhoesContratados} /></label>
            <label htmlFor="prazoMeses">Prazo (meses)<input id="prazoMeses" name="prazoMeses" type="number" min={1} max={60} defaultValue={c.prazoMeses} /></label>
            <label htmlFor="diaVencimento">Vencimento (dia)<input id="diaVencimento" name="diaVencimento" type="number" min={1} max={28} defaultValue={c.diaVencimento} /></label>
            <label htmlFor="endereco">Endereço do cliente<input id="endereco" name="endereco" className="wide" defaultValue={c.endereco ?? ""} /></label>
            <label htmlFor="contratoInicio">Início<input id="contratoInicio" name="contratoInicio" type="date" defaultValue={inicio.toISOString().slice(0, 10)} /></label>
            <button type="submit" className="pri">Salvar e atualizar o contrato</button>
          </form>
        </details>
      )}

      <article className="contrato">
        <header>
          <p className="contrato-num">{dados.numero}</p>
          <h2>{t.titulo}</h2>
          <p className="contrato-resumo">
            {idioma === "pt" ? "Plano" : "Plan"} <b>{idioma === "pt" ? NOME_PLANO[dados.plano] : { BASICO: "Básico", GESTAO: "Gestión", VIDEO: "Video" }[dados.plano]}</b> ·{" "}
            {dados.caminhoes} {idioma === "pt" ? "caminhões" : "camiones"} · USD {v.mensal.toLocaleString("es-PY")}/{idioma === "pt" ? "mês" : "mes"} · {dados.prazoMeses} {idioma === "pt" ? "meses" : "meses"}
          </p>
        </header>
        {t.secoes.map((s) => (
          <section key={s.titulo}>
            <h3>{s.titulo}</h3>
            {s.paragrafos.map((p, i) => <p key={i}>{p}</p>)}
            {s.lista && <ul>{s.lista.map((x) => <li key={x}>{x}</li>)}</ul>}
          </section>
        ))}
        <p className="contrato-local">{t.local}</p>
        <div className="contrato-assinaturas">
          <div><span /><b>KM CERO</b><small>{EMPRESA.razaoSocial}</small></div>
          <div><span /><b>{c.nome}</b><small>{dados.cliente.representante}</small></div>
        </div>
        <p className="contrato-rodape">{idioma === "pt" ? `Suspensão do acesso após ${DIAS_SUSPENSAO} dias de atraso.` : `Suspensión del acceso tras ${DIAS_SUSPENSAO} días de atraso.`} {dados.numero}</p>
      </article>
    </>
  );
}

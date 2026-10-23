import { Kpi } from "@/components/ui";
import { exigirAdmin } from "@/lib/acesso";
import { db } from "@/lib/db";
import { num, usd } from "@/lib/formato";
import { DIAS_PARA_BLOQUEIO, mensalidadeTotal, NOME_PLANO, situacaoPagamento, type Plano } from "@/lib/indicadores";
import { atualizarAtraso } from "./actions";
import { NovoCliente } from "./NovoCliente";

// Ponto de equilíbrio do ano 1 no plano de negócio.
const EQUILIBRIO_ANO1 = 440;
const PLANOS: Plano[] = ["BASICO", "GESTAO", "VIDEO"];

export default async function Empresa() {
  await exigirAdmin();
  const clientes = await db.cliente.findMany({ orderBy: { nome: "asc" }, include: { caminhoes: { select: { plano: true } } } });
  const linhas = clientes.map((c) => {
    const planos = c.caminhoes.map((x) => x.plano as Plano);
    return { c, planos, mrr: mensalidadeTotal(planos), situacao: situacaoPagamento(c.diasEmAtraso) };
  });
  const caminhoes = linhas.reduce((a, l) => a + l.planos.length, 0);
  const mrr = linhas.reduce((a, l) => a + l.mrr, 0);
  const atraso = linhas.filter((l) => l.situacao !== "em_dia").reduce((a, l) => a + l.mrr, 0);
  const mix = PLANOS.map((p) => linhas.reduce((a, l) => a + l.planos.filter((x) => x === p).length, 0));

  return (
    <>
      <h1>Minha empresa</h1>
      <div className="grid g4">
        <Kpi rotulo="Caminhões ativos" valor={num(caminhoes)} sub={`equilíbrio do ano 1: cerca de ${EQUILIBRIO_ANO1}`} />
        <Kpi rotulo="Mensalidades por mês" valor={usd(mrr)} sub={caminhoes ? `média de ${usd(mrr / caminhoes, 2)} por caminhão` : undefined} />
        <Kpi rotulo="Em atraso" valor={usd(atraso)} sub={`bloqueio automático após ${DIAS_PARA_BLOQUEIO} dias`} />
        <Kpi rotulo="Mix de planos" valor={mix.map((m) => (caminhoes ? Math.round((m / caminhoes) * 100) : 0)).join(" / ")} unidade="%" sub="Básico / Gestão / Vídeo · meta 40 / 35 / 25" />
      </div>
      <div className="card">
        <div className="card-h"><h2>Clientes</h2><p>{clientes.length} transportadoras</p></div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Cliente</th>{PLANOS.map((p) => <th key={p} className="n">{NOME_PLANO[p]}</th>)}<th className="n">Mensal</th><th>Pagamento</th><th>Dias em atraso</th></tr>
            </thead>
            <tbody>
              {linhas.map(({ c, planos, mrr, situacao }) => (
                <tr key={c.id}>
                  <td><b>{c.nome}</b><br /><small className="muted">{c.cidade} · {c.idioma === "es" ? "español" : "português"}</small></td>
                  {PLANOS.map((p) => <td key={p} className="n">{planos.filter((x) => x === p).length}</td>)}
                  <td className="n">{usd(mrr)}</td>
                  <td><span className={`pill ${situacao === "em_dia" ? "ok" : situacao === "atrasado" ? "warn" : "bad"}`}>{situacao === "em_dia" ? "em dia" : situacao === "atrasado" ? `atraso ${c.diasEmAtraso} dias` : "bloqueado"}</span></td>
                  <td>
                    <form action={atualizarAtraso} className="form" style={{ flexWrap: "nowrap" }}>
                      <input type="hidden" name="id" value={c.id} />
                      <input name="diasEmAtraso" type="number" min="0" defaultValue={c.diasEmAtraso} aria-label={`Dias em atraso de ${c.nome}`} style={{ width: 70 }} />
                      <button type="submit">Salvar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Por enquanto o atraso é informado à mão. A integração com o faturamento eletrônico (SIFEN) e o banco fica para depois do MVP.</p>
      </div>
      <div className="card">
        <div className="card-h"><h2>Cadastrar cliente</h2><p>Cria a transportadora e o acesso do gestor.</p></div>
        <NovoCliente />
      </div>
    </>
  );
}

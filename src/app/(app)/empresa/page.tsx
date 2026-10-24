import { Kpi } from "@/components/ui";
import { exigirAdmin } from "@/lib/acesso";
import { db } from "@/lib/db";
import { num, usd } from "@/lib/formato";
import { DIAS_PARA_BLOQUEIO, mensalidadeTotal, NOME_PLANO, situacaoPagamento, type Plano } from "@/lib/indicadores";
import { cotacaoDoDia } from "@/lib/cotacao";
import { Bandeira } from "@/components/Bandeira";
import { temaDoPais, TEMAS } from "@/lib/temas";
import { atualizarAtraso, atualizarPais, salvarCotacao } from "./actions";
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
  const cotacao = await cotacaoDoDia();
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
              <tr><th>Cliente</th>{PLANOS.map((p) => <th key={p} className="n">{NOME_PLANO[p]}</th>)}<th className="n">Mensal</th><th>Pagamento</th><th>Dias em atraso</th><th>País (cores)</th></tr>
            </thead>
            <tbody>
              {linhas.map(({ c, planos, mrr, situacao }) => (
                <tr key={c.id}>
                  <td><b>{c.nome}</b><br /><small className="muted">{c.cidade} · {c.idioma === "es" ? "español" : "português"} · {temaDoPais(c.pais).nome}</small></td>
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
                  <td>
                    <form action={atualizarPais} className="form" style={{ flexWrap: "nowrap", alignItems: "center" }}>
                      <input type="hidden" name="id" value={c.id} />
                      <Bandeira pais={c.pais} />
                      <select name="pais" defaultValue={c.pais} aria-label={`País de ${c.nome}`}>
                        {Object.entries(TEMAS).map(([k, t]) => <option key={k} value={k}>{t.nome}</option>)}
                      </select>
                      <button type="submit">Salvar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">Por enquanto o atraso é informado à mão. A integração com o faturamento eletrônico (SIFEN) e o banco fica para depois do MVP. O país define as cores da plataforma para aquele cliente.</p>
      </div>
      <div className="card">
        <div className="card-h">
          <h2>Cotação do dia</h2>
          <p>Fonte: {cotacao.fonte} · {cotacao.data.split("-").reverse().join("/")}</p>
        </div>
        <form action={salvarCotacao} className="form">
          <label htmlFor="pygPorUsd">Guaranis por dólar<input id="pygPorUsd" name="pygPorUsd" type="number" step="any" min="1" defaultValue={cotacao.pygPorUsd} /></label>
          <label htmlFor="brlPorUsd">Reais por dólar<input id="brlPorUsd" name="brlPorUsd" type="number" step="any" min="0.01" defaultValue={cotacao.brlPorUsd} /></label>
          <button type="submit">Usar esta cotação hoje</button>
        </form>
        <p className="note">A cotação é buscada sozinha uma vez por dia. Use este campo só se quiser fixar outra (por exemplo, a do seu banco).</p>
      </div>
      <div className="card">
        <div className="card-h"><h2>Cadastrar cliente</h2><p>Cria a transportadora e o acesso do gestor.</p></div>
        <NovoCliente />
      </div>
    </>
  );
}

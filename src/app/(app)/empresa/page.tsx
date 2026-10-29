import Link from "next/link";
import { Kpi } from "@/components/ui";
import { exigirAdmin } from "@/lib/acesso";
import { db } from "@/lib/db";
import { indicadoresFrota, revisoesCliente, saldoEmpresa, totaisFrota } from "@/lib/dados";
import { nomeMes, num, usd } from "@/lib/formato";
import { DIAS_PARA_BLOQUEIO, mensalidadeTotal, mesAtual, NOME_PLANO, planoPermite, situacaoPagamento, type Plano } from "@/lib/indicadores";
import { cotacaoDoDia } from "@/lib/cotacao";
import { frotaNoMapa } from "@/lib/rastreio/dados";
import { Bandeira } from "@/components/Bandeira";
import { temaDoPais, TEMAS } from "@/lib/temas";
import { atualizarAtraso, atualizarPais, escolherCliente, salvarCotacao } from "./actions";
import { NovoCliente } from "./NovoCliente";
import { AcessosGestores } from "./AcessosGestores";

// Ponto de equilíbrio do ano 1 no plano de negócio.
const EQUILIBRIO_ANO1 = 440;
const PLANOS: Plano[] = ["BASICO", "GESTAO", "VIDEO"];

/** Abre o cliente numa tela dele (painel, revisões, mapa...). */
function AbrirCliente({ id, tela = "/painel", className, children }: { id: string; tela?: string; className?: string; children: React.ReactNode }) {
  return (
    <form action={escolherCliente} style={{ display: "inline" }}>
      <input type="hidden" name="clienteId" value={id} />
      <input type="hidden" name="voltar" value={tela} />
      <button type="submit" className={className ?? "link-cliente"}>{children}</button>
    </form>
  );
}

type Alerta = { sev: "bad" | "warn" | "info"; cliente: string; clienteId: string; titulo: string; detalhe: string; tela: string };

export default async function Empresa() {
  await exigirAdmin();
  const mes = mesAtual();
  const [clientes, cotacao, agora, gestores] = await Promise.all([
    db.cliente.findMany({ orderBy: { nome: "asc" }, include: { caminhoes: { select: { plano: true } } } }),
    cotacaoDoDia(),
    frotaNoMapa(null),
    db.usuario.findMany({ where: { papel: "GESTOR" }, select: { id: true, nome: true, email: true, cliente: { select: { nome: true } } }, orderBy: [{ cliente: { nome: "asc" } }, { email: "asc" }] }),
  ]);

  // Indicadores de cada cliente no mês, os mesmos do painel do cliente.
  const linhas = await Promise.all(
    clientes.map(async (c) => {
      const planos = c.caminhoes.map((x) => x.plano as Plano);
      const [ind, revs, saldo] = await Promise.all([indicadoresFrota(c.id, mes), revisoesCliente(c.id), saldoEmpresa(c.id, mes)]);
      const gestao = ind.filter((i) => planoPermite(i.plano, "custos"));
      const tot = totaisFrota(gestao);
      const revisoes = revs.filter((r) => planoPermite(r.caminhao.plano, "revisoes"));
      const vivo = agora.filter((f) => f.cliente === c.nome);
      return {
        c, planos, mrr: mensalidadeTotal(planos), situacao: situacaoPagamento(c.diasEmAtraso),
        km: ind.reduce((a, i) => a + i.km, 0), // Sem despesas lançadas o custo e o saldo ainda não dizem nada: mostramos "–".
        custoKm: gestao.length && tot.custo > 0 ? tot.custoKm : null,
        saldo: saldo.fretes || saldo.despesas || saldo.anterior ? saldo.saldo : null,
        vencidas: revisoes.filter((r) => r.status.situacao === "vencida").length,
        desvios: gestao.filter((i) => i.suspeitaDesvio).map((i) => i),
        movimento: vivo.filter((f) => f.situacao === "movimento").length,
        semSinal: vivo.filter((f) => f.situacao === "sem-sinal"),
      };
    }),
  );

  const caminhoes = linhas.reduce((a, l) => a + l.planos.length, 0);
  const mrr = linhas.reduce((a, l) => a + l.mrr, 0);
  const atraso = linhas.filter((l) => l.situacao !== "em_dia").reduce((a, l) => a + l.mrr, 0);
  const mix = PLANOS.map((p) => linhas.reduce((a, l) => a + l.planos.filter((x) => x === p).length, 0));
  const conta = (s: string) => agora.filter((f) => f.situacao === s).length;
  const kmMes = linhas.reduce((a, l) => a + l.km, 0);

  const alertas: Alerta[] = linhas.flatMap((l) => [
    ...(l.situacao !== "em_dia"
      ? [{ sev: l.situacao === "bloqueado" ? "bad" : "warn", cliente: l.c.nome, clienteId: l.c.id, titulo: l.situacao === "bloqueado" ? "Acesso bloqueado por falta de pagamento" : "Mensalidade em atraso", detalhe: `${l.c.diasEmAtraso} dias de atraso · ${usd(l.mrr)} por mês`, tela: "/painel" } as Alerta]
      : []),
    ...(l.vencidas ? [{ sev: "bad", cliente: l.c.nome, clienteId: l.c.id, titulo: `${l.vencidas} revisões vencidas`, detalhe: "Caminhões rodando com manutenção atrasada.", tela: "/revisoes" } as Alerta] : []),
    ...l.desvios.map<Alerta>((i) => ({ sev: "bad", cliente: l.c.nome, clienteId: l.c.id, titulo: `${i.placa} · possível desvio de diesel`, detalhe: `Abastecido ${num(i.desvioPct, 1)}% acima do consumo medido pela CAN.`, tela: "/consumo" })),
    ...l.semSinal.map<Alerta>((f) => ({ sev: "warn", cliente: l.c.nome, clienteId: l.c.id, titulo: `${f.placa} · sem sinal do rastreador`, detalhe: "Ligado, mas sem enviar posição há mais de 30 minutos.", tela: "/rastreamento" })),
  ]).sort((a, b) => ["bad", "warn", "info"].indexOf(a.sev) - ["bad", "warn", "info"].indexOf(b.sev));

  return (
    <>
      <div className="card-h">
        <h1>Painel da KM Cero · {nomeMes(mes)}</h1>
        <div className="acoes-painel">
          <Link className="btn pri" href="/rastreamento?todos=1">Mapa ao vivo de todos</Link>
          <Link className="btn" href="#novo-cliente">+ Cadastrar cliente</Link>
        </div>
      </div>
      <div className="grid g4">
        <Kpi rotulo="Caminhões ativos" valor={num(caminhoes)} sub={`em ${clientes.length} clientes · equilíbrio do ano 1: cerca de ${EQUILIBRIO_ANO1}`} />
        <Kpi rotulo="Mensalidades por mês" valor={usd(mrr)} sub={caminhoes ? `média de ${usd(mrr / caminhoes, 2)} por caminhão` : undefined} />
        <Kpi rotulo="Em atraso" valor={usd(atraso)} sub={`bloqueio automático após ${DIAS_PARA_BLOQUEIO} dias`} />
        <Kpi rotulo="Mix de planos" valor={mix.map((m) => (caminhoes ? Math.round((m / caminhoes) * 100) : 0)).join(" / ")} unidade="%" sub="Básico / Gestão / Vídeo · meta 40 / 35 / 25" />
      </div>
      <div className="grid g4">
        <Kpi rotulo="Em movimento agora" valor={num(conta("movimento"))} unidade={`de ${agora.length}`} sub={<Link href="/rastreamento?todos=1">ver no mapa</Link>} />
        <Kpi rotulo="Parados ou desligados" valor={num(conta("parado") + conta("desligado"))} sub={`${conta("parado")} parados ligados · ${conta("desligado")} desligados`} />
        <Kpi rotulo="Sem sinal ou sem rastreador" valor={num(conta("sem-sinal") + conta("aguardando") + conta("sem-rastreador"))} sub={`${conta("sem-sinal")} sem sinal · ${conta("sem-rastreador")} sem rastreador`} />
        <Kpi rotulo="km rodados no mês" valor={num(kmMes)} unidade="km" sub="soma de todos os clientes" />
      </div>
      <div className="card">
        <div className="card-h"><h2>Clientes</h2><p>Clique no nome para abrir o painel do cliente</p></div>
        <div className="tw">
          <table>
            <thead>
              <tr><th>Cliente</th><th className="n">Caminhões</th><th className="n">Andando agora</th><th className="n">km no mês</th><th className="n">Custo/km</th><th className="n">Saldo em caixa</th><th className="n">Alertas</th><th className="n">Mensal</th><th>Pagamento</th><th>Contrato</th></tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const nAlertas = alertas.filter((a) => a.clienteId === l.c.id).length;
                return (
                  <tr key={l.c.id}>
                    <td>
                      <AbrirCliente id={l.c.id}>{l.c.nome} →</AbrirCliente>
                      <br /><small className="muted">{l.c.cidade} · {temaDoPais(l.c.pais).nome}</small>
                    </td>
                    <td className="n" title={PLANOS.map((p) => `${NOME_PLANO[p]}: ${l.planos.filter((x) => x === p).length}`).join(" · ")}>{l.planos.length}</td>
                    <td className="n"><AbrirCliente id={l.c.id} tela="/rastreamento" className="link-num">{l.movimento}</AbrirCliente></td>
                    <td className="n">{num(l.km)}</td>
                    <td className="n">{l.custoKm != null ? usd(l.custoKm, 2) : "–"}</td>
                    <td className="n">{l.saldo == null ? "–" : <span className={l.saldo < 0 ? "t-bad" : undefined}>{usd(l.saldo)}</span>}</td>
                    <td className="n">{nAlertas ? <span className="pill bad">{nAlertas}</span> : <span className="muted">0</span>}</td>
                    <td className="n">{usd(l.mrr)}</td>
                    <td><span className={`pill ${l.situacao === "em_dia" ? "ok" : l.situacao === "atrasado" ? "warn" : "bad"}`}>{l.situacao === "em_dia" ? "em dia" : l.situacao === "atrasado" ? `atraso ${l.c.diasEmAtraso} dias` : "bloqueado"}</span></td>
                    <td><Link className="link-alerta" href={`/contrato/${l.c.id}`}>{NOME_PLANO[l.c.planoContratado as Plano]} · {l.c.caminhoesContratados}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
          <div className="card-h"><h2>Alertas de todos os clientes</h2><p>{alertas.length} abertos</p></div>
          {alertas.length === 0 ? (
            <p className="note">Nenhum alerta aberto.</p>
          ) : (
            <ul className="alerts">
              {alertas.slice(0, 12).map((a, i) => (
                <li key={`${a.clienteId}-${a.titulo}-${i}`}>
                  <span className="sev" style={{ background: `var(--${a.sev})` }} />
                  <div>
                    <AbrirCliente id={a.clienteId} tela={a.tela} className="link-alerta"><b>{a.titulo}</b></AbrirCliente>
                    <small>{a.cliente} · {a.detalhe}</small>
                  </div>
                  <span className={`pill ${a.sev}`}>{a.sev === "bad" ? "Urgente" : a.sev === "warn" ? "Atenção" : "Aviso"}</span>
                </li>
              ))}
            </ul>
          )}
      </div>
      <div className="card">
          <div className="card-h"><h2>Cobrança e cores</h2><p>Dias em atraso e país de cada cliente</p></div>
          <div className="tw">
            <table>
              <thead><tr><th>Cliente</th><th>Dias em atraso</th><th>País (cores)</th></tr></thead>
              <tbody>
                {linhas.map(({ c }) => (
                  <tr key={c.id}>
                    <td><b>{c.nome}</b></td>
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
          <p className="note">Por enquanto o atraso é informado à mão. A integração com o faturamento eletrônico (SIFEN) e o banco fica para depois do MVP.</p>
      </div>
      <div className="card">
        <div className="card-h">
          <h2>Cotação do dia</h2>
          <p>Fonte: {cotacao.fonte} · {cotacao.data.split("-").reverse().join("/")}</p>
        </div>
        <form action={salvarCotacao} className="form">
          <label htmlFor="pygPorUsd">Guaranis por dólar<input id="pygPorUsd" name="pygPorUsd" type="number" step="any" min="1" defaultValue={cotacao.pygPorUsd} /></label>
          <label htmlFor="brlPorUsd">Reais por dólar<input id="brlPorUsd" name="brlPorUsd" type="number" step="any" min="0.01" defaultValue={cotacao.brlPorUsd} /></label>
          <label htmlFor="arsPorUsd">Pesos argentinos por dólar<input id="arsPorUsd" name="arsPorUsd" type="number" step="any" min="0.01" defaultValue={cotacao.arsPorUsd} /></label>
          <button type="submit">Usar esta cotação hoje</button>
        </form>
        <p className="note">A cotação é buscada sozinha uma vez por dia. Use este campo só se quiser fixar outra (por exemplo, a do seu banco).</p>
      </div>
      <div className="card" id="acessos">
        <div className="card-h"><h2>Acessos dos gestores</h2><p>Login de cada cliente na KM Cero. Crie mais um acesso ou troque a senha de quem esqueceu.</p></div>
        <AcessosGestores clientes={clientes.map((c) => ({ id: c.id, nome: c.nome }))} gestores={gestores.map((g) => ({ id: g.id, nome: g.nome, email: g.email, cliente: g.cliente?.nome ?? "–" }))} />
      </div>
      <div className="card" id="novo-cliente">
        <div className="card-h"><h2>Cadastrar cliente</h2><p>Cria a transportadora e o acesso do gestor.</p></div>
        <NovoCliente />
      </div>
    </>
  );
}

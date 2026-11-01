import { Kpi, Placa } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { SIMBOLO, type Moeda } from "@/lib/cambio";
import { db } from "@/lib/db";
import { dataBr, num, usd } from "@/lib/formato";
import { CATEGORIAS_PAGAR, diasAte, situacaoPagar, totaisPagar, type CategoriaPagar, type SituacaoPagar } from "@/lib/pagar";
import { excluirConta, pagarConta } from "./actions";
import { NovaConta } from "./NovaConta";

export const dynamic = "force-dynamic";

const SECOES: { s: SituacaoPagar[]; titulo: string }[] = [
  { s: ["vencida"], titulo: "Vencidas" },
  { s: ["hoje", "semana"], titulo: "Vencem nos próximos 7 dias" },
  { s: ["mes"], titulo: "Vencem em até 30 dias" },
  { s: ["depois"], titulo: "Mais adiante" },
];

function Quando({ venc, hoje }: { venc: Date; hoje: Date }) {
  const d = diasAte(venc, hoje);
  if (d < 0) return <span className="pill bad">vencida há {-d} {d === -1 ? "dia" : "dias"}</span>;
  if (d === 0) return <span className="pill warn">vence hoje</span>;
  if (d <= 7) return <span className="pill warn">em {d} {d === 1 ? "dia" : "dias"}</span>;
  return <span className="pill">em {d} dias</span>;
}

export default async function Pagar() {
  const { sessao, cliente } = await clienteAtual();
  const pode = podeEditarCadastros(sessao);
  const hoje = new Date();
  const hojeIso = hoje.toISOString().slice(0, 10);
  const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));
  const [contas, caminhoes] = await Promise.all([
    db.contaPagar.findMany({
      where: { clienteId: cliente.id, OR: [{ pagoEm: null }, { pagoEm: { gte: inicioMes } }] },
      orderBy: { vencimento: "asc" },
      include: { caminhao: { select: { placa: true } } },
    }),
    db.caminhao.findMany({ where: { clienteId: cliente.id, baseCombustivel: false }, orderBy: { placa: "asc" }, select: { id: true, placa: true } }),
  ]);
  const t = totaisPagar(contas, hoje);
  const abertas = contas.filter((c) => !c.pagoEm);
  const pagas = contas.filter((c) => c.pagoEm).sort((a, b) => b.pagoEm!.getTime() - a.pagoEm!.getTime());

  const Linha = ({ c }: { c: (typeof contas)[number] }) => (
    <tr>
      <td>{dataBr(c.vencimento)}<br />{c.pagoEm ? <span className="pill ok">pago {dataBr(c.pagoEm)}</span> : <Quando venc={c.vencimento} hoje={hoje} />}</td>
      <td>{c.descricao}{c.parcela && <small className="muted"> · {c.parcela}/{c.parcelas}</small>}<br /><small className="muted">{CATEGORIAS_PAGAR[c.categoria as CategoriaPagar] ?? c.categoria}{c.fornecedor ? ` · ${c.fornecedor}` : ""}</small></td>
      <td>{c.caminhao ? <Placa placa={c.caminhao.placa} /> : <small className="muted">empresa</small>}</td>
      <td className="n">{usd(c.valorUsd)}{c.moeda !== "USD" && <><br /><small className="muted">{SIMBOLO[c.moeda as Moeda]} {num(c.valorOriginal, 2)}</small></>}</td>
      {pode && (
        <td>
          <form action={pagarConta} className="form receber-form">
            <input type="hidden" name="id" value={c.id} />
            {!c.pagoEm && <input name="data" type="date" defaultValue={hojeIso} aria-label="Data do pagamento" />}
            <button type="submit" className={c.pagoEm ? "link" : undefined}>{c.pagoEm ? "desfazer" : "Pagar"}</button>
          </form>
          {!c.pagoEm && (
            <form action={excluirConta} style={{ marginTop: 4 }}>
              <input type="hidden" name="id" value={c.id} />
              <button type="submit" className="link">excluir</button>
              {c.grupo && <> · <button type="submit" name="todas" value="1" className="link">excluir esta e as próximas</button></>}
            </form>
          )}
        </td>
      )}
    </tr>
  );

  const cab = <thead><tr><th>Vencimento</th><th>Conta</th><th>Caminhão</th><th className="n">Valor</th>{pode && <th />}</tr></thead>;

  return (
    <>
      <h1>Contas a pagar</h1>
      <div className="grid g4">
        <Kpi rotulo="Vencido" valor={usd(t.vencido)} sub={t.vencido > 0 ? "pagar agora" : "nada atrasado"} />
        <Kpi rotulo="Vence em 7 dias" valor={usd(t.semana)} />
        <Kpi rotulo="Próximos 30 dias" valor={usd(t.trintaDias)} sub="inclui o vencido" />
        <Kpi rotulo="Pago no mês" valor={usd(t.pagoNoMes)} />
      </div>
      {pode && (
        <div className="card" id="nova">
          <div className="card-h"><h2>Nova conta</h2><p>Parcelas, seguro, salários, oficina. Para financiamento, escolha quantas parcelas: lançamos todas de uma vez.</p></div>
          <NovaConta caminhoes={caminhoes} hoje={hojeIso} />
        </div>
      )}
      {abertas.length === 0 && <div className="card"><p className="note">Nenhuma conta em aberto.</p></div>}
      {SECOES.map((sec) => {
        const lista = abertas.filter((c) => sec.s.includes(situacaoPagar(c.vencimento, hoje)));
        if (lista.length === 0) return null;
        const total = lista.reduce((s, c) => s + c.valorUsd, 0);
        // Mais adiante: só a próxima parcela de cada financiamento, para a lista não ficar enorme.
        const vistos = new Set<string>();
        const mostrar = sec.s.includes("depois") ? lista.filter((c) => !c.grupo || (!vistos.has(c.grupo) && vistos.add(c.grupo))) : lista;
        const escondidas = lista.length - mostrar.length;
        return (
          <div className="card" key={sec.titulo}>
            <div className="card-h"><h2>{sec.titulo}</h2><p>{lista.length} {lista.length === 1 ? "conta" : "contas"} · <b>{usd(total)}</b></p></div>
            <div className="tw"><table>{cab}<tbody>{mostrar.map((c) => <Linha key={c.id} c={c} />)}</tbody></table></div>
            {escondidas > 0 && <p className="note">Mais {escondidas} {escondidas === 1 ? "parcela seguinte" : "parcelas seguintes"} dos mesmos financiamentos, que aparecem aqui conforme chegam perto.</p>}
          </div>
        );
      })}
      {pagas.length > 0 && (
        <div className="card">
          <div className="card-h"><h2>Pagas neste mês</h2><p>{usd(t.pagoNoMes)}</p></div>
          <div className="tw"><table>{cab}<tbody>{pagas.map((c) => <Linha key={c.id} c={c} />)}</tbody></table></div>
        </div>
      )}
      <p className="note">As contas a pagar são o caixa da empresa. O custo por km continua vindo das despesas lançadas e dos custos fixos de cada caminhão.</p>
    </>
  );
}

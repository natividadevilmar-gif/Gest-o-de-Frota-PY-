import Link from "next/link";
import { Kpi, Placa } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { indicadoresFrota, saldoEmpresa, saldoPorMes, revisoesCliente, totaisFrota, viagensCliente } from "@/lib/dados";
import { db } from "@/lib/db";
import { num, usd, nomeMes } from "@/lib/formato";
import { mesAtual, NOME_PLANO, planoPermite } from "@/lib/indicadores";
import { Relatorios } from "./Relatorios";

export default async function Painel() {
  const { sessao, cliente } = await clienteAtual();
  const mes = mesAtual();
  const ind = await indicadoresFrota(cliente.id, mes);
  const gestao = ind.filter((i) => planoPermite(i.plano, "custos"));
  const tot = totaisFrota(gestao);
  const revisoes = (await revisoesCliente(cliente.id)).filter((r) => r.demo || planoPermite(r.caminhao.plano, "revisoes"));
  const viagens = (await viagensCliente(cliente.id, mes, ind)).filter((v) => v.margem);
  const frete = viagens.reduce((a, v) => a + v.freteUsd, 0);
  const margem = viagens.reduce((a, v) => a + (v.margem?.margemUsd ?? 0), 0);
  const [saldo, historico, motoristas] = await Promise.all([
    saldoEmpresa(cliente.id, mes),
    saldoPorMes(cliente.id, mes),
    db.motorista.findMany({ where: { clienteId: cliente.id }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  type Alerta = { sev: "bad" | "warn" | "info"; titulo: string; detalhe: string; href: string };
  const alertas: Alerta[] = [
    ...revisoes
      .filter((r) => r.status.situacao !== "em_dia")
      .map<Alerta>((r) => ({
        sev: r.status.situacao === "vencida" ? "bad" : "warn",
        titulo: `${r.caminhao.placa} · ${r.nome}`,
        detalhe:
          r.status.kmRestantes !== undefined
            ? r.status.kmRestantes < 0
              ? `Passou ${num(-r.status.kmRestantes)} km do limite.`
              : `Faltam ${num(r.status.kmRestantes)} km.`
            : r.status.diasRestantes !== undefined
              ? r.status.diasRestantes < 0
                ? `Venceu há ${-r.status.diasRestantes} dias.`
                : `Vence em ${r.status.diasRestantes} dias.`
              : "Falha ativa lida pela CAN.",
        href: "/revisoes",
      })),
    ...gestao
      .filter((i) => i.suspeitaDesvio)
      .map<Alerta>((i) => ({
        sev: "bad",
        titulo: `${i.placa} · possível desvio de diesel`,
        detalhe: `Abastecido ${num(i.desvioPct, 1)}% acima do consumo medido pela CAN neste mês.`,
        href: "/consumo",
      })),
    ...ind
      .filter((i) => i.excessosVelocidade >= 15)
      .map<Alerta>((i) => ({ sev: "info", titulo: `${i.placa} · excesso de velocidade`, detalhe: `${i.excessosVelocidade} eventos neste mês.`, href: "/consumo" })),
  ].sort((a, b) => ["bad", "warn", "info"].indexOf(a.sev) - ["bad", "warn", "info"].indexOf(b.sev));

  const temGestao = gestao.length > 0;
  return (
    <>
      <div className="card-h">
        <h1>Painel de {nomeMes(mes)}</h1>
        <div className="acoes-painel">
          <Link className="btn pri" href="/despesas">+ Lançar despesa</Link>
          <Link className="btn pri" href="/fretes#novo">+ Lançar frete</Link>
          <Link className="btn pri" href="/viagens#simulador">Simular frete</Link>
          <Link className="btn" href="/caixa#novo">Caixa inicial do motorista</Link>
          <Link className="btn" href="/painel/semana">📊 Relatório da semana</Link>
        </div>
      </div>
      <div className="grid g4">
        <Kpi rotulo="Saldo do mês anterior" valor={usd(saldo.anterior)} sub="acumulado até o fim do mês passado" />
        <Kpi rotulo="Fretes do mês" valor={usd(saldo.fretes)} sub={`${usd(saldo.aReceber)} ainda a receber`} />
        <Kpi rotulo="Despesas do mês" valor={usd(saldo.despesas)} sub="lançadas na frota" />
        <Kpi rotulo="Saldo em caixa" valor={usd(saldo.saldo)} sub="saldo anterior + fretes − despesas" />
      </div>
      {podeEditarCadastros(sessao) && <div className="card">
        <div className="card-h"><h2>Relatórios em Excel</h2><p>Escolha o mês; o do motorista traz despesas, fretes e caixa dele</p></div>
        <Relatorios mes={mes} motoristas={motoristas} />
      </div>}
      {temGestao ? (
        <div className="grid g4">
          <Kpi rotulo="Custo por km" valor={usd(tot.custoKm, 2)} sub={`${usd(tot.custo)} em ${num(tot.km)} km`} />
          <Kpi rotulo="Consumo médio" valor={num(tot.kmL, 2)} unidade="km/l" sub="medido na rede CAN" />
          <Kpi
            rotulo="Revisões em dia"
            valor={String(revisoes.filter((r) => r.status.situacao === "em_dia").length)}
            unidade={`de ${revisoes.length}`}
            sub={`${revisoes.filter((r) => r.status.situacao === "vencida").length} vencidas, ${revisoes.filter((r) => r.status.situacao === "proxima").length} próximas`}
          />
          <Kpi rotulo="Margem das viagens" valor={frete ? num((margem / frete) * 100, 0) : "–"} unidade="%" sub={`${viagens.length} viagens, já com retorno vazio`} />
        </div>
      ) : (
        <p className="note">Custo por km, consumo, revisões e margem aparecem quando algum caminhão estiver no plano Gestão.</p>
      )}
      <div className="grid g2">
        <div className="card">
          <div className="card-h">
            <h2>Alertas</h2>
            <p>{alertas.length} abertos</p>
          </div>
          {alertas.length === 0 ? (
            <p className="note">Nenhum alerta aberto.</p>
          ) : (
            <ul className="alerts">
              {alertas.slice(0, 10).map((a) => (
                <li key={a.titulo}>
                  <span className="sev" style={{ background: `var(--${a.sev})` }} />
                  <div>
                    <Link href={a.href}><b>{a.titulo}</b></Link>
                    <small>{a.detalhe}</small>
                  </div>
                  <span className={`pill ${a.sev}`}>{a.sev === "bad" ? "Urgente" : a.sev === "warn" ? "Atenção" : "Aviso"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <div className="card-h">
            <h2>Frota no mês</h2>
            <p>{ind.length} caminhões</p>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr><th>Caminhão</th><th>Motorista</th><th>Plano</th><th className="n">km no mês</th><th className="n">Odômetro</th></tr>
              </thead>
              <tbody>
                {ind.map((i) => (
                  <tr key={i.id}>
                    <td><Placa placa={i.placa} /></td>
                    <td>{i.motorista ?? "–"}</td>
                    <td><span className="tag">{NOME_PLANO[i.plano]}</span></td>
                    <td className="n">{num(i.km)}</td>
                    <td className="n">{num(i.odometroKm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h2>Saldo em caixa mês a mês</h2><p>O saldo de cada mês passa para o seguinte</p></div>
        <div className="tw">
          <table>
            <thead><tr><th>Mês</th><th className="n">Fretes</th><th className="n">Despesas</th><th className="n">Resultado do mês</th><th className="n">Saldo acumulado</th></tr></thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.mes}>
                  <td>{nomeMes(h.mes)}</td>
                  <td className="n">{usd(h.fretes)}</td>
                  <td className="n">{usd(h.despesas)}</td>
                  <td className="n"><span className={h.resultado < 0 ? "t-bad" : "t-ok"}>{usd(h.resultado)}</span></td>
                  <td className="n"><b>{usd(h.saldo)}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

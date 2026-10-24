import Link from "next/link";
import { redirect } from "next/navigation";
import { Kpi, SeletorMes } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { SIMBOLO, type Moeda } from "@/lib/cambio";
import { caixaMes } from "@/lib/dados";
import { mesValido, nomeMes, num, usd } from "@/lib/formato";
import { mesAtual } from "@/lib/indicadores";
import { FormCaixa } from "./FormCaixa";

export default async function Caixa({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) redirect("/despesas");
  const mes = mesValido((await searchParams).mes, mesAtual());
  const c = await caixaMes(cliente.id, mes);
  return (
    <>
      <div className="card-h">
        <h1>Caixa · {nomeMes(mes)}</h1>
        <SeletorMes mes={mes} caminho="/caixa" />
      </div>
      <div className="grid g4">
        <Kpi rotulo="Caixa inicial" valor={usd(c.inicialUsd)} sub={c.inicial ? (c.inicial.moeda === "USD" ? "informado em dólar" : `${SIMBOLO[c.inicial.moeda as Moeda]} ${num(c.inicial.valorOriginal, c.inicial.moeda === "PYG" ? 0 : 2)}`) : "ainda não informado"} />
        <Kpi rotulo="Fretes recebidos" valor={usd(c.recebidos)} sub={`${usd(c.aReceber)} ainda a receber`} />
        <Kpi rotulo="Despesas do mês" valor={usd(c.gastos + c.extras)} sub={c.extras ? `inclui ${usd(c.extras)} de custos extras das viagens` : "lançadas na frota"} />
        <Kpi rotulo="Saldo em caixa" valor={usd(c.saldo)} sub={`com tudo recebido: ${usd(c.saldo + c.aReceber)}`} />
      </div>
      <div className="card">
        <div className="card-h"><h2>Caixa inicial de {nomeMes(mes)}</h2><p>Saldo = caixa inicial + fretes recebidos − despesas</p></div>
        <FormCaixa key={mes} mes={mes} atual={c.inicial} />
      </div>
      <p className="note">Os fretes recebidos e a receber são controlados em <Link href={`/fretes?mes=${mes}`}>Fretes</Link>. As despesas são as lançadas em <Link href="/despesas">Lançar despesa</Link>.</p>
    </>
  );
}

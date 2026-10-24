import { Placa, PlanoNecessario, SeletorMes } from "@/components/ui";
import { clienteAtual } from "@/lib/acesso";
import { indicadoresFrota, viagensCliente } from "@/lib/dados";
import { dataBr, mesValido, nomeMes, num, usd } from "@/lib/formato";
import { mesAtual, planoPermite } from "@/lib/indicadores";
import Link from "next/link";
import { Simulador } from "./Formularios";

export default async function Viagens({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { cliente } = await clienteAtual();
  const mes = mesValido((await searchParams).mes, mesAtual());
  const ind = (await indicadoresFrota(cliente.id, mes)).filter((i) => planoPermite(i.plano, "viagens"));
  if (ind.length === 0) return <PlanoNecessario modulo="viagens" titulo="Margem por viagem" />;
  const viagens = (await viagensCliente(cliente.id, mes, ind)).filter((v) => ind.some((i) => i.id === v.caminhaoId));
  const comCusto = ind.filter((i) => i.custoKm !== null).map((i) => ({ id: i.id, placa: i.placa, custoKm: i.custoKm! }));

  return (
    <>
      <div className="card-h">
        <h1>Margem por viagem · {nomeMes(mes)}</h1>
        <SeletorMes mes={mes} caminho="/viagens" />
      </div>
      <div className="card">
        <div className="card-h"><h2>Viagens do mês</h2><p>Frete menos custo por km × distância, contando o retorno vazio</p></div>
        {viagens.length === 0 ? (
          <p className="note">Nenhuma viagem registrada neste mês.</p>
        ) : (
          <div className="tw">
            <table>
              <thead><tr><th>Data</th><th>Caminhão</th><th>Rota</th><th>Carga</th><th className="n">Frete</th><th className="n">km ida + volta</th><th className="n">Custo</th><th className="n">Margem</th></tr></thead>
              <tbody>
                {viagens.map((v) => {
                  const p = v.margem?.margemPct ?? null;
                  return (
                    <tr key={v.id}>
                      <td>{dataBr(v.data)}</td>
                      <td><Placa placa={v.caminhao.placa} /></td>
                      <td>{v.origem} → {v.destino}</td>
                      <td>{v.carga}, {num(v.toneladas)} t</td>
                      <td className="n">{usd(v.freteUsd)}</td>
                      <td className="n">{num(v.kmCarregado)} + {num(v.kmVazio)}</td>
                      <td className="n">{usd(v.margem?.custoUsd)}</td>
                      <td className="n">
                        {v.margem ? <span className={`pill ${p! < 5 ? "bad" : p! < 15 ? "warn" : "ok"}`}>{usd(v.margem.margemUsd)} · {num(p, 0)}%</span> : "sem km no mês"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {comCusto.length > 0 && (
        <div className="card">
          <div className="card-h"><h2>Simular um frete antes de aceitar</h2><p>Usa o custo por km real do caminhão neste mês</p></div>
          <Simulador caminhoes={comCusto} />
        </div>
      )}
      <p className="note">Para lançar um frete com cliente, rota, produto e recebimento, use <Link href="/fretes#novo">Fretes e margem</Link>.</p>
    </>
  );
}

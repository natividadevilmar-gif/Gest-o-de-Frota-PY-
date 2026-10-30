import { Placa, PillRevisao, PlanoNecessario } from "@/components/ui";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { revisoesCliente } from "@/lib/dados";
import { db } from "@/lib/db";
import { dataBr, num } from "@/lib/formato";
import { AVISO_KM, planoPermite, type Plano } from "@/lib/indicadores";
import { montarDemonstracao, removerDemonstracao } from "./actions";
import { NovoItem, RegistrarServico } from "./Formularios";
import Link from "next/link";

const COR = { vencida: "var(--bad)", proxima: "var(--warn)", em_dia: "var(--ok)" } as const;
const FILTROS = [
  { s: "vencida", classe: "bad", rotulo: "vencidas" },
  { s: "proxima", classe: "warn", rotulo: "próximas" },
  { s: "em_dia", classe: "ok", rotulo: "em dia" },
] as const;

export default async function Revisoes({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  const pedido = (await searchParams).situacao;
  const filtro = FILTROS.find((f) => f.s === pedido)?.s;
  // Itens da demonstração aparecem mesmo em caminhão fora do plano Gestão.
  const itens = (await revisoesCliente(cliente.id)).filter((r) => r.demo || planoPermite(r.caminhao.plano as Plano, "revisoes"));
  const comDemo = new Set(itens.filter((i) => i.demo).map((i) => i.caminhaoId));
  const caminhoes = (await db.caminhao.findMany({ where: { clienteId: cliente.id }, orderBy: { placa: "asc" } })).filter((c) => comDemo.has(c.id) || planoPermite(c.plano as Plano, "revisoes"));
  const admin = sessao.papel === "ADMIN";
  if (caminhoes.length === 0) {
    return (
      <>
        <PlanoNecessario modulo="revisoes" titulo="Revisões" />
        {admin && (
          <form className="card" action={montarDemonstracao} style={{ maxWidth: 640 }}>
            <div className="card-h"><h2>Demonstração</h2><p>Monta um plano de revisões de exemplo com os odômetros reais dos caminhões, para mostrar a tela ao cliente. Não muda o plano nem a mensalidade.</p></div>
            <button className="pri" type="submit">Montar plano de demonstração</button>
          </form>
        )}
      </>
    );
  }
  const conta = (s: string) => itens.filter((i) => i.status.situacao === s).length;
  const pendentes = itens.filter((i) => !(i.gatilho === "FALHA" && i.resolvido));

  return (
    <>
      <h1>Revisões</h1>
      {comDemo.size > 0 && (
        <div className="card">
          <div className="card-h">
            <h2>Plano de demonstração</h2>
            <p>Itens de exemplo com os odômetros reais. Serviço registrado neles não entra nas despesas.</p>
          </div>
          {admin && (
            <div className="legend">
              <form action={montarDemonstracao}><button type="submit">Refazer demonstração</button></form>
              <form action={removerDemonstracao}><button type="submit">Remover demonstração</button></form>
            </div>
          )}
        </div>
      )}
      <div className="card">
        <div className="card-h">
          <h2>Plano de revisões</h2>
          <p>Por km ou por data · aviso com {num(AVISO_KM)} km de antecedência</p>
        </div>
        <div className="legend">
          {FILTROS.map((f) => (
            <Link key={f.s} href={filtro === f.s ? "/revisoes" : `/revisoes?situacao=${f.s}`} className={`pill ${f.classe} pill-filtro${filtro === f.s ? " ativo" : ""}`} aria-pressed={filtro === f.s}>
              {conta(f.s)} {f.rotulo}
            </Link>
          ))}
          {filtro && <Link href="/revisoes">Mostrar todas</Link>}
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Caminhão</th><th>Item</th><th>Gatilho</th><th>Vence</th><th>Uso do intervalo</th><th className="n">Falta</th><th>Situação</th></tr></thead>
            <tbody>
              {itens.filter((i) => !filtro || i.status.situacao === filtro).map((i) => {
                const s = i.status;
                return (
                  <tr key={i.id}>
                    <td><Placa placa={i.caminhao.placa} /></td>
                    <td>{i.nome}{i.demo && <> <span className="tag">exemplo</span></>}</td>
                    <td><span className="tag">{i.gatilho === "KM" ? `a cada ${num(i.intervaloKm)} km` : i.gatilho === "DATA" ? "por data" : "leitura CAN"}</span></td>
                    <td>{s.venceAosKm !== undefined ? `aos ${num(s.venceAosKm)} km` : i.vencimento ? dataBr(i.vencimento) : "imediato"}</td>
                    <td><div className="prog"><span style={{ width: `${s.usoIntervalo * 100}%`, background: COR[s.situacao] }} /></div></td>
                    <td className="n">
                      {s.kmRestantes !== undefined
                        ? s.kmRestantes < 0 ? `passou ${num(-s.kmRestantes)} km` : `${num(s.kmRestantes)} km`
                        : s.diasRestantes !== undefined
                          ? s.diasRestantes < 0 ? `venceu há ${-s.diasRestantes} dias` : `${s.diasRestantes} dias`
                          : i.resolvido ? "resolvido" : "agora"}
                    </td>
                    <td><PillRevisao situacao={s.situacao} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h2>Registrar serviço feito</h2><p>O custo entra na manutenção do custo por km.</p></div>
        <RegistrarServico
          hoje={new Date().toISOString().slice(0, 10)}
          itens={pendentes.map((i) => ({ id: i.id, rotulo: `${i.caminhao.placa} · ${i.nome}`, gatilho: i.gatilho, odometroKm: i.caminhao.odometroKm }))}
        />
      </div>
      {podeEditarCadastros(sessao) && (
        <div className="card">
          <div className="card-h"><h2>Adicionar item ao plano</h2><p>Intervalos do manual do fabricante, documentos com vencimento.</p></div>
          <NovoItem caminhoes={caminhoes.map((c) => ({ id: c.id, placa: c.placa }))} />
        </div>
      )}
    </>
  );
}

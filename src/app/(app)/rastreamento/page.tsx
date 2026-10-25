import Link from "next/link";
import { clienteAtual } from "@/lib/acesso";
import { frotaNoMapa } from "@/lib/rastreio/dados";
import { diaNoParaguai } from "@/lib/rastreio/rotas";
import { MapaFrota } from "./MapaFrota";

export const dynamic = "force-dynamic";

export default async function Rastreamento({ searchParams }: { searchParams: Promise<{ todos?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  const admin = sessao.papel === "ADMIN";
  const todos = admin && (await searchParams).todos === "1";
  const frota = await frotaNoMapa(todos ? null : cliente.id);
  const hoje = diaNoParaguai(new Date()).toISOString().slice(0, 10);
  const demo = frota.some((c) => c.demo);
  return (
    <>
      <div className="titulo-acoes">
        <h1>Mapa ao vivo</h1>
        {admin && (
          <div className="alternar" role="group" aria-label="Quais caminhões mostrar">
            <Link href="/rastreamento" aria-current={!todos ? "true" : undefined}>Só {cliente.nome}</Link>
            <Link href="/rastreamento?todos=1" aria-current={todos ? "true" : undefined}>Todos os clientes</Link>
          </div>
        )}
      </div>
      {demo && (
        <p className="aviso-demo">
          Os caminhões marcados como <b>demonstração</b> ainda não têm aparelho instalado: a posição deles é simulada numa rota real.
          Ao cadastrar o IMEI do rastreador em Caminhões e planos, o caminhão passa a mostrar a posição verdadeira.
        </p>
      )}
      <MapaFrota key={todos ? "todos" : cliente.id} inicial={frota} hoje={hoje} todos={todos} />
    </>
  );
}

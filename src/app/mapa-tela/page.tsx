import { MapaFrota } from "@/app/(app)/rastreamento/MapaFrota";
import { clienteAtual } from "@/lib/acesso";
import { frotaNoMapa } from "@/lib/rastreio/dados";
import { diaNoParaguai } from "@/lib/rastreio/rotas";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mapa ao vivo · KM Cero" };

/** Só o mapa ao vivo e a lista, sem menu, para deixar aberto num segundo monitor. */
export default async function MapaEmOutraTela({ searchParams }: { searchParams: Promise<{ todos?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  const todos = sessao.papel === "ADMIN" && (await searchParams).todos === "1";
  const frota = await frotaNoMapa(todos ? null : cliente.id);
  const hoje = diaNoParaguai(new Date()).toISOString().slice(0, 10);
  return (
    <main className="tela-mapa">
      <MapaFrota key={todos ? "todos" : cliente.id} inicial={frota} hoje={hoje} todos={todos} outraTela />
    </main>
  );
}

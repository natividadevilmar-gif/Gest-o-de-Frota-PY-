import { Central } from "@/app/(app)/monitoramento/Central";
import { clienteAtual } from "@/lib/acesso";
import { dadosCentral, TIPOS_CERCA } from "@/lib/monitoramento";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mapa da central · KM Cero" };

/** Só o mapa da central, sem menu, para deixar aberto num segundo monitor. */
export default async function MapaCentral({ searchParams }: { searchParams: Promise<{ todos?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  const todos = sessao.papel === "ADMIN" && (await searchParams).todos === "1";
  const dados = await dadosCentral(todos ? null : cliente.id);
  return (
    <main className="tela-mapa">
      <Central inicial={dados} todos={todos} clienteNome={cliente.nome} podeCercas={false} tiposCerca={TIPOS_CERCA} soMapa />
    </main>
  );
}

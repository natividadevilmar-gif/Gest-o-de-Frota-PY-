import Link from "next/link";
import { clienteAtual } from "@/lib/acesso";
import { processarComandos } from "@/lib/comandos/dados";
import { NOME_GATILHO, dadosVideo } from "@/lib/video";
import { db } from "@/lib/db";
import { PainelMdvr } from "./PainelMdvr";
import { Video } from "./Video";

export const dynamic = "force-dynamic";

const CAMERAS_CUSAT = "https://flota.cusat.com.py/mapaGeral_v3/#/";

export default async function PaginaVideo({ searchParams }: { searchParams: Promise<{ todos?: string; caminhao?: string; midia?: string }> }) {
  const { sessao, cliente } = await clienteAtual();
  const admin = sessao.papel === "ADMIN";
  const sp = await searchParams;
  const todos = admin && sp.todos === "1";
  await processarComandos(todos ? null : cliente.id);
  const dados = await dadosVideo(todos ? null : cliente.id);
  const mdvr = todos ? [] : await db.caminhao.findMany({ where: { clienteId: cliente.id, plano: "VIDEO", camera: "mdvr4" }, select: { placa: true }, orderBy: { placa: "asc" } });
  // Cliente com CUSAT: as câmeras ficam no site de vídeo deles, até haver a chave da API.
  const linkCameras = cliente.mdvrUrl ?? (cliente.gpswoxHash ? CAMERAS_CUSAT : null);
  const painelExterno = !todos && (mdvr.length > 0 || !!linkCameras);
  return (
    <>
      <div className="titulo-acoes">
        <h1>Vídeo</h1>
        {admin && (
          <div className="alternar" role="group" aria-label="Quais clientes">
            <Link href="/video" aria-current={!todos ? "true" : undefined}>Só {cliente.nome}</Link>
            <Link href="/video?todos=1" aria-current={todos ? "true" : undefined}>Todos os clientes</Link>
          </div>
        )}
      </div>
      {painelExterno && <PainelMdvr placas={mdvr.map((c) => c.placa)} url={linkCameras} admin={admin} />}
      {dados.cameras.length === 0 ? (painelExterno ? null : (
        <div className="card">
          <p>Nenhum caminhão de {todos ? "nenhum cliente" : cliente.nome} está no plano Vídeo.</p>
          <p className="note">No plano Vídeo o caminhão leva duas câmeras (estrada e cabine) ou um MDVR de 4 câmeras. Elas gravam sozinhas cada freada brusca, excesso ou impacto, e a central pode pedir uma foto ou vídeo a qualquer momento. Mude o plano do caminhão em Caminhões e planos.</p>
        </div>
      )) : (
        <Video
          key={todos ? "todos" : cliente.id}
          inicial={dados}
          todos={todos}
          caminhaoInicial={sp.caminhao ?? null}
          midiaInicial={sp.midia ?? null}
          podePedir={sessao.papel !== "MOTORISTA"}
          gatilhos={NOME_GATILHO}
        />
      )}
    </>
  );
}

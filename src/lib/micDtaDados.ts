import "server-only";
import { db } from "@/lib/db";
import { esquemaMic, micPadrao, numeroMic, type DadosMic } from "@/lib/micDta";

/** Próxima sequência do ano para o número do MIC da transportadora. */
export async function proximaSequencia(clienteId: string, ano: number): Promise<number> {
  const ultimo = await db.micDta.findFirst({ where: { clienteId, ano }, orderBy: { sequencia: "desc" }, select: { sequencia: true } });
  return (ultimo?.sequencia ?? 0) + 1;
}

const ler = (j: unknown): DadosMic | null => {
  const r = esquemaMic.safeParse(j);
  return r.success ? r.data : null;
};

/** Frete com o MIC salvo ou, se ainda não tem, o MIC preenchido com os dados do frete. */
export async function carregarMic(clienteId: string, viagemId: string) {
  const viagem = await db.viagem.findFirst({
    where: { id: viagemId, caminhao: { clienteId } },
    include: { caminhao: { select: { id: true, placa: true, modelo: true, ano: true } }, motorista: { select: { nome: true } }, mic: true },
  });
  if (!viagem) return null;
  const cliente = await db.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { nome: true, ruc: true, endereco: true, cidade: true, pais: true } });
  const salvo = viagem.mic ? ler(viagem.mic.dados) : null;
  if (salvo) return { viagem, cliente, dados: salvo, salvo: true };

  const ano = viagem.data.getUTCFullYear();
  const [anteriorCaminhao, anteriorEmpresa, seq] = await Promise.all([
    db.micDta.findFirst({ where: { caminhaoId: viagem.caminhao.id }, orderBy: { atualizadoEm: "desc" }, select: { dados: true } }),
    db.micDta.findFirst({ where: { clienteId }, orderBy: { atualizadoEm: "desc" }, select: { dados: true } }),
    proximaSequencia(clienteId, ano),
  ]);
  const dados = micPadrao({
    viagem,
    caminhao: viagem.caminhao,
    cliente,
    numero: numeroMic(cliente.pais, ano, seq),
    anteriorCaminhao: anteriorCaminhao ? ler(anteriorCaminhao.dados) : null,
    anteriorEmpresa: anteriorEmpresa ? ler(anteriorEmpresa.dados) : null,
  });
  return { viagem, cliente, dados, salvo: false };
}

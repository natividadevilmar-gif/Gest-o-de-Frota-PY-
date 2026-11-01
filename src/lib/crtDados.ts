import "server-only";
import { db } from "@/lib/db";
import { crtPadrao, esquemaCrt, numeroCrt, type DadosCrt } from "@/lib/crt";
import { esquemaMic } from "@/lib/micDta";

/** Próxima sequência para o número do CRT da transportadora. */
export async function proximaSequenciaCrt(clienteId: string): Promise<number> {
  const ultimo = await db.crt.findFirst({ where: { clienteId }, orderBy: { sequencia: "desc" }, select: { sequencia: true } });
  return (ultimo?.sequencia ?? 0) + 1;
}

const ler = (j: unknown): DadosCrt | null => {
  const r = esquemaCrt.safeParse(j);
  return r.success ? r.data : null;
};

/** Frete com o CRT salvo ou, se ainda não tem, o CRT preenchido com os dados do frete. */
export async function carregarCrt(clienteId: string, viagemId: string) {
  const viagem = await db.viagem.findFirst({
    where: { id: viagemId, caminhao: { clienteId } },
    include: { caminhao: { select: { placa: true } }, motorista: { select: { nome: true } }, crt: true, mic: { select: { id: true } } },
  });
  if (!viagem) return null;
  const cliente = await db.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { nome: true, ruc: true, endereco: true, cidade: true, pais: true } });
  const salvo = viagem.crt ? ler(viagem.crt.dados) : null;
  if (salvo) return { viagem, cliente, dados: salvo, salvo: true };

  const [recentes, ultimoMic, seq] = await Promise.all([
    db.crt.findMany({ where: { clienteId }, orderBy: { atualizadoEm: "desc" }, take: 50, select: { dados: true } }),
    db.micDta.findFirst({ where: { clienteId }, orderBy: { atualizadoEm: "desc" }, select: { dados: true } }),
    proximaSequenciaCrt(clienteId),
  ]);
  const anteriores = recentes.map((c) => ler(c.dados)).filter((d): d is DadosCrt => d !== null);
  const embarcador = (viagem.embarcador ?? "").trim();
  const anteriorRemetente = embarcador ? anteriores.find((d) => d.remitente.split("\n")[0].trim() === embarcador) : undefined;
  const permisoMic = ultimoMic ? esquemaMic.safeParse(ultimoMic.dados).data?.permiso : null;
  const anteriorEmpresa = anteriores[0];
  const dados = crtPadrao({
    viagem,
    cliente,
    numero: numeroCrt(cliente.pais, anteriorEmpresa?.permiso || permisoMic, seq, viagem.documento),
    anteriorRemetente,
    anteriorEmpresa,
    permisoMic,
  });
  return { viagem, cliente, dados, salvo: false };
}

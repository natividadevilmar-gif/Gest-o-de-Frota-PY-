"use server";

import { revalidatePath } from "next/cache";
import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";
import { CAMPOS_MIC, esquemaMic } from "@/lib/micDta";
import { proximaSequencia } from "@/lib/micDtaDados";

export type ResultadoMic = { ok: boolean; msg: string } | null;

/** Salva os campos do MIC/DTA do frete (cria na primeira vez, com a próxima sequência do ano). */
export async function salvarMic(viagemId: string, _: ResultadoMic, form: FormData): Promise<ResultadoMic> {
  const { sessao, cliente } = await clienteAtual();
  if (sessao.papel === "MOTORISTA") return { ok: false, msg: "Sem permissão." };
  const viagem = await db.viagem.findFirst({ where: { id: viagemId, caminhao: { clienteId: cliente.id } }, select: { id: true, data: true, caminhaoId: true, mic: { select: { id: true } } } });
  if (!viagem) return { ok: false, msg: "Frete não encontrado." };
  const bruto = Object.fromEntries(CAMPOS_MIC.map((c) => [c.chave, String(form.get(c.chave) ?? "")]));
  const p = esquemaMic.safeParse(bruto);
  if (!p.success) return { ok: false, msg: "Algum campo passou do tamanho permitido." };
  if (viagem.mic) {
    await db.micDta.update({ where: { id: viagem.mic.id }, data: { dados: p.data, caminhaoId: viagem.caminhaoId } });
  } else {
    const ano = viagem.data.getUTCFullYear();
    // Dois cliques ao mesmo tempo podem pegar a mesma sequência: tenta a seguinte.
    for (let tentativa = 0; ; tentativa++) {
      try {
        await db.micDta.create({ data: { clienteId: cliente.id, viagemId: viagem.id, caminhaoId: viagem.caminhaoId, ano, sequencia: (await proximaSequencia(cliente.id, ano)) + tentativa, dados: p.data } });
        break;
      } catch (e) {
        if (tentativa >= 3) throw e;
      }
    }
  }
  revalidatePath(`/fretes/${viagem.id}/mic`);
  revalidatePath("/fretes");
  return { ok: true, msg: "MIC/DTA salvo. Confira o documento abaixo e imprima ou salve em PDF." };
}

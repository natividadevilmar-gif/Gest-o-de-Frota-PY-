"use server";

import { revalidatePath } from "next/cache";
import { clienteAtual } from "@/lib/acesso";
import { CAMPOS_CRT, esquemaCrt } from "@/lib/crt";
import { proximaSequenciaCrt } from "@/lib/crtDados";
import { db } from "@/lib/db";

export type ResultadoCrt = { ok: boolean; msg: string } | null;

/** Salva os campos do CRT do frete (cria na primeira vez, com a próxima sequência da transportadora). */
export async function salvarCrt(viagemId: string, _: ResultadoCrt, form: FormData): Promise<ResultadoCrt> {
  const { sessao, cliente } = await clienteAtual();
  if (sessao.papel === "MOTORISTA") return { ok: false, msg: "Sem permissão." };
  const viagem = await db.viagem.findFirst({ where: { id: viagemId, caminhao: { clienteId: cliente.id } }, select: { id: true, documento: true, crt: { select: { id: true } } } });
  if (!viagem) return { ok: false, msg: "Frete não encontrado." };
  const bruto = Object.fromEntries(CAMPOS_CRT.map((c) => [c.chave, String(form.get(c.chave) ?? "")]));
  const p = esquemaCrt.safeParse(bruto);
  if (!p.success) return { ok: false, msg: "Algum campo passou do tamanho permitido." };
  if (viagem.crt) {
    await db.crt.update({ where: { id: viagem.crt.id }, data: { dados: p.data } });
  } else {
    // Dois cliques ao mesmo tempo podem pegar a mesma sequência: tenta a seguinte.
    for (let tentativa = 0; ; tentativa++) {
      try {
        await db.crt.create({ data: { clienteId: cliente.id, viagemId: viagem.id, sequencia: (await proximaSequenciaCrt(cliente.id)) + tentativa, dados: p.data } });
        break;
      } catch (e) {
        if (tentativa >= 3) throw e;
      }
    }
  }
  // O número do CRT vira o documento do frete (e vai para o campo 23 do MIC/DTA), se ainda não tinha.
  if (!viagem.documento?.trim() && p.data.numero) await db.viagem.update({ where: { id: viagem.id }, data: { documento: `CRT ${p.data.numero}` } });
  revalidatePath(`/fretes/${viagem.id}/crt`);
  revalidatePath("/fretes");
  return { ok: true, msg: "CRT salvo. Confira o documento abaixo e imprima ou salve em PDF." };
}

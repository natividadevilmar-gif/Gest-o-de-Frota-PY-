"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";
import { BLOQUEIO_ATIVO, COMANDOS, ehTextoDeBloqueio, textoComando, type TipoComando } from "@/lib/comandos/catalogo";

export type Resultado = { ok: boolean; msg: string } | null;

// Quem pode o quê: o operador consulta e pede imagens; bloquear, desbloquear e
// reiniciar ficam com gestor e equipe KM Cero; o comando livre só com a equipe.
const SO_GESTOR: TipoComando[] = ["bloquear", "desbloquear", "reiniciar"];

const pedido = z.object({
  caminhaoId: z.string().min(1),
  tipo: z.enum(Object.keys(COMANDOS) as [TipoComando, ...TipoComando[]]),
  motivo: z.string().trim().max(300).optional(),
  camera: z.enum(["frontal", "cabine"]).optional(),
  livre: z.string().trim().max(200).optional(),
});

export async function pedirComando(entrada: z.input<typeof pedido>): Promise<Resultado> {
  const { sessao, cliente } = await clienteAtual();
  const p = pedido.safeParse(entrada);
  if (!p.success) return { ok: false, msg: "Pedido inválido." };
  const { caminhaoId, tipo, motivo, camera, livre } = p.data;
  if (sessao.papel === "MOTORISTA") return { ok: false, msg: "Seu perfil não envia comandos." };
  if (SO_GESTOR.includes(tipo) && sessao.papel === "OPERADOR") return { ok: false, msg: "Só o gestor da frota pode bloquear, desbloquear ou reiniciar." };
  if (tipo === "livre" && sessao.papel !== "ADMIN") return { ok: false, msg: "Comando livre é só para a equipe KM Cero." };
  if (tipo === "bloquear" && !BLOQUEIO_ATIVO) return { ok: false, msg: "O bloqueio do motor está desativado na plataforma." };
  if (tipo === "livre" && !BLOQUEIO_ATIVO && ehTextoDeBloqueio(livre ?? "")) return { ok: false, msg: "O bloqueio do motor está desativado na plataforma." };
  if (tipo === "bloquear" && (motivo ?? "").length < 5) return { ok: false, msg: "Escreva o motivo do bloqueio." };
  if (tipo === "livre" && !livre) return { ok: false, msg: "Escreva o comando." };

  const cam = await db.caminhao.findFirst({
    where: { id: caminhaoId, ...(sessao.papel === "ADMIN" ? {} : { clienteId: cliente.id }) },
    select: { id: true, clienteId: true, placa: true, rastreadorId: true, plano: true, motorBloqueado: true },
  });
  if (!cam) return { ok: false, msg: "Caminhão não encontrado." };
  if (!cam.rastreadorId) return { ok: false, msg: `${cam.placa} ainda não tem rastreador.` };
  if ((tipo === "foto" || tipo === "video") && cam.plano !== "VIDEO") return { ok: false, msg: `${cam.placa} não tem câmera (plano Vídeo).` };
  if (tipo === "bloquear" && cam.motorBloqueado) return { ok: false, msg: `${cam.placa} já está com o motor bloqueado.` };
  if (tipo === "desbloquear" && !cam.motorBloqueado) return { ok: false, msg: `${cam.placa} não está bloqueado.` };

  const aberto = await db.comando.findFirst({ where: { caminhaoId: cam.id, tipo, status: { in: ["pendente", "aguardando", "enviado"] } }, select: { id: true } });
  if (aberto) return { ok: false, msg: `Já existe "${COMANDOS[tipo].rotulo}" na fila para ${cam.placa}.` };
  // Bloqueio e desbloqueio não convivem na fila: o mais novo cancela o outro.
  if (tipo === "bloquear" || tipo === "desbloquear") {
    await db.comando.updateMany({ where: { caminhaoId: cam.id, tipo: tipo === "bloquear" ? "desbloquear" : "bloquear", status: { in: ["pendente", "aguardando"] } }, data: { status: "cancelado" } });
  }

  await db.comando.create({
    data: {
      clienteId: cam.clienteId, caminhaoId: cam.id, tipo, texto: textoComando(tipo, { camera, livre }),
      motivo: motivo || null, criadoPor: sessao.nome,
    },
  });
  revalidatePath("/comandos");
  return { ok: true, msg: `${COMANDOS[tipo].rotulo}: pedido enviado para ${cam.placa}.` };
}

export async function cancelarComando(id: string): Promise<void> {
  const { sessao, cliente } = await clienteAtual();
  if (sessao.papel === "MOTORISTA") return;
  await db.comando.updateMany({
    where: { id, status: { in: ["pendente", "aguardando"] }, ...(sessao.papel === "ADMIN" ? {} : { clienteId: cliente.id }) },
    data: { status: "cancelado" },
  });
  revalidatePath("/comandos");
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual } from "@/lib/acesso";
import type { Sessao } from "@/lib/sessao";

// Caminhão, plano e rastreador só são alterados pela equipe KM Cero, depois da instalação do equipamento.
const soKmCero = (s: Sessao) => s.papel === "ADMIN";
import { db } from "@/lib/db";

const novo = z.object({
  placa: z.string().trim().toUpperCase().min(5).max(10),
  modelo: z.string().trim().min(2),
  plano: z.enum(["BASICO", "GESTAO", "VIDEO"]),
  consumoRefKmL: z.coerce.number().positive().max(10),
  odometroKm: z.coerce.number().int().min(0),
  eixos: z.coerce.number().int().min(2).max(12).default(6),
  motorista: z.string().trim().optional(),
  rastreadorId: z.string().trim().optional(),
  salarioMotorista: z.coerce.number().min(0).default(0),
  seguroMensal: z.coerce.number().min(0).default(0),
  depreciacaoMensal: z.coerce.number().min(0).default(0),
});

export type Resultado = { ok: boolean; msg: string } | null;

export async function criarCaminhao(_: Resultado, form: FormData): Promise<Resultado> {
  const { sessao, cliente } = await clienteAtual();
  if (!soKmCero(sessao)) return { ok: false, msg: "Caminhões novos são cadastrados pela KM Cero, depois da instalação do rastreador." };
  const p = novo.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Confira os campos: placa, modelo, consumo de referência e odômetro são obrigatórios." };
  const { motorista, rastreadorId, ...d } = p.data;
  const existe = await db.caminhao.findUnique({ where: { clienteId_placa: { clienteId: cliente.id, placa: d.placa } } });
  if (existe) return { ok: false, msg: `A placa ${d.placa} já está cadastrada.` };
  const m = motorista ? await db.motorista.create({ data: { clienteId: cliente.id, nome: motorista } }) : null;
  await db.caminhao.create({ data: { ...d, clienteId: cliente.id, motoristaId: m?.id, rastreadorId: rastreadorId || null } });
  revalidatePath("/", "layout");
  return { ok: true, msg: `${d.placa} cadastrado.` };
}

export async function mudarPlano(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!soKmCero(sessao)) return;
  const id = String(form.get("id"));
  const plano = z.enum(["BASICO", "GESTAO", "VIDEO"]).parse(form.get("plano"));
  // updateMany com clienteId garante que ninguém altere caminhão de outra transportadora.
  await db.caminhao.updateMany({ where: { id, clienteId: cliente.id }, data: { plano } });
  revalidatePath("/", "layout");
}

/** IMEI do aparelho no caminhão (15 dígitos, impresso na etiqueta do rastreador). Vazio remove. */
export async function mudarRastreador(_: Resultado, form: FormData): Promise<Resultado> {
  const { sessao, cliente } = await clienteAtual();
  if (!soKmCero(sessao)) return { ok: false, msg: "O rastreador é alterado pela KM Cero." };
  const id = String(form.get("id"));
  const imei = String(form.get("rastreadorId") ?? "").replace(/\s/g, "");
  // "SIM-..." são os rastreadores de demonstração, que continuam aceitos.
  if (imei && !/^\d{15}$/.test(imei) && !imei.startsWith("SIM-")) return { ok: false, msg: "O IMEI tem 15 números (está na etiqueta do aparelho)." };
  if (imei) {
    const outro = await db.caminhao.findFirst({ where: { rastreadorId: imei, NOT: { id } }, select: { placa: true } });
    if (outro) return { ok: false, msg: `Esse IMEI já está no caminhão ${outro.placa}.` };
  }
  await db.caminhao.updateMany({
    where: { id, clienteId: cliente.id },
    data: { rastreadorId: imei || null, ultimaPosicaoEm: null, ultimaLat: null, ultimaLng: null, ultimaVelocidade: null, ultimaIgnicao: null, ultimaDirecao: null },
  });
  revalidatePath("/", "layout");
  return { ok: true, msg: imei ? "Rastreador salvo." : "Rastreador removido." };
}

/** Eixos do conjunto, usados no pedágio previsto. */
export async function mudarEixos(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!soKmCero(sessao)) return;
  const eixos = z.coerce.number().int().min(2).max(12).parse(form.get("eixos"));
  await db.caminhao.updateMany({ where: { id: String(form.get("id")), clienteId: cliente.id }, data: { eixos } });
  revalidatePath("/", "layout");
}

/** Câmeras do plano Vídeo: DualCam (2 câmeras, integrada) ou MDVR de 4 câmeras. */
export async function mudarCamera(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!soKmCero(sessao)) return;
  const camera = z.enum(["dualcam", "mdvr4"]).parse(form.get("camera"));
  await db.caminhao.updateMany({ where: { id: String(form.get("id")), clienteId: cliente.id }, data: { camera } });
  revalidatePath("/", "layout");
}


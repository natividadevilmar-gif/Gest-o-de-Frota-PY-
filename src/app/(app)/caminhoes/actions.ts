"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { db } from "@/lib/db";

const novo = z.object({
  placa: z.string().trim().toUpperCase().min(5).max(10),
  modelo: z.string().trim().min(2),
  plano: z.enum(["BASICO", "GESTAO", "VIDEO"]),
  consumoRefKmL: z.coerce.number().positive().max(10),
  odometroKm: z.coerce.number().int().min(0),
  motorista: z.string().trim().optional(),
  rastreadorId: z.string().trim().optional(),
  salarioMotorista: z.coerce.number().min(0).default(0),
  seguroMensal: z.coerce.number().min(0).default(0),
  depreciacaoMensal: z.coerce.number().min(0).default(0),
});

export type Resultado = { ok: boolean; msg: string } | null;

export async function criarCaminhao(_: Resultado, form: FormData): Promise<Resultado> {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return { ok: false, msg: "Seu perfil não pode cadastrar caminhões." };
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
  if (!podeEditarCadastros(sessao)) return;
  const id = String(form.get("id"));
  const plano = z.enum(["BASICO", "GESTAO", "VIDEO"]).parse(form.get("plano"));
  // updateMany com clienteId garante que ninguém altere caminhão de outra transportadora.
  await db.caminhao.updateMany({ where: { id, clienteId: cliente.id }, data: { plano } });
  revalidatePath("/", "layout");
}

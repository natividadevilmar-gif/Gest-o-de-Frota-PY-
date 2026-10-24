"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { paraUsd, type Moeda } from "@/lib/cambio";
import { cotacaoDoDia } from "@/lib/cotacao";
import { db } from "@/lib/db";
import { num, usd } from "@/lib/formato";

export type Resultado = { ok: boolean; msg: string } | null;

const vazio = (v: unknown) => (v === "" || v === null ? undefined : v);
const texto = (max: number) => z.preprocess(vazio, z.string().trim().max(max).optional());
const dia = z.preprocess(vazio, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional());
const pais = z.string().regex(/^[A-Z]{2}$/);

const frete = z.object({
  caminhaoId: z.string().min(1),
  motoristaId: texto(40),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataEntrega: dia,
  embarcador: z.string().trim().min(2).max(120),
  documento: texto(80),
  paisOrigem: pais,
  origem: z.string().trim().min(2).max(80),
  paisDestino: pais,
  destino: z.string().trim().min(2).max(80),
  carga: z.string().trim().min(2).max(80),
  toneladas: z.coerce.number().positive(),
  cobranca: z.enum(["tonelada", "fechado"]),
  moeda: z.enum(["USD", "PYG", "BRL", "ARS"]),
  precoTonelada: z.preprocess(vazio, z.coerce.number().positive().optional()),
  valor: z.preprocess(vazio, z.coerce.number().positive().optional()),
  kmCarregado: z.coerce.number().positive(),
  kmVazio: z.preprocess((v) => (v === "" ? 0 : v), z.coerce.number().min(0)),
  custosExtras: z.preprocess((v) => (v === "" ? 0 : v), z.coerce.number().min(0)),
  vencimento: dia,
  recebido: z.preprocess((v) => v === "on", z.boolean()),
  observacao: texto(300),
});

const dataUtc = (d?: string) => (d ? new Date(`${d}T00:00:00Z`) : null);

export async function lancarFrete(_: Resultado, form: FormData): Promise<Resultado> {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return { ok: false, msg: "Sem permissão para lançar fretes." };
  const p = frete.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Confira caminhão, cliente, origem, destino, produto, toneladas e km." };
  const f = p.data;
  const valor = f.cobranca === "tonelada" ? (f.precoTonelada ? f.precoTonelada * f.toneladas : undefined) : f.valor;
  if (!valor) return { ok: false, msg: f.cobranca === "tonelada" ? "Informe o preço por tonelada." : "Informe o valor do frete." };
  const cam = await db.caminhao.findFirst({ where: { id: f.caminhaoId, clienteId: cliente.id } });
  if (!cam) return { ok: false, msg: "Caminhão não encontrado." };
  const motorista = f.motoristaId ? await db.motorista.findFirst({ where: { id: f.motoristaId, clienteId: cliente.id } }) : null;

  const cot = await cotacaoDoDia();
  const moeda = f.moeda as Moeda;
  const freteUsd = paraUsd(valor, moeda, cot);
  await db.viagem.create({
    data: {
      caminhaoId: cam.id,
      motoristaId: motorista?.id ?? null,
      data: dataUtc(f.data)!,
      dataEntrega: dataUtc(f.dataEntrega),
      embarcador: f.embarcador,
      documento: f.documento ?? null,
      paisOrigem: f.paisOrigem,
      origem: f.origem,
      paisDestino: f.paisDestino,
      destino: f.destino,
      carga: f.carga,
      toneladas: f.toneladas,
      moeda,
      valorOriginal: moeda === "USD" ? null : valor,
      precoTonelada: f.cobranca === "tonelada" ? f.precoTonelada! : null,
      freteUsd,
      kmCarregado: f.kmCarregado,
      kmVazio: f.kmVazio,
      custosExtrasUsd: f.custosExtras ? paraUsd(f.custosExtras, moeda, cot) : 0,
      vencimento: dataUtc(f.vencimento),
      recebido: f.recebido,
      observacao: f.observacao ?? null,
    },
  });
  revalidatePath("/", "layout");
  return { ok: true, msg: `Frete ${f.origem} → ${f.destino} lançado em ${cam.placa}: ${usd(freteUsd, 2)}${moeda === "USD" ? "" : ` (${num(valor, moeda === "PYG" ? 0 : 2)} ${moeda})`}.` };
}

export async function marcarRecebido(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return;
  const id = String(form.get("id"));
  await db.viagem.updateMany({ where: { id, caminhao: { clienteId: cliente.id } }, data: { recebido: form.get("recebido") === "1" } });
  revalidatePath("/", "layout");
}

export async function excluirFrete(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return;
  await db.viagem.deleteMany({ where: { id: String(form.get("id")), caminhao: { clienteId: cliente.id } } });
  revalidatePath("/", "layout");
}

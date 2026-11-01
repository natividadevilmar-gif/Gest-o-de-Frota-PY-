"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { salvarRota } from "@/lib/monitoramento";
import { z } from "zod";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { paraUsd, type Moeda } from "@/lib/cambio";
import { cotacaoDoDia } from "@/lib/cotacao";
import { db } from "@/lib/db";
import { num, usd } from "@/lib/formato";
import { VALIDADE_DIAS } from "@/lib/rastreio/linkRastreio";

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
  rotaPedagioId: texto(40),
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
  const nova = await db.viagem.create({
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
      rotaPedagioId: f.rotaPedagioId && (await db.rotaPedagio.findUnique({ where: { id: f.rotaPedagioId }, select: { id: true } })) ? f.rotaPedagioId : null,
    },
  });
  // A rota prevista (para o alerta de desvio) é calculada depois de responder, sem segurar a tela.
  after(() => salvarRota(nova.id).catch((e) => console.error("rota do frete:", (e as Error).message)));
  revalidatePath("/", "layout");
  return { ok: true, msg: `Frete ${f.origem} → ${f.destino} lançado em ${cam.placa}: ${usd(freteUsd, 2)}${moeda === "USD" ? "" : ` (${num(valor, 2)} ${moeda})`}.` };
}

export async function marcarRecebido(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return;
  const id = String(form.get("id"));
  const v = await db.viagem.findFirst({ where: { id, caminhao: { clienteId: cliente.id } }, select: { id: true, freteUsd: true, recebimentos: { select: { valorUsd: true } } } });
  if (!v) return;
  const recebido = form.get("recebido") === "1";
  if (recebido) {
    // Quita o que faltava hoje, para entrar em "Recebido no mês" das Contas a receber.
    const falta = Math.round((v.freteUsd - v.recebimentos.reduce((t, r) => t + r.valorUsd, 0)) * 100) / 100;
    const hoje = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
    if (falta > 0) await db.recebimento.create({ data: { viagemId: v.id, data: hoje, valorUsd: falta, observacao: "marcado como recebido", usuarioId: sessao.usuarioId } });
  } else {
    await db.recebimento.deleteMany({ where: { viagemId: v.id } });
  }
  await db.viagem.update({ where: { id: v.id }, data: { recebido } });
  revalidatePath("/", "layout");
}

export async function excluirFrete(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return;
  await db.viagem.deleteMany({ where: { id: String(form.get("id")), caminhao: { clienteId: cliente.id } } });
  revalidatePath("/", "layout");
}

/** Refaz a rota prevista de um frete (por exemplo, depois de a cidade não ter sido achada). */
export async function recalcularRota(form: FormData) {
  const { cliente } = await clienteAtual();
  const id = String(form.get("id") ?? "");
  if (!(await db.viagem.findFirst({ where: { id, caminhao: { clienteId: cliente.id } }, select: { id: true } }))) return;
  await salvarRota(id);
  revalidatePath("/fretes");
}

/**
 * Gera (ou renova) o link público do frete para quem vai receber a carga acompanhar o caminhão.
 * Devolve o endereço relativo (/r/...); a tela monta o endereço completo com o domínio.
 */
export async function gerarLinkRastreio(id: string): Promise<{ caminho: string; expira: string } | null> {
  const { sessao, cliente } = await clienteAtual();
  if (sessao.papel === "MOTORISTA") return null;
  const v = await db.viagem.findFirst({ where: { id, caminhao: { clienteId: cliente.id } }, select: { id: true, linkToken: true } });
  if (!v) return null;
  const token = v.linkToken ?? randomBytes(18).toString("base64url");
  const expira = new Date(Date.now() + VALIDADE_DIAS * 86400_000);
  await db.viagem.update({ where: { id: v.id }, data: { linkToken: token, linkExpiraEm: expira } });
  revalidatePath("/fretes");
  return { caminho: `/r/${token}`, expira: expira.toISOString() };
}

/** Desliga o link: quem tiver o endereço passa a ver "link encerrado". */
export async function encerrarLinkRastreio(id: string) {
  const { sessao, cliente } = await clienteAtual();
  if (sessao.papel === "MOTORISTA") return;
  await db.viagem.updateMany({ where: { id, caminhao: { clienteId: cliente.id } }, data: { linkToken: null, linkExpiraEm: null } });
  revalidatePath("/fretes");
}

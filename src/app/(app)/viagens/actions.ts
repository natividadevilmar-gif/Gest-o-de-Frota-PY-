"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual, exigirAdmin } from "@/lib/acesso";
import { db } from "@/lib/db";
import { pracasNaRota } from "@/lib/pedagio";
import { calcularRota, paisesNaRota } from "@/lib/rastreio/rotaFrete";

const cidades = z.object({
  origem: z.string().trim().min(2).max(80),
  paisOrigem: z.string().regex(/^[A-Z]{2}$/),
  destino: z.string().trim().min(2).max(80),
  paisDestino: z.string().regex(/^[A-Z]{2}$/),
});

/** Km de estrada entre duas cidades (OpenStreetMap), as praças de pedágio e os países desse caminho, para o simulador. */
export async function kmEntreCidades(c: z.infer<typeof cidades>): Promise<{ km: number; pracas: string[]; paises: string[] } | { erro: string }> {
  await clienteAtual();
  const p = cidades.safeParse(c);
  if (!p.success) return { erro: "Informe a cidade de origem e a de destino." };
  const r = await calcularRota(p.data);
  if ("erro" in r) return r;
  const pracas = await db.pracaPedagio.findMany({ select: { id: true, lat: true, lng: true } });
  const paises = await paisesNaRota(r.rota);
  // Origem e destino sempre entram, mesmo se o Nominatim não respondeu.
  const todos = [...new Set([p.data.paisOrigem, ...paises, p.data.paisDestino])];
  return { km: r.km, pracas: pracasNaRota(r.rota, pracas), paises: todos };
}

const rota = cidades.extend({
  km: z.coerce.number().int().positive(),
  pracas: z.array(z.string()).max(60),
  paises: z.array(z.string().regex(/^[A-Z]{2}$/)).max(10),
});

/** Guarda a rota para escolher de novo no simulador. */
export async function salvarRota(r: z.infer<typeof rota>): Promise<{ ok: boolean; msg: string; id?: string }> {
  const { sessao, cliente } = await clienteAtual();
  if (sessao.papel === "MOTORISTA") return { ok: false, msg: "Sem permissão." };
  const p = rota.safeParse(r);
  if (!p.success) return { ok: false, msg: "Informe origem, destino e km de ida." };
  const nova = await db.rotaFrete.create({ data: { ...p.data, clienteId: cliente.id } });
  revalidatePath("/viagens");
  return { ok: true, msg: `Rota ${p.data.origem} → ${p.data.destino} salva.`, id: nova.id };
}

export async function excluirRota(id: string) {
  const { sessao, cliente } = await clienteAtual();
  if (sessao.papel === "MOTORISTA") return;
  await db.rotaFrete.deleteMany({ where: { id, clienteId: cliente.id } });
  revalidatePath("/viagens");
}

const precoDiesel = z.object({
  pais: z.string().regex(/^[A-Z]{2}$/),
  valor: z.coerce.number().positive(),
  fonte: z.string().trim().min(3).max(200),
  vigencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Só a KM Cero corrige o preço do diesel: vale para todos os clientes. */
export async function atualizarPrecoDiesel(form: FormData) {
  await exigirAdmin();
  const p = precoDiesel.parse(Object.fromEntries(form));
  await db.precoDiesel.update({ where: { pais: p.pais }, data: { valor: p.valor, fonte: p.fonte, vigencia: new Date(`${p.vigencia}T00:00:00Z`) } });
  revalidatePath("/viagens");
}

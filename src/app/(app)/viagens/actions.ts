"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual, exigirAdmin } from "@/lib/acesso";
import { db } from "@/lib/db";
import { pracasNaRota } from "@/lib/pedagio";
import { cabinesNaRota, casarComCadastro, posicaoNaRota } from "@/lib/rastreio/pedagiosOsm";
import { calcularRota, paisDoPonto, paisesNaRota, type PontoRota } from "@/lib/rastreio/rotaFrete";

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
  const [pracas, paises] = await Promise.all([pracasDaRota(r.rota), paisesNaRota(r.rota)]);
  // Origem e destino sempre entram, mesmo se o Nominatim não respondeu.
  const todos = [...new Set([p.data.paisOrigem, ...paises, p.data.paisDestino])];
  return { km: r.km, pracas, paises: todos };
}

function maisPerto<T extends { lat: number; lng: number }>(p: { lat: number; lng: number }, lista: T[]): T | undefined {
  return lista.reduce<T | undefined>((m, x) => (!m || Math.hypot(x.lat - p.lat, x.lng - p.lng) < Math.hypot(m.lat - p.lat, m.lng - p.lng) ? x : m), undefined);
}

const MOEDA_PAIS: Record<string, string> = { PY: "PYG", BR: "BRL", AR: "ARS", UY: "UYU" };

/**
 * Todas as praças do caminho: as cabines do OpenStreetMap ligadas ao cadastro (a do cadastro tem a
 * tarifa e ganha a posição certa) e as que faltam no cadastro entram sem tarifa, para completar em
 * Pedágios. Junta as do cadastro a até 5 km da linha, caso o mapa não tenha alguma ou não responda.
 */
async function pracasDaRota(rota: PontoRota[]): Promise<string[]> {
  const cadastro = await db.pracaPedagio.findMany({ select: { id: true, lat: true, lng: true, pais: true } });
  const achadas = await cabinesNaRota(rota);
  const ids = new Map<string, { lat: number; lng: number }>();
  if (achadas) {
    const { ligadas, novas } = casarComCadastro(achadas, cadastro);
    for (const { id, cabine } of ligadas) {
      ids.set(id, cabine);
      const antes = cadastro.find((c) => c.id === id)!;
      if (Math.abs(antes.lat - cabine.lat) + Math.abs(antes.lng - cabine.lng) > 0.005) {
        await db.pracaPedagio.update({ where: { id }, data: { lat: cabine.lat, lng: cabine.lng } });
      }
    }
    for (const c of novas) {
      const id = `osm-${c.lat.toFixed(4)}-${c.lng.toFixed(4)}`;
      // Sem resposta do Nominatim, vale o país da praça do cadastro mais perto.
      const pais = (await paisDoPonto(c.lat, c.lng)) ?? maisPerto(c, cadastro)?.pais ?? "BR";
      await db.pracaPedagio.upsert({
        where: { id },
        update: {},
        create: {
          id, pais, lat: c.lat, lng: c.lng,
          nome: c.nome ?? "Praça de pedágio (OpenStreetMap)",
          rodovia: c.rodovia ?? "—",
          moeda: MOEDA_PAIS[pais] ?? "USD",
          fonte: "Achada no OpenStreetMap; tarifa a cadastrar",
          vigencia: new Date(new Date().toISOString().slice(0, 10)),
        },
      });
      ids.set(id, c);
    }
    if (novas.length) revalidatePath("/viagens");
  }
  for (const id of pracasNaRota(rota, cadastro)) if (!ids.has(id)) ids.set(id, cadastro.find((c) => c.id === id)!);
  return [...ids].sort((a, b) => posicaoNaRota(a[1], rota) - posicaoNaRota(b[1], rota)).map(([id]) => id);
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

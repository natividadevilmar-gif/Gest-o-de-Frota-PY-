"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { db } from "@/lib/db";

export type Resultado = { ok: boolean; msg: string } | null;

const servico = z.object({
  itemId: z.string().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  custoUsd: z.coerce.number().min(0),
  odometroKm: z.coerce.number().int().min(0),
  proximoVencimento: z.string().optional(),
});

/** Registra um serviço feito: zera o intervalo do item e lança o custo como manutenção. */
export async function registrarServico(_: Resultado, form: FormData): Promise<Resultado> {
  const { cliente } = await clienteAtual();
  const p = servico.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Confira data, odômetro e custo." };
  const item = await db.itemRevisao.findFirst({ where: { id: p.data.itemId, caminhao: { clienteId: cliente.id } }, include: { caminhao: true } });
  if (!item) return { ok: false, msg: "Item não encontrado." };
  const data = new Date(`${p.data.data}T00:00:00Z`);
  const prox = p.data.proximoVencimento && /^\d{4}-\d{2}-\d{2}$/.test(p.data.proximoVencimento) ? new Date(`${p.data.proximoVencimento}T00:00:00Z`) : null;
  if (item.gatilho === "DATA" && !prox) return { ok: false, msg: "Informe o novo vencimento." };

  await db.$transaction([
    db.servicoRevisao.create({ data: { itemId: item.id, data, odometroKm: p.data.odometroKm, custoUsd: p.data.custoUsd } }),
    db.itemRevisao.update({
      where: { id: item.id },
      data: item.gatilho === "KM" ? { ultimoKm: p.data.odometroKm } : item.gatilho === "DATA" ? { vencimento: prox } : { resolvido: true },
    }),
    // Serviço num item da demonstração não entra nas despesas reais do cliente.
    ...(p.data.custoUsd > 0 && !item.demo
      ? [db.despesa.create({ data: { caminhaoId: item.caminhaoId, data, categoria: "MANUTENCAO", valorUsd: p.data.custoUsd, descricao: item.nome } })]
      : []),
  ]);
  revalidatePath("/", "layout");
  return { ok: true, msg: `${item.nome} registrado em ${item.caminhao.placa}.` };
}

const novoItem = z.object({
  caminhaoId: z.string().min(1),
  nome: z.string().trim().min(2),
  gatilho: z.enum(["KM", "DATA"]),
  intervaloKm: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().positive().optional()),
  ultimoKm: z.preprocess((v) => (v === "" ? undefined : v), z.coerce.number().int().min(0).optional()),
  vencimento: z.string().optional(),
});

export async function criarItem(_: Resultado, form: FormData): Promise<Resultado> {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return { ok: false, msg: "Seu perfil não pode alterar o plano de revisões." };
  const p = novoItem.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Confira os campos." };
  const cam = await db.caminhao.findFirst({ where: { id: p.data.caminhaoId, clienteId: cliente.id } });
  if (!cam) return { ok: false, msg: "Caminhão não encontrado." };
  if (p.data.gatilho === "KM" && !p.data.intervaloKm) return { ok: false, msg: "Informe o intervalo em km." };
  if (p.data.gatilho === "DATA" && !p.data.vencimento) return { ok: false, msg: "Informe o vencimento." };
  await db.itemRevisao.create({
    data:
      p.data.gatilho === "KM"
        ? { caminhaoId: cam.id, nome: p.data.nome, gatilho: "KM", intervaloKm: p.data.intervaloKm, ultimoKm: p.data.ultimoKm ?? cam.odometroKm }
        : { caminhaoId: cam.id, nome: p.data.nome, gatilho: "DATA", vencimento: new Date(`${p.data.vencimento}T00:00:00Z`) },
  });
  revalidatePath("/", "layout");
  return { ok: true, msg: `${p.data.nome} adicionado ao plano de ${cam.placa}.` };
}

const DIA_MS = 86_400_000;

/** Itens do plano de demonstração: intervalos comuns de caminhão pesado e documentos com vencimento anual. */
const ITENS_DEMO = [
  { nome: "Troca de óleo do motor e filtro", intervaloKm: 20_000 },
  { nome: "Filtros de ar e de combustível", intervaloKm: 40_000 },
  { nome: "Freios: lonas e tambores", intervaloKm: 60_000 },
] as const;
// Quanto do intervalo cada caminhão já rodou, para a demonstração ter itens vencidos, próximos e em dia.
const USO_DEMO = [1.06, 0.96, 0.72, 0.45, 0.2, 0.88, 0.6, 0.33];
const DIAS_DEMO = [-6, 9, 140, 45, 260, 12, 75, 190];

/** Admin: monta um plano de revisões de demonstração com os odômetros reais dos caminhões do cliente. */
export async function montarDemonstracao() {
  const { sessao, cliente } = await clienteAtual();
  if (sessao.papel !== "ADMIN") return;
  const caminhoes = await db.caminhao.findMany({ where: { clienteId: cliente.id, baseCombustivel: false }, orderBy: { placa: "asc" } });
  const hoje = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  const itens = caminhoes.flatMap((c, i) => [
    ...ITENS_DEMO.map((d, j) => ({
      caminhaoId: c.id,
      nome: d.nome,
      gatilho: "KM" as const,
      intervaloKm: d.intervaloKm,
      ultimoKm: Math.max(0, Math.round(c.odometroKm - USO_DEMO[(i + j * 3) % USO_DEMO.length] * d.intervaloKm)),
      demo: true,
    })),
    { caminhaoId: c.id, nome: "Habilitação DINATRAN", gatilho: "DATA" as const, vencimento: new Date(hoje + DIAS_DEMO[i % DIAS_DEMO.length] * DIA_MS), demo: true },
  ]);
  await db.$transaction([
    db.itemRevisao.deleteMany({ where: { demo: true, caminhao: { clienteId: cliente.id } } }),
    db.itemRevisao.createMany({ data: itens }),
  ]);
  revalidatePath("/", "layout");
}

/** Admin: apaga os itens da demonstração; os itens cadastrados pelo cliente ficam. */
export async function removerDemonstracao() {
  const { sessao, cliente } = await clienteAtual();
  if (sessao.papel !== "ADMIN") return;
  await db.itemRevisao.deleteMany({ where: { demo: true, caminhao: { clienteId: cliente.id } } });
  revalidatePath("/", "layout");
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { paraUsd, taxa, type Moeda } from "@/lib/cambio";
import { cotacaoDoDia } from "@/lib/cotacao";
import { db } from "@/lib/db";
import { num, usd } from "@/lib/formato";
import { lerDespesa, leitorConfigurado, type DespesaLida } from "@/lib/leitorDespesa";

const vazioEhIndefinido = (v: unknown) => (v === "" || v === null ? undefined : v);
const numeroOpcional = z.preprocess(vazioEhIndefinido, z.coerce.number().positive().optional());

const despesa = z.object({
  caminhaoId: z.string().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoria: z.enum(["DIESEL", "ARLA32", "ALIMENTACAO", "PEDAGIO", "MANUTENCAO", "PNEUS", "OUTROS"]),
  moeda: z.enum(["USD", "PYG", "BRL"]),
  valor: z.coerce.number().positive(),
  litros: numeroOpcional,
  precoLitro: numeroOpcional,
  posto: z.preprocess(vazioEhIndefinido, z.string().trim().max(120).optional()),
  odometroKm: z.preprocess(vazioEhIndefinido, z.coerce.number().int().min(0).optional()),
  tanqueCheio: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  descricao: z.preprocess(vazioEhIndefinido, z.string().trim().max(200).optional()),
  origem: z.enum(["manual", "foto", "audio"]).default("manual"),
  recibo: z.preprocess(vazioEhIndefinido, z.string().max(3_000_000).optional()),
});

export type Resultado = { ok: boolean; msg: string } | null;

const COMBUSTIVEL = new Set(["DIESEL", "ARLA32"]);

export async function lancarDespesa(_: Resultado, form: FormData): Promise<Resultado> {
  const { cliente } = await clienteAtual();
  const p = despesa.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Confira caminhão, data, tipo e valor." };
  const d = p.data;
  const combustivel = COMBUSTIVEL.has(d.categoria);
  if (d.categoria === "DIESEL" && !d.litros) return { ok: false, msg: "Para diesel, informe os litros abastecidos." };
  const cam = await db.caminhao.findFirst({ where: { id: d.caminhaoId, clienteId: cliente.id } });
  if (!cam) return { ok: false, msg: "Caminhão não encontrado." };

  const cot = await cotacaoDoDia();
  const valorUsd = paraUsd(d.valor, d.moeda as Moeda, cot);
  const recibo = d.recibo ? Buffer.from(d.recibo.replace(/^data:image\/\w+;base64,/, ""), "base64") : null;

  await db.despesa.create({
    data: {
      caminhaoId: cam.id,
      data: new Date(`${d.data}T00:00:00Z`),
      categoria: d.categoria,
      valorUsd,
      moeda: d.moeda,
      valorOriginal: d.moeda === "USD" ? null : d.valor,
      cotacao: taxa(d.moeda as Moeda, cot),
      litros: combustivel ? (d.litros ?? null) : null,
      precoLitro: combustivel ? (d.precoLitro ?? null) : null,
      posto: d.posto ?? null,
      odometroKm: d.odometroKm ?? null,
      tanqueCheio: combustivel && d.tanqueCheio,
      descricao: d.descricao ?? null,
      origem: d.origem,
      recibo,
      reciboTipo: recibo ? "image/jpeg" : null,
    },
  });
  revalidatePath("/", "layout");
  const conv = d.moeda === "USD" ? "" : ` (${num(d.valor, d.moeda === "PYG" ? 0 : 2)} ${d.moeda} a ${num(taxa(d.moeda as Moeda, cot), 2)})`;
  return { ok: true, msg: `${usd(valorUsd, 2)}${conv} lançado em ${cam.placa}${d.litros ? `, ${num(d.litros, 1)} litros` : ""}.` };
}

export async function excluirDespesa(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return;
  await db.despesa.deleteMany({ where: { id: String(form.get("id")), caminhao: { clienteId: cliente.id } } });
  revalidatePath("/", "layout");
}

export type Leitura = { ok: true; campos: DespesaLida; caminhaoId: string | null } | { ok: false; msg: string };

const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** Lê a foto do recibo ou a frase falada e devolve os campos para o usuário conferir. */
export async function lerDespesaAction(entrada: { imagem?: string; texto?: string }): Promise<Leitura> {
  const { cliente } = await clienteAtual();
  if (!leitorConfigurado()) return { ok: false, msg: "A leitura automática ainda não está ativada neste servidor. Preencha os campos à mão." };

  let imagem: { base64: string; tipo: (typeof TIPOS_IMAGEM)[number] } | undefined;
  if (entrada.imagem) {
    const m = /^data:(image\/\w+);base64,(.+)$/.exec(entrada.imagem);
    const tipo = TIPOS_IMAGEM.find((t) => t === m?.[1]);
    if (!m || !tipo || m[2].length > 3_000_000) return { ok: false, msg: "Não consegui abrir a foto. Tente outra vez." };
    imagem = { base64: m[2], tipo };
  }
  const texto = entrada.texto?.trim().slice(0, 500);
  if (!imagem && !texto) return { ok: false, msg: "Tire uma foto ou fale a despesa." };

  try {
    const campos = await lerDespesa({ imagem, texto }, { hoje: new Date().toISOString().slice(0, 10) });
    let caminhaoId: string | null = null;
    if (campos.placa) {
      const alvo = campos.placa.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      const lista = await db.caminhao.findMany({ where: { clienteId: cliente.id }, select: { id: true, placa: true } });
      caminhaoId = lista.find((c) => c.placa.replace(/[^A-Z0-9]/gi, "").toUpperCase() === alvo)?.id ?? null;
    }
    return { ok: true, campos, caminhaoId };
  } catch (e) {
    console.error("leitura de despesa", e);
    return { ok: false, msg: "Não consegui ler agora. Confira a foto ou preencha à mão." };
  }
}

"use server";

import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteAtual, podeEditarCadastros } from "@/lib/acesso";
import { db } from "@/lib/db";
import { lerPlanilhaFrota, placaChave, type LinhaFrota } from "@/lib/importarFrota";
import { IDIOMAS } from "@/lib/i18n/idiomas";
import { normalizarLogin } from "@/lib/login";

export type Resultado = { ok: boolean; msg: string } | null;

const acesso = z.object({
  motoristaId: z.string(),
  nome: z.string().trim().max(80).optional(),
  caminhaoId: z.string().optional(),
  celular: z.string().transform(normalizarLogin).pipe(z.string().regex(/^\d{8,15}$/)),
  pin: z.string().regex(/^\d{6,8}$/),
  idioma: z.enum(IDIOMAS),
  ddi: z.enum(["595", "55", "54", "598", "591", "56"]),
});

/** Cria o acesso de um motorista (e o motorista, se for novo) com celular e PIN. */
export async function criarAcesso(_: Resultado, form: FormData): Promise<Resultado> {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return { ok: false, msg: "Só o gestor cria acessos." };
  const p = acesso.safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, msg: "Confira: celular só com números (com DDD) e PIN de 6 a 8 dígitos." };
  const d = p.data;
  const dono = await db.usuario.findUnique({ where: { email: d.celular } });
  if (dono) {
    const onde = dono.clienteId === cliente.id ? dono.nome : `um motorista de outra transportadora`;
    return { ok: false, msg: `O celular ${d.celular} já é o login de ${onde}. Cada motorista precisa de um celular diferente.` };
  }

  let motoristaId = d.motoristaId;
  if (motoristaId === "novo") {
    if (!d.nome || d.nome.length < 2) return { ok: false, msg: "Informe o nome do motorista." };
    motoristaId = (await db.motorista.create({ data: { clienteId: cliente.id, nome: d.nome } })).id;
  }
  const mot = await db.motorista.findFirst({ where: { id: motoristaId, clienteId: cliente.id }, include: { acesso: true } });
  if (!mot) return { ok: false, msg: "Motorista não encontrado." };
  if (mot.acesso) return { ok: false, msg: `${mot.nome} já tem acesso, com o celular ${mot.acesso.email}. Para mudar, use Remover acesso na lista abaixo e crie de novo.` };
  await db.motorista.update({ where: { id: mot.id }, data: { ddi: d.ddi } });
  if (d.caminhaoId) await db.caminhao.updateMany({ where: { id: d.caminhaoId, clienteId: cliente.id }, data: { motoristaId: mot.id } });

  await db.usuario.create({
    data: { email: d.celular, nome: mot.nome, senhaHash: await bcrypt.hash(d.pin, 10), papel: "MOTORISTA", clienteId: cliente.id, motoristaId: mot.id, idioma: d.idioma },
  });
  revalidatePath("/motoristas");
  return { ok: true, msg: `Acesso criado. ${mot.nome} entra com o celular ${d.celular} e o PIN informado.` };
}

/** Troca o caminhão do motorista. Sem caminhão, ele escolhe qualquer um da frota ao lançar despesa. */
export async function trocarCaminhao(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return;
  const motoristaId = String(form.get("motoristaId"));
  const caminhaoId = String(form.get("caminhaoId") ?? "");
  const mot = await db.motorista.findFirst({ where: { id: motoristaId, clienteId: cliente.id }, select: { id: true } });
  if (!mot) return;
  await db.caminhao.updateMany({ where: { clienteId: cliente.id, motoristaId: mot.id }, data: { motoristaId: null } });
  if (caminhaoId) await db.caminhao.updateMany({ where: { id: caminhaoId, clienteId: cliente.id }, data: { motoristaId: mot.id } });
  revalidatePath("/motoristas");
}

export async function novoPin(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return;
  const pin = z.string().regex(/^\d{6,8}$/).safeParse(form.get("pin"));
  if (!pin.success) return;
  await db.usuario.updateMany({
    where: { id: String(form.get("id")), clienteId: cliente.id, papel: "MOTORISTA" },
    data: { senhaHash: await bcrypt.hash(pin.data, 10) },
  });
  revalidatePath("/motoristas");
}

export async function removerAcesso(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return;
  await db.usuario.deleteMany({ where: { id: String(form.get("id")), clienteId: cliente.id, papel: "MOTORISTA" } });
  revalidatePath("/motoristas");
}

export async function mudarIdioma(form: FormData) {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return;
  const idioma = z.enum(IDIOMAS).safeParse(form.get("idioma"));
  if (!idioma.success) return;
  await db.usuario.updateMany({ where: { id: String(form.get("id")), clienteId: cliente.id, papel: "MOTORISTA" }, data: { idioma: idioma.data } });
  revalidatePath("/motoristas");
}

/** Valor de uma célula do Excel como texto ou número (fórmulas, links e textos formatados). */
function valorCelula(v: ExcelJS.CellValue): unknown {
  if (v == null || typeof v !== "object" || v instanceof Date) return v;
  if ("richText" in v) return v.richText.map((t) => t.text).join("");
  if ("result" in v) return v.result;
  if ("text" in v) return v.text;
  return null;
}

/**
 * Cadastra os motoristas a partir da planilha da frota (coluna Chofer/Condutor/Motorista) e liga
 * cada um ao caminhão da mesma linha. Quem já está cadastrado (mesmo C.I. ou mesmo nome) não se repete.
 */
export async function importarMotoristas(_: Resultado, form: FormData): Promise<Resultado> {
  const { sessao, cliente } = await clienteAtual();
  if (!podeEditarCadastros(sessao)) return { ok: false, msg: "Só o gestor importa motoristas." };
  const arq = form.get("planilha");
  if (!(arq instanceof File) || !arq.size) return { ok: false, msg: "Escolha a planilha (.xlsx)." };
  if (arq.size > 3_900_000) return { ok: false, msg: "A planilha passa de 4 MB." };

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await arq.arrayBuffer());
  } catch {
    return { ok: false, msg: "Não consegui abrir o arquivo. Salve a planilha como .xlsx e tente de novo." };
  }
  let linhas: LinhaFrota[] | null = null;
  for (const ws of wb.worksheets) {
    const dados: unknown[][] = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      dados.push((r.values as ExcelJS.CellValue[]).slice(1).map(valorCelula));
    });
    linhas = lerPlanilhaFrota(dados);
    if (linhas) break;
  }
  if (!linhas) return { ok: false, msg: "Não achei as colunas de placa (Chapa/Placa) e de motorista (Chofer/Condutor/Motorista)." };
  if (!linhas.length) return { ok: false, msg: "A planilha não tem nenhum motorista preenchido." };

  const [existentes, caminhoes] = await Promise.all([
    db.motorista.findMany({ where: { clienteId: cliente.id }, select: { id: true, nome: true, documento: true } }),
    db.caminhao.findMany({ where: { clienteId: cliente.id }, select: { id: true, placa: true } }),
  ]);
  const porPlaca = new Map(caminhoes.map((c) => [placaChave(c.placa), c.id]));
  const chaveNome = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  let criados = 0, jaExistiam = 0, ligados = 0;
  const semCaminhao: string[] = [];
  for (const l of linhas) {
    let m = existentes.find((x) => (l.documento && x.documento === l.documento) || chaveNome(x.nome) === chaveNome(l.nome));
    if (m) {
      jaExistiam++;
      if (l.documento && !m.documento) await db.motorista.update({ where: { id: m.id }, data: { documento: l.documento } });
    } else {
      m = await db.motorista.create({ data: { clienteId: cliente.id, nome: l.nome, documento: l.documento }, select: { id: true, nome: true, documento: true } });
      existentes.push(m);
      criados++;
    }
    const caminhaoId = porPlaca.get(placaChave(l.placa));
    if (caminhaoId) {
      await db.caminhao.update({ where: { id: caminhaoId }, data: { motoristaId: m.id } });
      ligados++;
    } else semCaminhao.push(l.placa);
  }
  revalidatePath("/motoristas");
  revalidatePath("/caminhoes");
  const partes = [
    `${criados} motorista${criados === 1 ? "" : "s"} cadastrado${criados === 1 ? "" : "s"}`,
    jaExistiam ? `${jaExistiam} já estava${jaExistiam === 1 ? "" : "m"} cadastrado${jaExistiam === 1 ? "" : "s"}` : "",
    `${ligados} ligado${ligados === 1 ? "" : "s"} ao caminhão da planilha`,
  ].filter(Boolean);
  const aviso = semCaminhao.length ? ` Placas que não estão em Caminhões e planos (motorista cadastrado sem caminhão): ${semCaminhao.join(", ")}.` : "";
  return { ok: true, msg: `${partes.join(", ")}.${aviso}` };
}

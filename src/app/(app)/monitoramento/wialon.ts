"use server";

import { revalidatePath } from "next/cache";
import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";
import { apiDoCliente, imeisPelaPlaca, SERVIDORES_WIALON, Wialon } from "@/lib/rastreio/wialon";

// Conta Wialon do cliente, ligada pela equipe KM Cero na central de monitoramento.
export type Resultado = { ok: boolean; msg: string } | null;

async function soAdmin() {
  const { sessao, cliente } = await clienteAtual();
  return sessao.papel === "ADMIN" ? cliente : null;
}

/** Guarda o token colado, depois de conferir no Wialon que ele funciona. */
export async function conectarWialon(_: Resultado, form: FormData): Promise<Resultado> {
  const cliente = await soAdmin();
  if (!cliente) return { ok: false, msg: "Só a equipe KM Cero liga o Wialon." };
  // Aceita o token puro ou o endereço inteiro copiado do navegador (…access_token=XXXX&…).
  const colado = String(form.get("token") ?? "").trim();
  const token = (colado.match(/access_token=([^&\s]+)/)?.[1] ?? colado).trim();
  const host = String(form.get("host") ?? "");
  if (!SERVIDORES_WIALON.some((s) => s.host === host)) return { ok: false, msg: "Escolha o endereço do Wialon." };
  if (token.length < 20) return { ok: false, msg: "Cole o token inteiro (o código longo depois de access_token=)." };
  const api = new Wialon(token, host);
  let n;
  try {
    n = (await api.unidades()).length;
  } catch (e) {
    return { ok: false, msg: (e as Error).message };
  } finally {
    await api.sair();
  }
  await db.cliente.update({ where: { id: cliente.id }, data: { wialonToken: token, wialonHost: host } });
  revalidatePath("/", "layout");
  return { ok: true, msg: `Conectado: ${n} unidades no Wialon. Agora clique em Ligar os caminhões.` };
}

export async function desconectarWialon() {
  const cliente = await soAdmin();
  if (!cliente) return;
  await db.cliente.update({ where: { id: cliente.id }, data: { wialonToken: null, wialonHost: null } });
  revalidatePath("/", "layout");
}

/** Preenche o IMEI dos caminhões pela unidade do Wialon com o nome da placa. */
export async function ligarCaminhoesWialon(_: Resultado): Promise<Resultado> {
  const cliente = await soAdmin();
  if (!cliente) return { ok: false, msg: "Só a equipe KM Cero liga o Wialon." };
  const api = apiDoCliente(cliente);
  if (!api) return { ok: false, msg: "Conecte o Wialon primeiro." };
  let unidades;
  try {
    unidades = await api.unidades();
  } catch (e) {
    return { ok: false, msg: (e as Error).message };
  }
  const caminhoes = await db.caminhao.findMany({ where: { clienteId: cliente.id }, select: { id: true, placa: true, rastreadorId: true } });
  const ligados: string[] = [], semUnidade: string[] = [];
  for (const { caminhao: c, unidade: u } of imeisPelaPlaca(caminhoes, unidades)) {
    if (!u) { semUnidade.push(c.placa); continue; }
    if (c.rastreadorId === u.uid) { ligados.push(c.placa); continue; }
    const outro = await db.caminhao.findFirst({ where: { rastreadorId: u.uid, NOT: { id: c.id } }, select: { placa: true } });
    if (outro) { semUnidade.push(`${c.placa} (IMEI já está no ${outro.placa})`); continue; }
    await db.caminhao.update({
      where: { id: c.id },
      data: { rastreadorId: u.uid, ultimaPosicaoEm: null, ultimaLat: null, ultimaLng: null, ultimaVelocidade: null, ultimaIgnicao: null },
    });
    ligados.push(c.placa);
  }
  revalidatePath("/", "layout");
  const msg = `${unidades.length} unidades no Wialon. Ligados: ${ligados.length ? ligados.join(", ") : "nenhum"}.` +
    (semUnidade.length ? ` Sem unidade com essa placa no Wialon: ${semUnidade.join(", ")} (cole o IMEI em Caminhões e planos).` : "");
  return { ok: ligados.length > 0, msg };
}

"use server";

import { revalidatePath } from "next/cache";
import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";
import { diaNoParaguai } from "@/lib/rastreio/rotas";
import { apiDoCliente, historicoWialon, imeisPelaPlaca, SERVIDORES_WIALON, telemetriaDaMensagem, Wialon, type TelemetriaUnidade } from "@/lib/rastreio/wialon";

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
      data: { rastreadorId: u.uid, ultimaPosicaoEm: null, ultimaLat: null, ultimaLng: null, ultimaVelocidade: null, ultimaIgnicao: null, ultimaDirecao: null },
    });
    ligados.push(c.placa);
  }
  revalidatePath("/", "layout");
  const msg = `${unidades.length} unidades no Wialon. Ligados: ${ligados.length ? ligados.join(", ") : "nenhum"}.` +
    (semUnidade.length ? ` Sem unidade com essa placa no Wialon: ${semUnidade.join(", ")} (cole o IMEI em Caminhões e planos).` : "");
  return { ok: ligados.length > 0, msg };
}

export type ListaUnidades = { ok: boolean; msg: string; unidades: { nome: string; imei: string | null; placa: string | null; ultima: string | null; telemetria: TelemetriaUnidade }[] } | null;

/** Unidades da conta Wialon, com o caminhão da plataforma ligado a cada uma. */
export async function listarUnidadesWialon(_: ListaUnidades): Promise<ListaUnidades> {
  const cliente = await soAdmin();
  if (!cliente) return { ok: false, msg: "Só a equipe KM Cero liga o Wialon.", unidades: [] };
  const api = apiDoCliente(cliente);
  if (!api) return { ok: false, msg: "Conecte o Wialon primeiro.", unidades: [] };
  try {
    const [unidades, caminhoes] = await Promise.all([
      api.unidades(),
      db.caminhao.findMany({ where: { clienteId: cliente.id, rastreadorId: { not: null } }, select: { placa: true, rastreadorId: true } }),
    ]);
    const porImei = new Map(caminhoes.map((c) => [c.rastreadorId!, c.placa]));
    return {
      ok: true,
      msg: `${unidades.length} unidades no Wialon`,
      unidades: unidades.map((u) => ({
        nome: u.nm,
        imei: u.uid ?? null,
        placa: (u.uid && porImei.get(u.uid)) || null,
        ultima: u.lmsg ? new Date(u.lmsg.t * 1000).toISOString() : null,
        telemetria: telemetriaDaMensagem(u.lmsg, u),
      })),
    };
  } catch (e) {
    return { ok: false, msg: (e as Error).message, unidades: [] };
  }
}

/**
 * Cadastra como caminhão cada unidade do Wialon que ainda não está na plataforma
 * (pelo IMEI). A placa é o nome da unidade; modelo e consumo de referência ficam para
 * completar em Caminhões e planos.
 */
export async function importarUnidadesWialon(_: Resultado): Promise<Resultado> {
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
  const [comImei, placas] = await Promise.all([
    db.caminhao.findMany({ where: { rastreadorId: { not: null } }, select: { rastreadorId: true } }),
    db.caminhao.findMany({ where: { clienteId: cliente.id }, select: { placa: true } }),
  ]);
  const imeis = new Set(comImei.map((c) => c.rastreadorId));
  const usadas = new Set(placas.map((c) => c.placa.toUpperCase()));
  const novos: string[] = [], pulados: string[] = [];
  for (const u of unidades) {
    if (!u.uid || !/^\d{15}$/.test(u.uid)) { pulados.push(`${u.nm} (sem IMEI)`); continue; }
    if (imeis.has(u.uid)) continue;
    let placa = u.nm.trim().toUpperCase().slice(0, 30) || u.uid;
    if (usadas.has(placa)) placa = `${placa} (${u.uid.slice(-4)})`;
    await db.caminhao.create({
      data: { clienteId: cliente.id, placa, modelo: "Importado do Wialon", consumoRefKmL: 2.5, plano: cliente.planoContratado, rastreadorId: u.uid },
    });
    usadas.add(placa);
    imeis.add(u.uid);
    novos.push(placa);
  }
  revalidatePath("/", "layout");
  const msg = novos.length
    ? `${novos.length} caminhões cadastrados a partir do Wialon. Em até 1 minuto aparecem no mapa com a posição real. Complete modelo e consumo em Caminhões e planos.`
    : "Nenhuma unidade nova: todas já estão na plataforma.";
  return { ok: novos.length > 0, msg: msg + (pulados.length ? ` Sem IMEI no Wialon: ${pulados.join(", ")}.` : "") };
}

/**
 * Apaga os caminhões de demonstração do cliente (rastreador "SIM-…", dos dados de exemplo)
 * e tudo ligado a eles: despesas, viagens, posições, alertas e caixas.
 */
export async function apagarDemonstracao(_: Resultado): Promise<Resultado> {
  const cliente = await soAdmin();
  if (!cliente) return { ok: false, msg: "Só a equipe KM Cero apaga caminhões." };
  const demo = await db.caminhao.findMany({ where: { clienteId: cliente.id, rastreadorId: { startsWith: "SIM-" } }, select: { id: true, placa: true } });
  if (!demo.length) return { ok: true, msg: "Não há caminhões de demonstração." };
  const ids = demo.map((c) => c.id);
  await db.$transaction([
    // A caixa do motorista não apaga junto com o caminhão (fica sem caminhão); aqui ela vai também.
    db.caixaViagem.deleteMany({ where: { caminhaoId: { in: ids } } }),
    db.caminhao.deleteMany({ where: { id: { in: ids } } }),
  ]);
  revalidatePath("/", "layout");
  return { ok: true, msg: `Apagados ${demo.length} caminhões de demonstração: ${demo.map((c) => c.placa).join(", ")}.` };
}

export type Historico = { ok: boolean; msg: string; faltam: number };

/** Tempo de cada rodada do histórico, abaixo do limite da Vercel para a resposta. */
const PRAZO_HISTORICO_MS = 40_000;

/**
 * Traz do Wialon as posições e a telemetria do mês (pelo menos 7 dias) dos caminhões ligados.
 * Cada chamada trabalha até 40 segundos; a tela chama de novo enquanto faltar caminhão.
 */
export async function trazerHistoricoWialon(): Promise<Historico> {
  const cliente = await soAdmin();
  if (!cliente) return { ok: false, msg: "Só a equipe KM Cero liga o Wialon.", faltam: 0 };
  const api = apiDoCliente(cliente);
  if (!api) return { ok: false, msg: "Conecte o Wialon primeiro.", faltam: 0 };
  const hoje = diaNoParaguai(new Date());
  const inicioMes = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1) + 3 * 3600_000);
  const desde = new Date(Math.min(inicioMes.getTime(), hoje.getTime() + 3 * 3600_000 - 7 * 86_400_000));
  try {
    const r = await historicoWialon(db, api, cliente.id, desde, PRAZO_HISTORICO_MS);
    revalidatePath("/", "layout");
    const base = `${r.gravadas.toLocaleString("pt-BR")} posições trazidas de ${r.caminhoes} caminhões.`;
    const erros = r.erros.length ? ` Com erro: ${r.erros.join("; ")}.` : "";
    return { ok: !r.erros.length, msg: r.faltam ? `${base} Faltam ${r.faltam} caminhões, continuando…` : `${base} Histórico completo.${erros}`, faltam: r.faltam };
  } catch (e) {
    return { ok: false, msg: (e as Error).message, faltam: 0 };
  }
}

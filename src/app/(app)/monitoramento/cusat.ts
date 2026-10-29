"use server";

import { revalidatePath } from "next/cache";
import { clienteAtual } from "@/lib/acesso";
import { db } from "@/lib/db";
import { apiGpswox, Gpswox, imeiDe, ligarAparelhos, SERVIDOR_CUSAT, type AparelhoGpswox } from "@/lib/rastreio/gpswox";
import type { Resultado } from "./wialon";

// Conta CUSAT (plataforma GPSWOX) do cliente, ligada pela equipe KM Cero na central.

async function soAdmin() {
  const { sessao, cliente } = await clienteAtual();
  return sessao.papel === "ADMIN" ? cliente : null;
}

/** Aceita "gps.cusat.com.py" ou o endereço inteiro copiado do navegador. */
function servidor(texto: string) {
  const t = texto.trim();
  if (!t) return SERVIDOR_CUSAT;
  try {
    return new URL(/^https?:\/\//.test(t) ? t : `https://${t}`).host;
  } catch {
    return null;
  }
}

async function aparelhosDoCliente(cliente: { gpswoxHash: string | null; gpswoxHost: string | null }): Promise<AparelhoGpswox[] | string> {
  const api = apiGpswox(cliente);
  if (!api) return "Conecte a CUSAT primeiro.";
  try {
    return await api.aparelhos();
  } catch (e) {
    return (e as Error).message;
  }
}

/** Entra com e-mail e senha, confere os aparelhos e guarda só a chave da API. */
export async function conectarCusat(_: Resultado, form: FormData): Promise<Resultado> {
  const cliente = await soAdmin();
  if (!cliente) return { ok: false, msg: "Só a equipe KM Cero liga a CUSAT." };
  const host = servidor(String(form.get("host") ?? ""));
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  if (!host) return { ok: false, msg: "Confira o endereço da plataforma (ex.: gps.cusat.com.py)." };
  if (!email || !senha) return { ok: false, msg: "Informe o e-mail e a senha da conta na CUSAT." };
  let n;
  try {
    const hash = await Gpswox.entrar(host, email, senha);
    n = (await new Gpswox(hash, host).aparelhos()).length;
    await db.cliente.update({ where: { id: cliente.id }, data: { gpswoxHost: host, gpswoxEmail: email, gpswoxHash: hash } });
  } catch (e) {
    return { ok: false, msg: (e as Error).message };
  }
  revalidatePath("/", "layout");
  return { ok: true, msg: `Conectado: ${n} aparelhos na CUSAT. Agora clique em Cadastrar os caminhões da CUSAT.` };
}

export async function desconectarCusat() {
  const cliente = await soAdmin();
  if (!cliente) return;
  await db.cliente.update({ where: { id: cliente.id }, data: { gpswoxHost: null, gpswoxEmail: null, gpswoxHash: null } });
  revalidatePath("/", "layout");
}

/**
 * Cadastra como caminhão cada aparelho da CUSAT que ainda não está na plataforma (pelo IMEI)
 * e preenche o IMEI dos caminhões já cadastrados com a mesma placa.
 */
export async function cadastrarCaminhoesCusat(_: Resultado): Promise<Resultado> {
  const cliente = await soAdmin();
  if (!cliente) return { ok: false, msg: "Só a equipe KM Cero liga a CUSAT." };
  const aparelhos = await aparelhosDoCliente(cliente);
  if (typeof aparelhos === "string") return { ok: false, msg: aparelhos };
  const caminhoes = await db.caminhao.findMany({ where: { clienteId: cliente.id }, select: { id: true, placa: true, rastreadorId: true } });
  const ligados: string[] = [], novos: string[] = [], semImei: string[] = [];
  const usados = new Set<number>();
  // Primeiro os caminhões que já existem: pelo IMEI ou pela placa.
  for (const { caminhao: c, aparelho: a } of ligarAparelhos(caminhoes, aparelhos)) {
    if (!a) continue;
    usados.add(a.id);
    const imei = imeiDe(a);
    if (!imei) { semImei.push(a.name); continue; }
    if (c.rastreadorId === imei) continue;
    const outro = await db.caminhao.findFirst({ where: { rastreadorId: imei, NOT: { id: c.id } }, select: { placa: true } });
    if (outro) { semImei.push(`${a.name} (IMEI já está no ${outro.placa})`); continue; }
    await db.caminhao.update({
      where: { id: c.id },
      data: { rastreadorId: imei, ultimaPosicaoEm: null, ultimaLat: null, ultimaLng: null, ultimaVelocidade: null, ultimaIgnicao: null },
    });
    ligados.push(c.placa);
  }
  const comImei = new Set((await db.caminhao.findMany({ where: { rastreadorId: { not: null } }, select: { rastreadorId: true } })).map((c) => c.rastreadorId));
  const placas = new Set(caminhoes.map((c) => c.placa.toUpperCase()));
  for (const a of aparelhos) {
    if (usados.has(a.id)) continue;
    const imei = imeiDe(a);
    if (!imei) { semImei.push(a.name); continue; }
    if (comImei.has(imei)) continue;
    let placa = (a.device_data?.plate_number || a.name).trim().toUpperCase().slice(0, 30) || imei;
    if (placas.has(placa)) placa = `${placa} (${imei.slice(-4)})`;
    await db.caminhao.create({
      data: { clienteId: cliente.id, placa, modelo: "Importado da CUSAT", consumoRefKmL: 2.5, plano: cliente.planoContratado, rastreadorId: imei },
    });
    placas.add(placa);
    comImei.add(imei);
    novos.push(placa);
  }
  revalidatePath("/", "layout");
  const partes = [
    novos.length ? `${novos.length} caminhões cadastrados` : "",
    ligados.length ? `${ligados.length} já cadastrados ligados pela placa (${ligados.join(", ")})` : "",
  ].filter(Boolean);
  const msg = partes.length
    ? `${partes.join(" e ")}. Em até 1 minuto aparecem no mapa com a posição real. Complete modelo e consumo em Caminhões e planos.`
    : `${aparelhos.length} aparelhos na CUSAT, todos já estão na plataforma.`;
  return { ok: partes.length > 0 || aparelhos.length > 0, msg: msg + (semImei.length ? ` Sem IMEI na CUSAT: ${semImei.join(", ")}.` : "") };
}

export type ListaAparelhos = { ok: boolean; msg: string; aparelhos: { nome: string; imei: string | null; placa: string | null; ultima: string | null; sensores: string }[] } | null;

/** Aparelhos da conta, com o caminhão ligado a cada um e os sensores que mandam. */
export async function listarAparelhosCusat(_: ListaAparelhos): Promise<ListaAparelhos> {
  const cliente = await soAdmin();
  if (!cliente) return { ok: false, msg: "Só a equipe KM Cero liga a CUSAT.", aparelhos: [] };
  const aparelhos = await aparelhosDoCliente(cliente);
  if (typeof aparelhos === "string") return { ok: false, msg: aparelhos, aparelhos: [] };
  const caminhoes = await db.caminhao.findMany({ where: { clienteId: cliente.id, rastreadorId: { not: null } }, select: { placa: true, rastreadorId: true } });
  const porImei = new Map(caminhoes.map((c) => [c.rastreadorId!, c.placa]));
  return {
    ok: true,
    msg: `${aparelhos.length} aparelhos na CUSAT`,
    aparelhos: aparelhos.map((a) => {
      const imei = imeiDe(a);
      return {
        nome: a.name,
        imei,
        placa: (imei && porImei.get(imei)) || null,
        ultima: a.timestamp ? new Date(a.timestamp * 1000).toISOString() : null,
        sensores: (a.sensors ?? []).map((s) => `${s.name ?? s.type}: ${String(s.value ?? s.val ?? "")}`).join(" · "),
      };
    }),
  };
}

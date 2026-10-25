import "server-only";
import { db } from "@/lib/db";
import { frotaNoMapa } from "@/lib/rastreio/dados";
import { diaNoParaguai, hash, posicaoDemo } from "@/lib/rastreio/rotas";
import { ehImei } from "@/lib/telemetria/posicoes";

// Fotos e vídeos das câmeras (plano Vídeo). As mídias reais chegam pelo receptor;
// nos caminhões de demonstração geramos registros sem arquivo, e a tela desenha a cena.

export const NOME_GATILHO: Record<string, string> = {
  pedido: "Pedido pela central",
  freada: "Freada brusca",
  aceleracao: "Aceleração brusca",
  curva: "Curva brusca",
  excesso: "Excesso de velocidade",
  colisao: "Impacto",
  panico: "Botão de pânico",
  sem_sinal: "Sem sinal",
  evento: "Evento do aparelho",
};

const DURACAO_DEMO_S = 10;
const DIAS_DEMO = 3;

type NovaMidia = {
  clienteId: string; caminhaoId: string; tipo: string; camera: string; gatilho: string; data: Date;
  lat: number; lng: number; velocidadeKmh: number; chave: string; ocorrenciaId?: string;
};

function midiaDemo(m: NovaMidia) {
  return { ...m, demo: true, duracaoS: m.tipo === "video" ? DURACAO_DEMO_S : null, formato: m.tipo === "video" ? "video/mp4" : "image/jpeg" };
}

export async function criarMidiaDemo(m: NovaMidia) {
  await db.midia.createMany({ data: [midiaDemo(m)], skipDuplicates: true });
}

const GATILHOS_DEMO = ["freada", "curva", "aceleracao", "freada", "excesso"];

/** Mídias de demonstração dos últimos dias e dos alertas com vídeo, sempre as mesmas para o mesmo caminhão e dia. */
async function garantirMidiasDemo(clienteId: string | null, agora: Date) {
  const cams = await db.caminhao.findMany({
    where: { plano: "VIDEO", rastreadorId: { not: null }, ...(clienteId ? { clienteId } : {}) },
    select: { id: true, clienteId: true, rastreadorId: true },
  });
  const demo = cams.filter((c) => !ehImei(c.rastreadorId));
  if (!demo.length) return;
  const novas: NovaMidia[] = [];
  const hoje = diaNoParaguai(agora).getTime();
  for (const c of demo) {
    for (let d = DIAS_DEMO - 1; d >= 0; d--) {
      const dia = new Date(hoje - d * 86_400_000);
      const chaveDia = `${c.id}:${dia.toISOString().slice(0, 10)}`;
      const n = 2 + (hash(chaveDia + "n") % 3);
      for (let i = 0; i < n; i++) {
        // Entre 7h e 17h do Paraguai (10h a 20h UTC).
        const t = new Date(dia.getTime() + (10 + (hash(`${chaveDia}:${i}:h`) % 600) / 60) * 3600_000);
        if (t > agora) continue;
        const p = posicaoDemo(c.id, t);
        if (p.velocidadeKmh < 3) continue;
        const gatilho = GATILHOS_DEMO[hash(`${chaveDia}:${i}:g`) % GATILHOS_DEMO.length];
        const base = { clienteId: c.clienteId, caminhaoId: c.id, data: t, lat: p.lat, lng: p.lng, gatilho };
        novas.push({ ...base, tipo: "video", camera: "frontal", velocidadeKmh: gatilho === "excesso" ? Math.max(p.velocidadeKmh, 84 + (hash(chaveDia + i) % 18)) : p.velocidadeKmh, chave: `demo:${chaveDia}:${i}` });
        if (hash(`${chaveDia}:${i}:c`) % 3 === 0) novas.push({ ...base, tipo: "foto", camera: "cabine", velocidadeKmh: p.velocidadeKmh, chave: `demo:${chaveDia}:${i}:cab` });
      }
    }
  }
  // Alertas da central em caminhões com câmera também ganham o vídeo do momento.
  const ocs = await db.ocorrencia.findMany({
    where: { caminhaoId: { in: demo.map((c) => c.id) }, tipo: { in: ["excesso", "freada", "aceleracao", "curva"] }, criadaEm: { gte: new Date(agora.getTime() - DIAS_DEMO * 86_400_000) } },
    select: { id: true, clienteId: true, caminhaoId: true, tipo: true, criadaEm: true, lat: true, lng: true, velocidadeKmh: true },
  });
  for (const o of ocs) {
    novas.push({
      clienteId: o.clienteId, caminhaoId: o.caminhaoId, ocorrenciaId: o.id, tipo: "video", camera: "frontal", gatilho: o.tipo,
      data: o.criadaEm, lat: o.lat ?? 0, lng: o.lng ?? 0, velocidadeKmh: o.velocidadeKmh ?? 0, chave: `demo-oc:${o.id}`,
    });
  }
  if (novas.length) await db.midia.createMany({ data: novas.map(midiaDemo), skipDuplicates: true });
}

export type MidiaVista = {
  id: string; tipo: string; camera: string; gatilho: string; data: string; lat: number | null; lng: number | null;
  velocidadeKmh: number | null; duracaoS: number | null; formato: string | null; tamanho: number | null; demo: boolean;
  placa: string; caminhaoId: string; cliente: string; ocorrencia: string | null;
};

export async function midiasVista(where: { clienteId?: string; caminhaoId?: string; ocorrenciaId?: string }, take = 120): Promise<MidiaVista[]> {
  const ms = await db.midia.findMany({
    where,
    select: {
      id: true, tipo: true, camera: true, gatilho: true, data: true, lat: true, lng: true, velocidadeKmh: true, duracaoS: true,
      formato: true, tamanho: true, demo: true, caminhaoId: true,
      caminhao: { select: { placa: true } }, cliente: { select: { nome: true } }, ocorrencia: { select: { titulo: true } },
    },
    orderBy: { data: "desc" },
    take,
  });
  return ms.map((m) => ({
    id: m.id, tipo: m.tipo, camera: m.camera, gatilho: m.gatilho, data: m.data.toISOString(), lat: m.lat, lng: m.lng,
    velocidadeKmh: m.velocidadeKmh, duracaoS: m.duracaoS, formato: m.formato, tamanho: m.tamanho, demo: m.demo,
    placa: m.caminhao.placa, caminhaoId: m.caminhaoId, cliente: m.cliente.nome, ocorrencia: m.ocorrencia?.titulo ?? null,
  }));
}

export type CameraVista = {
  id: string; placa: string; modelo: string; motorista: string | null; cliente: string; situacao: string;
  local: string | null; velocidadeKmh: number; demo: boolean; online: boolean; midiasHoje: number;
};

export async function dadosVideo(clienteId: string | null, agora = new Date()) {
  await garantirMidiasDemo(clienteId, agora);
  const [frota, planos, midias, pedidos] = await Promise.all([
    frotaNoMapa(clienteId, agora),
    db.caminhao.findMany({ where: { plano: "VIDEO", ...(clienteId ? { clienteId } : {}) }, select: { id: true } }),
    midiasVista(clienteId ? { clienteId } : {}),
    db.comando.count({ where: { tipo: { in: ["foto", "video"] }, status: { in: ["pendente", "aguardando", "enviado"] }, ...(clienteId ? { clienteId } : {}) } }),
  ]);
  const comCamera = new Set(planos.map((p) => p.id));
  const inicioHoje = new Date(diaNoParaguai(agora).getTime() + 3 * 3600_000);
  const hojePor = new Map<string, number>();
  for (const m of midias) if (new Date(m.data) >= inicioHoje) hojePor.set(m.caminhaoId, (hojePor.get(m.caminhaoId) ?? 0) + 1);
  const cameras: CameraVista[] = frota
    .filter((c) => comCamera.has(c.id))
    .map((c) => ({
      id: c.id, placa: c.placa, modelo: c.modelo, motorista: c.motorista, cliente: c.cliente, situacao: c.situacao,
      local: c.local, velocidadeKmh: c.velocidadeKmh, demo: c.demo,
      online: c.demo ? c.situacao !== "sem-rastreador" : c.situacao === "movimento" || c.situacao === "parado",
      midiasHoje: hojePor.get(c.id) ?? 0,
    }));
  return { cameras, midias, pedidos };
}

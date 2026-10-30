import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { indicadoresFrota } from "@/lib/dados";
import { mesAtual, planoPermite } from "@/lib/indicadores";
import { ehImei, LIMITE_VELOCIDADE_KMH, resumirDia, saidaDoDia } from "@/lib/telemetria/posicoes";
import { clienteUsaWialon, espelharSeDevido } from "./wialon";
import { diaNoParaguai, posicaoDemo, rotaDemoNome, trajetoDemo } from "./rotas";

export type Situacao = "movimento" | "parado" | "desligado" | "sem-sinal" | "aguardando" | "sem-rastreador";

export type CaminhaoMapa = {
  id: string;
  placa: string;
  modelo: string;
  motorista: string | null;
  cliente: string;
  clienteId: string;
  situacao: Situacao;
  /** true quando o caminhão ainda não tem aparelho próprio e a posição é de demonstração. */
  demo: boolean;
  lat: number | null;
  lng: number | null;
  velocidadeKmh: number;
  direcao: number;
  atualizadoEm: string | null;
  rota: string | null;
  /** Onde está e para onde vai (ex.: "PY02, km 182 → Ciudad del Este"); só na demonstração. */
  local: string | null;
  rpm: number | null;
  /** Motor bloqueado por comando da central. */
  bloqueado: boolean;
  /** Posições trazidas do Wialon em vez do receptor próprio. */
  wialon: boolean;
};

const SEM_SINAL_MS = 30 * 60_000;

function situacao(em: Date | null, ignicao: boolean | null, vel: number, agora: Date): Situacao {
  if (!em) return "aguardando";
  if (agora.getTime() - em.getTime() > SEM_SINAL_MS && ignicao !== false) return "sem-sinal";
  if (ignicao === false) return "desligado";
  return vel > 3 ? "movimento" : "parado";
}

/** Caminhões de um cliente, ou de todos os clientes quando `clienteId` é null (só a equipe KM Cero). */
export async function frotaNoMapa(clienteId: string | null, agora = new Date()): Promise<CaminhaoMapa[]> {
  await espelharSeDevido(db, agora);
  const lista = await db.caminhao.findMany({
    where: { baseCombustivel: false, ...(clienteId ? { clienteId } : {}) },
    include: { motorista: { select: { nome: true } }, cliente: { select: { nome: true, wialonToken: true, wialonHost: true } } },
    orderBy: [{ cliente: { nome: "asc" } }, { placa: "asc" }],
  });
  return lista.map((c) => {
    const base = { id: c.id, placa: c.placa, modelo: c.modelo, motorista: c.motorista?.nome ?? null, cliente: c.cliente.nome, clienteId: c.clienteId, bloqueado: c.motorBloqueado,
      wialon: ehImei(c.rastreadorId) && clienteUsaWialon(c.cliente) };
    if (!c.rastreadorId) {
      return { ...base, situacao: "sem-rastreador", demo: false, lat: null, lng: null, velocidadeKmh: 0, direcao: 0, atualizadoEm: null, rota: null, local: null, rpm: null };
    }
    if (ehImei(c.rastreadorId)) {
      return {
        ...base,
        situacao: situacao(c.ultimaPosicaoEm, c.ultimaIgnicao, c.ultimaVelocidade ?? 0, agora),
        demo: false,
        lat: c.ultimaLat,
        lng: c.ultimaLng,
        velocidadeKmh: c.ultimaVelocidade ?? 0,
        direcao: c.ultimaDirecao ?? 0,
        atualizadoEm: c.ultimaPosicaoEm?.toISOString() ?? null,
        rota: null,
        local: null,
        rpm: null,
      };
    }
    // Demonstração com motor bloqueado: fica onde parou até desbloquear.
    if (c.motorBloqueado && c.ultimaLat != null && c.ultimaLng != null) {
      return {
        ...base, situacao: "desligado", demo: true, lat: c.ultimaLat, lng: c.ultimaLng, velocidadeKmh: 0, direcao: 0,
        atualizadoEm: agora.toISOString(), rota: rotaDemoNome(c.id, diaNoParaguai(agora)), local: "Motor bloqueado pela central", rpm: 0,
      };
    }
    const p = posicaoDemo(c.id, agora);
    return {
      ...base,
      situacao: p.ignicao ? (p.velocidadeKmh > 3 ? "movimento" : "parado") : "desligado",
      demo: true,
      lat: p.lat,
      lng: p.lng,
      velocidadeKmh: p.velocidadeKmh,
      direcao: p.direcao,
      atualizadoEm: agora.toISOString(),
      rota: rotaDemoNome(c.id, diaNoParaguai(agora)),
      local: p.local,
      rpm: p.rpm,
    };
  });
}

export type Trajeto = {
  pontos: [number, number][];
  /** Para excesso de velocidade: maior velocidade e fim do trecho acima do limite. */
  eventos: { lat: number; lng: number; tipo: string; hora: string; velocidadeKmh: number; maxKmh?: number; ate?: string }[];
  km: number;
  velocidadeMax: number;
  litros: number | null;
  inicio: string | null;
  /** Onde e quando o caminhão começou a andar no dia. */
  saida: { hora: string; lat: number; lng: number } | null;
  fim: string | null;
  demo: boolean;
  /** Rota prevista do frete em curso nesse dia, para comparar com o caminho feito. */
  rotaPrevista?: [number, number][] | null;
};

/** Rota prevista do frete que estava em curso no dia (saiu até 15 dias antes e não passou da entrega). */
async function rotaDoDia(caminhaoId: string, dia: Date) {
  const v = await db.viagem.findFirst({
    where: { caminhaoId, data: { lte: dia, gte: new Date(dia.getTime() - 15 * 86_400_000) }, OR: [{ dataEntrega: null }, { dataEntrega: { gte: dia } }], rota: { not: Prisma.DbNull } },
    orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
    select: { rota: true },
  });
  return Array.isArray(v?.rota) ? (v.rota as unknown as [number, number][]) : null;
}

const saidaDe = (pts: { data: Date; velocidadeKmh: number; lat: number; lng: number }[]) => {
  const s = saidaDoDia(pts);
  return s ? { hora: s.data.toISOString(), lat: s.lat, lng: s.lng } : null;
};

/** Trajeto de um caminhão num dia do Paraguai (`dia` = meia-noite UTC dessa data). `clienteId` null = qualquer cliente. */
export async function trajetoDoDia(clienteId: string | null, caminhaoId: string, dia: Date, agora = new Date()): Promise<Trajeto | null> {
  const c = await db.caminhao.findFirst({ where: { id: caminhaoId, ...(clienteId ? { clienteId } : {}) }, select: { id: true, rastreadorId: true, odometroKm: true } });
  if (!c || !c.rastreadorId) return null;

  if (!ehImei(c.rastreadorId)) {
    const pts = trajetoDemo(c.id, dia, agora);
    let km = 0;
    for (let i = 1; i < pts.length; i++) km += (pts[i].velocidadeKmh * 5) / 60;
    return {
      pontos: pts.map((p) => [p.lat, p.lng]),
      eventos: [],
      km: Math.round(km),
      velocidadeMax: Math.max(0, ...pts.map((p) => p.velocidadeKmh)),
      litros: null,
      inicio: pts[0]?.data.toISOString() ?? null,
      saida: saidaDe(pts),
      fim: pts.at(-1)?.data.toISOString() ?? null,
      demo: true,
    };
  }

  const ini = new Date(dia.getTime() + 3 * 3600_000);
  const fim = new Date(ini.getTime() + 24 * 3600_000);
  const pts = await db.posicao.findMany({
    where: { caminhaoId: c.id, data: { gte: ini, lt: fim } },
    orderBy: { data: "asc" },
    select: { data: true, lat: true, lng: true, velocidadeKmh: true, ignicao: true, odometroKm: true, litrosTotal: true, rpm: true, evento: true },
  });
  const resumo = resumirDia(pts, c.odometroKm);
  // Mapa leve: no máximo ~1500 pontos na linha.
  const passo = Math.max(1, Math.ceil(pts.length / 1500));
  const linha = pts.filter((_, i) => i % passo === 0 || i === pts.length - 1).map((p) => [p.lat, p.lng] as [number, number]);
  // Eventos do aparelho e o início de cada trecho acima do limite de velocidade.
  const eventos = pts
    .filter((p, i) => p.evento || (p.velocidadeKmh > LIMITE_VELOCIDADE_KMH && (i === 0 || pts[i - 1].velocidadeKmh <= LIMITE_VELOCIDADE_KMH)))
    .slice(0, 200)
    .map((p) => {
      const ev = { lat: p.lat, lng: p.lng, tipo: p.evento ?? "excesso", hora: p.data.toISOString(), velocidadeKmh: p.velocidadeKmh };
      if (ev.tipo !== "excesso") return ev;
      // O trecho vai até a velocidade voltar ao limite.
      let maxKmh = p.velocidadeKmh, fim = p.data;
      for (let j = pts.indexOf(p) + 1; j < pts.length && pts[j].velocidadeKmh > LIMITE_VELOCIDADE_KMH; j++) {
        maxKmh = Math.max(maxKmh, pts[j].velocidadeKmh);
        fim = pts[j].data;
      }
      return { ...ev, maxKmh, ate: fim.toISOString() };
    });
  return {
    pontos: linha,
    eventos,
    km: resumo?.km ?? 0,
    velocidadeMax: Math.max(0, ...pts.map((p) => p.velocidadeKmh)),
    litros: resumo?.litrosCan ?? null,
    inicio: pts[0]?.data.toISOString() ?? null,
    saida: saidaDe(pts),
    fim: pts.at(-1)?.data.toISOString() ?? null,
    demo: false,
    rotaPrevista: await rotaDoDia(c.id, dia),
  };
}

export type ResumoCaminhao = {
  odometroKm: number;
  kmMes: number;
  /** km/l medido pela rede CAN no mês (null sem CAN). */
  kmL: number | null;
  /** Custo por km do mês (null fora do plano Gestão ou sem custos lançados). */
  custoKm: number | null;
  /** RPM do último sinal do aparelho próprio. */
  rpm: number | null;
};

/** Números do mês de um caminhão para o painel do mapa (os mesmos do Custo por km e do Consumo). */
export async function resumoDoCaminhao(clienteId: string | null, caminhaoId: string): Promise<ResumoCaminhao | null> {
  const c = await db.caminhao.findFirst({ where: { id: caminhaoId, ...(clienteId ? { clienteId } : {}) }, select: { id: true, clienteId: true, rastreadorId: true } });
  if (!c) return null;
  const [ind, ultima] = await Promise.all([
    indicadoresFrota(c.clienteId, mesAtual()),
    ehImei(c.rastreadorId) ? db.posicao.findFirst({ where: { caminhaoId: c.id, rpm: { not: null } }, orderBy: { data: "desc" }, select: { rpm: true } }) : null,
  ]);
  const i = ind.find((x) => x.id === c.id);
  if (!i) return null;
  return {
    odometroKm: i.odometroKm,
    kmMes: i.km,
    kmL: i.kmL,
    custoKm: planoPermite(i.plano, "custos") && i.custoTotal > 0 ? i.custoKm : null,
    rpm: ultima?.rpm ?? null,
  };
}

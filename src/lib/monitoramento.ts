import "server-only";
import { db } from "@/lib/db";
import { frotaNoMapa, type CaminhaoMapa } from "@/lib/rastreio/dados";
import { diaNoParaguai, distanciaKm } from "@/lib/rastreio/rotas";
import { ehImei, LIMITE_VELOCIDADE_KMH } from "@/lib/telemetria/posicoes";

// Regras da central de monitoramento. Cada verificação olha a frota agora, compara com
// o que já se sabia (cerca atual de cada caminhão) e grava as ocorrências novas.
// A `chave` de cada ocorrência impede repetir o mesmo alerta.

export const TIPOS_CERCA: Record<string, string> = { patio: "Pátio", cliente: "Cliente", fronteira: "Fronteira", risco: "Área de risco" };
export const NOME_OCORRENCIA: Record<string, string> = {
  excesso: "Excesso de velocidade",
  sem_sinal: "Sem sinal do rastreador",
  ignicao_noturna: "Rodando de madrugada",
  entrada_cerca: "Entrou na cerca",
  saida_cerca: "Saiu da cerca",
  freada: "Freada brusca",
  aceleracao: "Aceleração brusca",
  curva: "Curva brusca",
};

/** Cerca "fora de todas": distingue de null, que é caminhão ainda nunca verificado. */
const FORA = "fora";
const VELOCIDADE_ALTA = 100;

type Nova = {
  clienteId: string; caminhaoId: string; tipo: string; gravidade: "alta" | "media" | "baixa";
  titulo: string; detalhe: string; lat: number | null; lng: number | null; velocidadeKmh: number | null; chave: string;
};

export async function verificarFrota(clienteId: string | null, agora = new Date()): Promise<{ frota: CaminhaoMapa[]; novas: number }> {
  const [frota, cercas] = await Promise.all([
    frotaNoMapa(clienteId, agora),
    db.cerca.findMany({ where: { ativa: true, ...(clienteId ? { clienteId } : {}) } }),
  ]);
  const estado = new Map(
    (await db.caminhao.findMany({ where: clienteId ? { clienteId } : {}, select: { id: true, cercaAtualId: true, rastreadorId: true } })).map((c) => [c.id, c]),
  );
  const dia = diaNoParaguai(agora).toISOString().slice(0, 10);
  const bloco3h = `${dia}T${String(Math.floor(agora.getUTCHours() / 3) * 3).padStart(2, "0")}`;
  const minuto = agora.toISOString().slice(0, 16);
  const horaPy = (agora.getUTCHours() + 21) % 24;
  const novas: Nova[] = [];
  const mudancasCerca: { id: string; cerca: string }[] = [];

  for (const c of frota) {
    if (c.lat == null || c.lng == null) continue;
    const base = { clienteId: c.clienteId, caminhaoId: c.id, lat: c.lat, lng: c.lng, velocidadeKmh: c.velocidadeKmh };
    const onde = c.local ? ` · ${c.local}` : "";

    if (c.situacao === "movimento" && c.velocidadeKmh > LIMITE_VELOCIDADE_KMH) {
      novas.push({
        ...base, tipo: "excesso", gravidade: c.velocidadeKmh >= VELOCIDADE_ALTA ? "alta" : "media",
        titulo: `${c.placa} a ${c.velocidadeKmh} km/h`, detalhe: `Acima do limite de ${LIMITE_VELOCIDADE_KMH} km/h${onde}`,
        chave: `${c.id}:excesso:${bloco3h}`,
      });
    }
    if (c.situacao === "sem-sinal") {
      novas.push({ ...base, tipo: "sem_sinal", gravidade: "alta", titulo: `${c.placa} sem sinal`, detalhe: "Ligado, mas sem enviar posição há mais de 30 minutos.", chave: `${c.id}:sem_sinal:${dia}` });
    }
    if (c.situacao === "movimento" && (horaPy >= 22 || horaPy < 5)) {
      novas.push({ ...base, tipo: "ignicao_noturna", gravidade: "media", titulo: `${c.placa} rodando às ${horaPy}h`, detalhe: `Caminhão em movimento fora do horário normal${onde}`, chave: `${c.id}:noturna:${dia}` });
    }

    // Cercas do mesmo cliente: entrada e saída.
    const dentro = cercas.find((z) => z.clienteId === c.clienteId && distanciaKm(c as { lat: number; lng: number }, z) * 1000 <= z.raioM);
    const agoraEm = dentro?.id ?? FORA;
    const antes = estado.get(c.id)?.cercaAtualId ?? null;
    if (antes !== agoraEm) {
      mudancasCerca.push({ id: c.id, cerca: agoraEm });
      // Primeira verificação do caminhão: só registra onde ele está, sem alerta.
      if (antes !== null) {
        const saiu = cercas.find((z) => z.id === antes);
        if (saiu) {
          novas.push({
            ...base, tipo: "saida_cerca", gravidade: saiu.tipo === "patio" ? "baixa" : "media",
            titulo: `${c.placa} saiu de ${saiu.nome}`, detalhe: `${TIPOS_CERCA[saiu.tipo] ?? saiu.tipo}${onde}`, chave: `${c.id}:saida:${saiu.id}:${minuto}`,
          });
        }
        if (dentro) {
          novas.push({
            ...base, tipo: "entrada_cerca", gravidade: dentro.tipo === "fronteira" || dentro.tipo === "risco" ? "alta" : "baixa",
            titulo: `${c.placa} entrou em ${dentro.nome}`, detalhe: `${TIPOS_CERCA[dentro.tipo] ?? dentro.tipo}${onde}`, chave: `${c.id}:entrada:${dentro.id}:${minuto}`,
          });
        }
      }
    }
  }

  // Eventos de condução enviados pelos aparelhos próprios nos últimos 15 minutos.
  const imeis = [...estado.values()].filter((c) => ehImei(c.rastreadorId)).map((c) => c.id);
  if (imeis.length) {
    const eventos = await db.posicao.findMany({
      where: { caminhaoId: { in: imeis }, evento: { not: null }, data: { gte: new Date(agora.getTime() - 15 * 60_000) } },
      include: { caminhao: { select: { placa: true, clienteId: true } } },
    });
    for (const e of eventos) {
      novas.push({
        clienteId: e.caminhao.clienteId, caminhaoId: e.caminhaoId, tipo: e.evento!, gravidade: e.evento === "excesso" ? "media" : "baixa",
        titulo: `${e.caminhao.placa} · ${NOME_OCORRENCIA[e.evento!] ?? e.evento}`, detalhe: `A ${e.velocidadeKmh} km/h, informado pelo aparelho.`,
        lat: e.lat, lng: e.lng, velocidadeKmh: e.velocidadeKmh, chave: `pos:${e.id}`,
      });
    }
  }

  await Promise.all(mudancasCerca.map((m) => db.caminhao.update({ where: { id: m.id }, data: { cercaAtualId: m.cerca } })));
  const r = novas.length ? await db.ocorrencia.createMany({ data: novas, skipDuplicates: true }) : { count: 0 };
  return { frota, novas: r.count };
}

export async function ocorrenciasAbertas(clienteId: string | null) {
  return db.ocorrencia.findMany({
    where: { status: { not: "resolvida" }, ...(clienteId ? { clienteId } : {}) },
    include: { caminhao: { select: { placa: true } }, cliente: { select: { nome: true } }, midias: { select: { id: true }, orderBy: { data: "asc" }, take: 1 } },
    orderBy: { criadaEm: "desc" },
    take: 300,
  });
}

export async function ocorrenciasResolvidas(clienteId: string | null) {
  return db.ocorrencia.findMany({
    where: { status: "resolvida", ...(clienteId ? { clienteId } : {}) },
    include: { caminhao: { select: { placa: true } }, cliente: { select: { nome: true } }, midias: { select: { id: true }, orderBy: { data: "asc" }, take: 1 } },
    orderBy: { resolvidaEm: "desc" },
    take: 30,
  });
}

export type OcorrenciaVista = {
  id: string; tipo: string; gravidade: string; titulo: string; detalhe: string; status: string;
  lat: number | null; lng: number | null; placa: string; caminhaoId: string; cliente: string;
  /** Vídeo da câmera gravado no momento do alerta (plano Vídeo). */
  midiaId: string | null;
  criadaEm: string; atendidaPor: string | null; resolvidaEm: string | null; observacao: string | null;
};

export function paraVista(o: Awaited<ReturnType<typeof ocorrenciasAbertas>>[number]): OcorrenciaVista {
  return {
    id: o.id, tipo: o.tipo, gravidade: o.gravidade, titulo: o.titulo, detalhe: o.detalhe, status: o.status,
    lat: o.lat, lng: o.lng, placa: o.caminhao.placa, caminhaoId: o.caminhaoId, cliente: o.cliente.nome, midiaId: o.midias[0]?.id ?? null,
    criadaEm: o.criadaEm.toISOString(), atendidaPor: o.atendidaPor, resolvidaEm: o.resolvidaEm?.toISOString() ?? null, observacao: o.observacao,
  };
}

export type CercaVista = { id: string; nome: string; tipo: string; lat: number; lng: number; raioM: number; ativa: boolean; cliente: string };

export async function cercasVista(clienteId: string | null): Promise<CercaVista[]> {
  const cs = await db.cerca.findMany({ where: clienteId ? { clienteId } : {}, include: { cliente: { select: { nome: true } } }, orderBy: [{ cliente: { nome: "asc" } }, { nome: "asc" }] });
  return cs.map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo, lat: c.lat, lng: c.lng, raioM: c.raioM, ativa: c.ativa, cliente: c.cliente.nome }));
}

/** Tudo o que a central mostra, já verificando a frota e gravando os alertas novos. */
export async function dadosCentral(clienteId: string | null) {
  const { frota, novas } = await verificarFrota(clienteId);
  const [abertas, resolvidas, cercas] = await Promise.all([ocorrenciasAbertas(clienteId), ocorrenciasResolvidas(clienteId), cercasVista(clienteId)]);
  return { frota, novas, abertas: abertas.map(paraVista), resolvidas: resolvidas.map(paraVista), cercas };
}

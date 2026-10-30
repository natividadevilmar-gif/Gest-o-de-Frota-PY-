import "server-only";
import { db } from "@/lib/db";
import { pedagiosSemRegistro } from "@/lib/pedagioDados";
import { juntarNumero } from "@/lib/whatsapp";
import { frotaNoMapa, type CaminhaoMapa } from "@/lib/rastreio/dados";
import { diaNoParaguai, distanciaKm } from "@/lib/rastreio/rotas";
import { ehImei, LIMITE_VELOCIDADE_KMH } from "@/lib/telemetria/posicoes";
import { calcularRota, distanciaAteRotaKm, foraDaRota, type PontoRota } from "@/lib/rastreio/rotaFrete";
import { Prisma } from "@prisma/client";

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
  pedagio_sem_registro: "Pedágio não registrado",
  desvio_rota: "Desvio de rota",
};

/** Calcula e guarda a rota prevista de um frete (origem → destino). */
export async function salvarRota(viagemId: string) {
  const v = await db.viagem.findUnique({ where: { id: viagemId }, select: { origem: true, paisOrigem: true, destino: true, paisDestino: true } });
  if (!v) return;
  const r = await calcularRota(v);
  await db.viagem.update({
    where: { id: viagemId },
    data: "erro" in r ? { rota: Prisma.DbNull, rotaKm: null, rotaErro: r.erro } : { rota: r.rota as unknown as Prisma.InputJsonValue, rotaKm: r.km, rotaErro: null },
  });
}

/** Frete em curso de cada caminhão: saiu há no máximo 15 dias e ainda não passou da data de entrega. */
async function fretesEmCurso(clienteId: string | null, agora: Date) {
  const hoje = diaNoParaguai(agora);
  const vs = await db.viagem.findMany({
    where: {
      ...(clienteId ? { caminhao: { clienteId } } : {}),
      data: { lte: hoje, gte: new Date(hoje.getTime() - 15 * 86_400_000) },
      OR: [{ dataEntrega: null }, { dataEntrega: { gte: hoje } }],
    },
    orderBy: [{ data: "desc" }, { criadoEm: "desc" }],
    select: { id: true, caminhaoId: true, origem: true, destino: true, rota: true, rotaErro: true },
  });
  const porCaminhao = new Map<string, (typeof vs)[number]>();
  for (const v of vs) if (!porCaminhao.has(v.caminhaoId)) porCaminhao.set(v.caminhaoId, v);
  return porCaminhao;
}

// Rotas que faltam são calculadas aos poucos (uma por verificação), sem repetir a mesma em seguida.
const tentouRota = new Map<string, number>();

/** Alerta de pedágio não registrado suspenso: não gera alertas novos e some da fila. */
export const ALERTA_PEDAGIO_ATIVO = false;
const SEM_PEDAGIO = ALERTA_PEDAGIO_ATIVO ? {} : { NOT: { tipo: "pedagio_sem_registro" } };

/** Cerca "fora de todas": distingue de null, que é caminhão ainda nunca verificado. */
const FORA = "fora";
const VELOCIDADE_ALTA = 100;

type Nova = {
  clienteId: string; caminhaoId: string; tipo: string; gravidade: "alta" | "media" | "baixa";
  titulo: string; detalhe: string; lat: number | null; lng: number | null; velocidadeKmh: number | null; chave: string;
};

export async function verificarFrota(clienteId: string | null, agora = new Date()): Promise<{ frota: CaminhaoMapa[]; novas: number }> {
  const [frota, cercas, emCurso] = await Promise.all([
    frotaNoMapa(clienteId, agora),
    db.cerca.findMany({ where: { ativa: true, ...(clienteId ? { clienteId } : {}) } }),
    fretesEmCurso(clienteId, agora),
  ]);
  const falta = [...emCurso.values()].find((v) => !v.rota && !v.rotaErro && agora.getTime() - (tentouRota.get(v.id) ?? 0) > 10 * 60_000);
  if (falta) {
    tentouRota.set(falta.id, agora.getTime());
    await salvarRota(falta.id).catch(() => {});
  }
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
      novas.push({ ...base, tipo: "sem_sinal", gravidade: "alta", titulo: `${c.placa} sem sinal`, detalhe: "Ligado, mas sem enviar posição há mais de 30 minutos.", chave: `${c.id}:sem_sinal:${c.atualizadoEm ?? dia}` });
    }
    if (c.situacao === "movimento" && (horaPy >= 22 || horaPy < 5)) {
      novas.push({ ...base, tipo: "ignicao_noturna", gravidade: "media", titulo: `${c.placa} rodando às ${horaPy}h`, detalhe: `Caminhão em movimento fora do horário normal${onde}`, chave: `${c.id}:noturna:${dia}` });
    }

    // Fora da rota prevista do frete em curso (um alerta por caminhão e frete a cada hora).
    const frete = emCurso.get(c.id);
    const rota = Array.isArray(frete?.rota) ? (frete!.rota as unknown as PontoRota[]) : null;
    if (frete && rota && c.situacao === "movimento" && foraDaRota(c as { lat: number; lng: number }, rota)) {
      const km = Math.round(distanciaAteRotaKm(c as { lat: number; lng: number }, rota));
      novas.push({
        ...base, tipo: "desvio_rota", gravidade: "alta",
        titulo: `${c.placa} fora da rota`, detalhe: `${km} km fora da rota ${frete.origem} → ${frete.destino}${onde}`,
        chave: `${c.id}:desvio:${frete.id}:${minuto.slice(0, 13)}`,
      });
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

  // Um erro no pedágio (cotação, praça sem dado) não pode derrubar a central.
  if (ALERTA_PEDAGIO_ATIVO) novas.push(...(await pedagiosSemRegistro(clienteId, agora).catch(() => [])));

  await Promise.all(mudancasCerca.map((m) => db.caminhao.update({ where: { id: m.id }, data: { cercaAtualId: m.cerca } })));
  await fecharSemSinalQueVoltou(frota, agora);
  const r = novas.length ? await db.ocorrencia.createMany({ data: novas, skipDuplicates: true }) : { count: 0 };
  return { frota, novas: r.count };
}

/** O rastreador voltou a mandar posição: o alerta "sem sinal" se fecha sozinho, com a hora da volta. */
async function fecharSemSinalQueVoltou(frota: CaminhaoMapa[], agora: Date) {
  const voltou = frota.filter((c) => !c.demo && c.situacao !== "sem-sinal" && c.atualizadoEm && agora.getTime() - Date.parse(c.atualizadoEm) <= 30 * 60_000);
  if (!voltou.length) return;
  const abertas = await db.ocorrencia.findMany({
    where: { tipo: "sem_sinal", status: { not: "resolvida" }, caminhaoId: { in: voltou.map((c) => c.id) } },
    select: { id: true, caminhaoId: true, atendidaPor: true, atendidaEm: true },
  });
  const hora = new Map(voltou.map((c) => [c.id, new Date(c.atualizadoEm!).toLocaleString("pt-BR", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })]));
  await Promise.all(abertas.map((o) => db.ocorrencia.update({
    where: { id: o.id },
    data: {
      status: "resolvida", resolvidaEm: agora, observacao: `Sinal voltou em ${hora.get(o.caminhaoId)} (fechado automaticamente).`,
      atendidaPor: o.atendidaPor ?? "Automático", atendidaEm: o.atendidaEm ?? agora,
    },
  })));
}

export async function ocorrenciasAbertas(clienteId: string | null) {
  return db.ocorrencia.findMany({
    where: { status: { not: "resolvida" }, ...SEM_PEDAGIO, ...(clienteId ? { clienteId } : {}) },
    include: { caminhao: { select: { placa: true, motorista: { select: { nome: true, ddi: true, acesso: { select: { email: true, idioma: true } } } } } }, cliente: { select: { nome: true, pais: true, idioma: true } }, midias: { select: { id: true }, orderBy: { data: "asc" }, take: 1 } },
    orderBy: { criadaEm: "desc" },
    take: 300,
  });
}

export async function ocorrenciasResolvidas(clienteId: string | null) {
  return db.ocorrencia.findMany({
    where: { status: "resolvida", ...SEM_PEDAGIO, ...(clienteId ? { clienteId } : {}) },
    include: { caminhao: { select: { placa: true, motorista: { select: { nome: true, ddi: true, acesso: { select: { email: true, idioma: true } } } } } }, cliente: { select: { nome: true, pais: true, idioma: true } }, midias: { select: { id: true }, orderBy: { data: "asc" }, take: 1 } },
    orderBy: { resolvidaEm: "desc" },
    take: 30,
  });
}

export type OcorrenciaVista = {
  id: string; tipo: string; gravidade: string; titulo: string; detalhe: string; status: string;
  lat: number | null; lng: number | null; placa: string; caminhaoId: string; cliente: string;
  /** Vídeo da câmera gravado no momento do alerta (plano Vídeo). */
  midiaId: string | null;
  /** Motorista do caminhão, para a cobrança por WhatsApp. `celular` é o login de acesso dele. */
  motorista: { nome: string; celular: string | null; idioma: "pt" | "es" } | null;
  pais: string;
  criadaEm: string; atendidaPor: string | null; resolvidaEm: string | null; observacao: string | null;
};

/** Com o país salvo no acesso, o número já vai com o código; sem ele, vale o país do cliente. */
function celularMotorista(ddi: string | null, login: string | undefined): string | null {
  if (!login) return null;
  return ddi ? juntarNumero(ddi, login) : login;
}

export function paraVista(o: Awaited<ReturnType<typeof ocorrenciasAbertas>>[number]): OcorrenciaVista {
  return {
    id: o.id, tipo: o.tipo, gravidade: o.gravidade, titulo: o.titulo, detalhe: o.detalhe, status: o.status,
    lat: o.lat, lng: o.lng, placa: o.caminhao.placa, caminhaoId: o.caminhaoId, cliente: o.cliente.nome, midiaId: o.midias[0]?.id ?? null,
    motorista: o.caminhao.motorista ? { nome: o.caminhao.motorista.nome, celular: celularMotorista(o.caminhao.motorista.ddi, o.caminhao.motorista.acesso?.email), idioma: o.caminhao.motorista.acesso?.idioma ?? o.cliente.idioma } : null,
    pais: o.cliente.pais,
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

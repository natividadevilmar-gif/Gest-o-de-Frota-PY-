import type { DadosDia } from "./fonte";
import { distanciaKm } from "../rastreio/rotas";

// Resume as posições de um dia, gravadas pelo receptor próprio, nos mesmos
// indicadores que os fornecedores de rastreamento entregam (TelemetriaDia).

export type PontoDia = {
  data: Date;
  lat: number;
  lng: number;
  velocidadeKmh: number;
  ignicao: boolean | null;
  odometroKm: number | null;
  litrosTotal: number | null;
  rpm: number | null;
  evento: string | null;
  /** Diesel no tanque, em litros (sensor de nível ou CAN). */
  nivelCombustivelL?: number | null;
};

export const LIMITE_VELOCIDADE_KMH = 80;
const RPM_ALTO = 1800;
/** Intervalo máximo contado entre dois pontos (o aparelho pode ficar sem sinal). */
const INTERVALO_MAX_MS = 5 * 60_000;

/** Aparelho próprio: o campo Rastreador guarda o IMEI de 15 dígitos. */
export const ehImei = (id: string | null | undefined) => !!id && /^\d{15}$/.test(id);

export function resumirDia(pontos: PontoDia[], odometroAnteriorKm: number): DadosDia | null {
  if (pontos.length < 2) return null;
  const ps = [...pontos].sort((a, b) => a.data.getTime() - b.data.getTime());
  const odoIni = ps.find((p) => p.odometroKm != null)?.odometroKm;
  const odoFim = ps.findLast((p) => p.odometroKm != null)?.odometroKm;
  let km: number;
  if (odoIni != null && odoFim != null && odoFim >= odoIni) km = odoFim - odoIni;
  else {
    km = 0;
    for (let i = 1; i < ps.length; i++) if (ps[i].velocidadeKmh > 0 || ps[i - 1].velocidadeKmh > 0) km += distanciaKm(ps[i - 1], ps[i]);
  }

  const combIni = ps.find((p) => p.litrosTotal != null)?.litrosTotal;
  const combFim = ps.findLast((p) => p.litrosTotal != null)?.litrosTotal;
  const litrosCan = combIni != null && combFim != null && combFim >= combIni ? Math.round((combFim - combIni) * 10) / 10 : null;

  let ligadoMs = 0, lentaMs = 0, rpmAltoMs = 0, cruzamentos = 0;
  for (let i = 0; i < ps.length - 1; i++) {
    const p = ps[i];
    const dt = Math.min(ps[i + 1].data.getTime() - p.data.getTime(), INTERVALO_MAX_MS);
    const ligado = p.ignicao ?? p.velocidadeKmh > 0;
    if (ligado) {
      ligadoMs += dt;
      if (p.velocidadeKmh < 3) lentaMs += dt;
      if ((p.rpm ?? 0) > RPM_ALTO) rpmAltoMs += dt;
    }
    if (p.velocidadeKmh <= LIMITE_VELOCIDADE_KMH && ps[i + 1].velocidadeKmh > LIMITE_VELOCIDADE_KMH) cruzamentos++;
  }
  const eventosExcesso = ps.filter((p) => p.evento === "excesso").length;
  const pct = (x: number) => (ligadoMs ? Math.round((x / ligadoMs) * 1000) / 10 : 0);

  const kmArred = Math.round(km * 10) / 10;
  return {
    km: kmArred,
    litrosCan,
    odometroKm: Math.round(odoFim ?? odometroAnteriorKm + kmArred),
    marchaLentaPct: pct(lentaMs),
    excessosVelocidade: eventosExcesso || cruzamentos,
    frenagensBruscas: ps.filter((p) => p.evento === "freada").length,
    rpmAltoPct: pct(rpmAltoMs),
  };
}

/** Relatório do dia no mesmo formato do relatório de viagem do Wialon. */
/** Acima disso o caminhão está saindo de verdade, não só manobrando ou com o GPS oscilando. */
const SAINDO_KMH = 10;

/**
 * Saída do dia: o primeiro ponto em que o caminhão começou a andar. O primeiro sinal do dia
 * costuma ser de madrugada, com o caminhão ainda parado; ele não é a saída.
 */
export function saidaDoDia<P extends { data: Date; velocidadeKmh: number }>(pontos: P[]): P | null {
  return pontos.find((p) => p.velocidadeKmh >= SAINDO_KMH) ?? null;
}

export type RelatorioDia = {
  /** Primeira posição recebida no período. */
  primeiroSinal: Date;
  /** Hora em que o caminhão começou a andar (null se não andou). */
  saida: Date | null;
  km: number;
  /** Diesel gasto com o caminhão andando (total menos o gasto parado). */
  litrosViagem: number | null;
  kmL: number | null;
  l100km: number | null;
  nivelInicialL: number | null;
  nivelFinalL: number | null;
  /** Tempo de motor ligado, em segundos. */
  horasMotorS: number;
  odometroFinalKm: number | null;
  velocidadeMedia: number;
  velocidadeMax: number;
  /** Diesel gasto parado ou quase parado (motor ligado abaixo de 5 km/h). */
  litrosParado: number | null;
  litrosTotal: number | null;
};

const QUASE_PARADO_KMH = 5;
const LACUNA_MAX_MS = 2 * 3600_000;
const um = (x: number) => Math.round(x * 10) / 10;

export function relatorioDoDia(pontos: PontoDia[]): RelatorioDia | null {
  if (!pontos.length) return null;
  const ps = [...pontos].sort((a, b) => a.data.getTime() - b.data.getTime());
  const resumo = resumirDia(ps, 0);
  const km = resumo?.km ?? 0;

  let motorMs = 0, andandoMs = 0, parado = 0;
  let ultimoLitros: number | null = null;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.litrosTotal != null) {
      // Diesel gasto desde a leitura anterior conta como parado se o caminhão estava abaixo de 5 km/h.
      const gasto = ultimoLitros != null ? p.litrosTotal - ultimoLitros : 0;
      if (gasto > 0 && i > 0 && ps[i - 1].velocidadeKmh < QUASE_PARADO_KMH && p.velocidadeKmh < QUASE_PARADO_KMH) parado += gasto;
      ultimoLitros = p.litrosTotal;
    }
    if (i === ps.length - 1) break;
    // Sem sinal entre dois pontos com o motor ligado (ou andando) nas duas pontas: o tempo todo conta.
    const q = ps[i + 1];
    const passo = q.data.getTime() - p.data.getTime();
    const dt = (ambos: boolean) => Math.min(passo, ambos ? LACUNA_MAX_MS : INTERVALO_MAX_MS);
    const ligado = (x: PontoDia) => x.ignicao ?? x.velocidadeKmh > 0;
    if (ligado(p)) motorMs += dt(ligado(q));
    if (p.velocidadeKmh >= QUASE_PARADO_KMH) andandoMs += dt(q.velocidadeKmh >= QUASE_PARADO_KMH);
  }

  const litrosTotal = resumo?.litrosCan ?? null;
  const litrosParado = litrosTotal == null ? null : um(Math.min(parado, litrosTotal));
  const litrosViagem = litrosTotal == null ? null : um(litrosTotal - (litrosParado ?? 0));
  const nivel = ps.filter((p) => p.nivelCombustivelL != null);
  const odoFim = ps.findLast((p) => p.odometroKm != null)?.odometroKm;
  return {
    primeiroSinal: ps[0].data,
    saida: saidaDoDia(ps)?.data ?? null,
    km,
    litrosViagem,
    kmL: litrosViagem && km ? Math.round((km / litrosViagem) * 100) / 100 : null,
    l100km: litrosViagem && km ? um((litrosViagem / km) * 100) : null,
    nivelInicialL: nivel.length ? um(nivel[0].nivelCombustivelL!) : null,
    nivelFinalL: nivel.length ? um(nivel.at(-1)!.nivelCombustivelL!) : null,
    horasMotorS: Math.round(motorMs / 1000),
    odometroFinalKm: odoFim != null ? Math.round(odoFim) : null,
    velocidadeMedia: andandoMs ? Math.round(km / (andandoMs / 3600_000)) : 0,
    velocidadeMax: Math.max(0, ...ps.map((p) => p.velocidadeKmh)),
    litrosParado,
    litrosTotal,
  };
}

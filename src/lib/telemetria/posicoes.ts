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

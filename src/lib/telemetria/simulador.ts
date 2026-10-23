import type { DadosDia, EquipamentoRef, FonteTelemetria } from "./fonte";

// Gera dados plausíveis e sempre iguais para o mesmo caminhão e dia,
// para demonstrar e testar a plataforma antes do contrato com o fornecedor.

function semente(texto: string): () => number {
  let h = 2166136261;
  for (const ch of texto) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export const simulador = {
  nome: "simulador",
  async buscarDia(eq: EquipamentoRef, dia: Date): Promise<DadosDia> {
    const r = semente(`${eq.rastreadorId}:${dia.toISOString().slice(0, 10)}`);
    const domingo = dia.getUTCDay() === 0;
    const km = domingo ? Math.round(r() * 60) : Math.round(220 + r() * 260);
    const kmL = 2.3 + r() * 0.5;
    return {
      km,
      litrosCan: eq.leCan ? Math.round((km / kmL) * 10) / 10 : null,
      odometroKm: eq.odometroAnteriorKm + km,
      marchaLentaPct: Math.round((3 + r() * 12) * 10) / 10,
      excessosVelocidade: r() < 0.3 ? Math.ceil(r() * 3) : 0,
      frenagensBruscas: r() < 0.25 ? Math.ceil(r() * 2) : 0,
      rpmAltoPct: Math.round(r() * 10 * 10) / 10,
    };
  },
} satisfies FonteTelemetria;

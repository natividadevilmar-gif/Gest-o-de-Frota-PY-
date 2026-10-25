// Pedágio previsto de uma rota: soma das praças do caminho pelo número de eixos do caminhão.
// Funções puras; as praças e rotas ficam no banco (PracaPedagio, RotaPedagio).

export type Praca = {
  id: string; pais: string; rodovia: string; nome: string; moeda: string;
  tarifaEixo: number | null; tarifaFixa: number | null;
};

/** Valor de uma praça para um caminhão com `eixos` eixos, na moeda da praça. */
export function valorPraca(p: Praca, eixos: number): number {
  if (p.tarifaEixo != null) return Math.round(p.tarifaEixo * eixos * 100) / 100;
  return p.tarifaFixa ?? 0;
}

/** Unidades da moeda por 1 dólar (USD = 1). */
export type Taxas = Record<string, number>;

export type Previsto = {
  porMoeda: { moeda: string; valor: number }[];
  usd: number;
  itens: (Praca & { valor: number; usd: number })[];
  /** Praças sem tarifa ou com moeda sem cotação: ficam fora do total. */
  semValor: string[];
};

export function previstoRota(pracas: Praca[], eixos: number, taxas: Taxas): Previsto {
  const soma = new Map<string, number>();
  const itens: Previsto["itens"] = [];
  const semValor: string[] = [];
  let usd = 0;
  for (const p of pracas) {
    const valor = valorPraca(p, eixos);
    const t = taxas[p.moeda];
    if (!valor || !t) {
      semValor.push(p.nome);
      continue;
    }
    const emUsd = Math.round((valor / t) * 100) / 100;
    usd += emUsd;
    soma.set(p.moeda, (soma.get(p.moeda) ?? 0) + valor);
    itens.push({ ...p, valor, usd: emUsd });
  }
  return {
    porMoeda: [...soma].map(([moeda, valor]) => ({ moeda, valor: Math.round(valor * 100) / 100 })),
    usd: Math.round(usd * 100) / 100,
    itens,
    semValor,
  };
}

export const SIMBOLO_PEDAGIO: Record<string, string> = { USD: "USD", PYG: "₲", BRL: "R$", ARS: "AR$", UYU: "$U" };

/** Taxas do dia para o pedágio. O peso uruguaio não está na cotação diária: usa um valor fixo. */
export function taxasPedagio(c: { pygPorUsd: number; brlPorUsd: number; arsPorUsd: number }, uyuPorUsd: number): Taxas {
  return { USD: 1, PYG: c.pygPorUsd, BRL: c.brlPorUsd, ARS: c.arsPorUsd, UYU: uyuPorUsd };
}

export type RotaComPracas = { id: string; nome: string; km: number; paises: string; pracas: Praca[] };

/** Distância (km) de onde a praça pode estar até a trilha do GPS para contar como passagem. */
export const RAIO_PASSAGEM_KM = 3;

type PontoGps = { lat: number; lng: number; data: Date };
type PracaGps = { id: string; lat: number; lng: number };

/** Distância em km do ponto `p` ao segmento a–b (plano local, suficiente para poucos km). */
function distSegmentoKm(p: { lat: number; lng: number }, a: PontoGps, b: PontoGps): { km: number; t: number } {
  const kx = 111.32 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110.57;
  const ax = (a.lng - p.lng) * kx, ay = (a.lat - p.lat) * ky;
  const bx = (b.lng - p.lng) * kx, by = (b.lat - p.lat) * ky;
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
  return { km: Math.hypot(ax + t * dx, ay + t * dy), t };
}

/**
 * Passagens por praças numa trilha de GPS em ordem de hora. Usa o segmento entre dois pontos,
 * para não perder a praça quando o aparelho manda posição espaçada. Uma praça só conta de novo
 * depois que o caminhão se afasta dela (volta pelo mesmo caminho).
 */
export function passagensPedagio(pontos: PontoGps[], pracas: PracaGps[], raioKm = RAIO_PASSAGEM_KM): { pracaId: string; data: Date }[] {
  const r: { pracaId: string; data: Date }[] = [];
  const perto = new Set<string>();
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1], b = pontos[i];
    for (const p of pracas) {
      const d = distSegmentoKm(p, a, b);
      if (d.km <= raioKm) {
        if (!perto.has(p.id)) {
          perto.add(p.id);
          r.push({ pracaId: p.id, data: new Date(a.data.getTime() + d.t * (b.data.getTime() - a.data.getTime())) });
        }
      } else if (perto.has(p.id) && distSegmentoKm(p, b, b).km > raioKm * 3) {
        perto.delete(p.id);
      }
    }
  }
  return r.sort((x, y) => x.data.getTime() - y.data.getTime());
}

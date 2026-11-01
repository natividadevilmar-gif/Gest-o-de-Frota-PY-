// Queda brusca do diesel no tanque com o caminhão parado: sinal de furto (ou vazamento).

/** Queda mínima para alertar: 40 L e pelo menos 8% do que havia no tanque. */
export const QUEDA_MIN_L = 40;
export const QUEDA_MIN_PCT = 0.08;
/** A queda tem de acontecer dentro deste tempo (marcha lenta gasta uns 3 L/h, nunca 40 L). */
export const JANELA_MS = 45 * 60_000;
/** Até esta velocidade conta como parado (o GPS oscila uns km/h com o caminhão parado). */
export const PARADO_KMH = 5;

export type PontoTanque = { data: Date; nivelCombustivelL: number | null; velocidadeKmh: number; lat: number; lng: number };
export type Queda = { inicio: Date; fim: Date; antesL: number; depoisL: number; litros: number; lat: number; lng: number };

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Procura quedas bruscas do nível com o caminhão parado. O nível é suavizado (mediana de 5
 * leituras) para o balanço do diesel e uma leitura falsa isolada não dispararem o alerta, e a
 * queda só conta quando as duas leituras seguintes confirmam o nível baixo.
 */
export function quedasDeDiesel(pontos: PontoTanque[]): Queda[] {
  const ps = pontos.filter((p) => p.nivelCombustivelL != null).sort((a, b) => a.data.getTime() - b.data.getTime());
  if (ps.length < 5) return [];
  const bruto = ps.map((p) => p.nivelCombustivelL!);
  const nivel = bruto.map((_, i) => mediana(bruto.slice(Math.max(0, i - 2), i + 3)));
  const quedas: Queda[] = [];
  let i = 0;
  while (i < ps.length - 3) {
    if (ps[i].velocidadeKmh > PARADO_KMH) { i++; continue; }
    let achou = -1;
    for (let j = i + 1; j <= ps.length - 3; j++) {
      if (ps[j].data.getTime() - ps[i].data.getTime() > JANELA_MS) break;
      if (ps[j].velocidadeKmh > PARADO_KMH) break;
      const queda = nivel[i] - nivel[j];
      if (queda >= QUEDA_MIN_L && queda >= nivel[i] * QUEDA_MIN_PCT) achou = j;
      else if (achou >= 0) break;
    }
    if (achou < 0) { i++; continue; }
    // Vai até o ponto mais baixo enquanto continua parado e dentro da janela.
    let fim = achou;
    for (let j = achou + 1; j <= ps.length - 3; j++) {
      if (ps[j].velocidadeKmh > PARADO_KMH || ps[j].data.getTime() - ps[i].data.getTime() > JANELA_MS) break;
      if (nivel[j] < nivel[fim]) fim = j;
    }
    const antes = nivel[i], depois = nivel[fim];
    quedas.push({ inicio: ps[i].data, fim: ps[fim].data, antesL: Math.round(antes), depoisL: Math.round(depois), litros: Math.round(antes - depois), lat: ps[fim].lat, lng: ps[fim].lng });
    i = fim + 1;
  }
  return quedas;
}
